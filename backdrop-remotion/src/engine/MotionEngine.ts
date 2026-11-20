import { GENERATORS } from '../generators';
import { buildPalette } from './ColorEngine';
import { DEFAULT_PARAMS } from './SeedEngine';
import { TAU, hash3, makeNoise, makeRng, mod, mulberry32 } from './rng';
import type { BackdropConfig, DrawFn, GenContext, Palette } from './types';

export interface Renderer {
  w: number;
  h: number;
  pal: Palette;
  /** Draw the frame at time `t` seconds. */
  render(t: number): void;
}

export interface LoopOptions {
  /** Clip length in seconds. Frame `length` is identical to frame 0. */
  length: number;
  /** Crossfade length in seconds (clamped to half the clip). */
  fade: number;
}

export interface RendererOptions {
  /** Frame-exact mode for video rendering: stateful generators re-simulate instead of skipping gaps. */
  exact?: boolean;
  /** Make the clip loop seamlessly. */
  loop?: LoopOptions | null;
}

/** Ease for the loop crossfade weight. */
const smooth = (x: number) => x * x * (3 - 2 * x);

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

function makeGrainTiles(seed: number) {
  const r = mulberry32(seed ^ 0x51ed), tiles: HTMLCanvasElement[] = [];
  for (let k = 0; k < 6; k++) {
    const c = makeCanvas(256, 256), x = c.getContext('2d')!, im = x.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) { const v = (r() * 255) | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0); tiles.push(c);
  }
  return tiles;
}

/**
 * Builds a renderer bound to `canvas`. All motion is a function of time + seed, so the same
 * config renders identically at any resolution (sizes scale with min(w,h)/1080).
 */
export function createRenderer(canvas: HTMLCanvasElement, cfg: BackdropConfig, opts: RendererOptions = {}): Renderer {
  const ctx = canvas.getContext('2d')!, w = canvas.width, h = canvas.height, s = Math.min(w, h) / 1080;
  const pal = buildPalette(cfg.palette), nc = pal.colors.length;
  const base = { ...DEFAULT_PARAMS, ...cfg.params };
  const tiles = makeGrainTiles(cfg.seed ?? 1);

  const drawGrain = (c: CanvasRenderingContext2D, t: number, amount: number) => {
    const f = Math.floor(t * 24), tile = tiles[mod(f, tiles.length)];
    const pat = c.createPattern(tile, 'repeat')!;
    pat.setTransform(new DOMMatrix().translate(hash3(f, 1, 2) % 256, hash3(f, 3, 4) % 256).scale(Math.max(0.5, s)));
    c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = amount; c.fillStyle = pat; c.fillRect(0, 0, w, h); c.restore();
  };

  const isChaos = cfg.type === 'chaos';
  const defs = isChaos ? cfg.layers ?? [] : [{ type: cfg.type, seed: cfg.seed, blend: 'source-over' as GlobalCompositeOperation, opacity: 1, params: {} }];

  const bgA = makeRng((cfg.seed ?? 1) ^ 0x77)() * TAU, D = Math.hypot(w, h) / 2;

  /** A scene draws background + pattern layers (no vignette/grain) into `target`. */
  const makeScene = (target: CanvasRenderingContext2D) => {
    const layers = defs.filter(L => GENERATORS[L.type]).map(L => {
      const p = { ...base, ...(L.params ?? {}) };
      // Chaos layers each get their own canvas so blend modes and opacity composite cleanly.
      const lc = isChaos ? makeCanvas(w, h) : null;
      const lctx = lc ? lc.getContext('2d')! : target;
      const g: GenContext = {
        ctx: lctx, w, h, s, p, pal, seed: L.seed >>> 0, rng: makeRng(L.seed), noise: makeNoise(L.seed), exact: !!opts.exact,
        c: i => pal.colors[mod(i, nc)],
        drawGrain,
        buffer() { const buf = makeCanvas(w, h); return { buf, bctx: buf.getContext('2d')! }; },
        stroke(path, c = lctx) {
          // Glow = a wide, faint additive pass. Far cheaper to render than filter: blur() or shadowBlur.
          if (p.glow) {
            c.save(); c.lineWidth *= 5; c.globalAlpha *= 0.14; c.globalCompositeOperation = 'lighter';
            if (path) c.stroke(path); else c.stroke();
            c.restore();
          }
          if (path) c.stroke(path); else c.stroke();
        },
      };
      const draw: DrawFn = GENERATORS[L.type].make(g);
      return { draw, lc, lctx, blend: L.blend || 'source-over', opacity: L.opacity ?? 1, speed: p.speed };
    });
    const bgGrad = target.createLinearGradient(w / 2 - Math.cos(bgA) * D, h / 2 - Math.sin(bgA) * D, w / 2 + Math.cos(bgA) * D, h / 2 + Math.sin(bgA) * D);
    bgGrad.addColorStop(0, pal.bg[0]); bgGrad.addColorStop(1, pal.bg[1]);
    return (t: number) => {
      target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = 1; target.globalCompositeOperation = 'source-over';
      target.fillStyle = bgGrad; target.fillRect(0, 0, w, h);
      for (const L of layers) {
        if (L.lc) {
          L.lctx.setTransform(1, 0, 0, 1, 0, 0); L.lctx.clearRect(0, 0, w, h);
          L.draw(t * L.speed);
          target.save(); target.globalCompositeOperation = L.blend; target.globalAlpha = L.opacity; target.drawImage(L.lc, 0, 0); target.restore();
        } else L.draw(t * L.speed);
      }
    };
  };

  const main = makeScene(ctx);
  // Loop: the first `fade` seconds crossfade from F(t + length) into F(t). So frame 0 shows F(length),
  // which is exactly where the last frame is heading. A second, independent scene renders the
  // "ahead" time so stateful patterns (Flow Field) only ever simulate forward.
  const loop = opts.loop && opts.loop.length > 0 ? { length: opts.loop.length, fade: Math.min(Math.max(0.05, opts.loop.fade), opts.loop.length / 2) } : null;
  let ahead: { cv: HTMLCanvasElement; draw: (t: number) => void } | null = null;

  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(0,0,0,${base.vignette})`);

  return {
    w, h, pal,
    render(t) {
      main(t);
      if (loop && t < loop.fade) {
        if (!ahead) { const cv = makeCanvas(w, h); ahead = { cv, draw: makeScene(cv.getContext('2d')!) }; }
        ahead.draw(t + loop.length);
        ctx.save(); ctx.globalAlpha = 1 - smooth(t / loop.fade); ctx.drawImage(ahead.cv, 0, 0); ctx.restore();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (base.vignette > 0) { ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h); }
      if (base.grain > 0) drawGrain(ctx, t, base.grain * 0.5);
    },
  };
}
