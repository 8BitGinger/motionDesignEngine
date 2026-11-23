import { GENERATORS } from '../generators';
import { buildPalette, rgba } from './ColorEngine';
import { DEFAULT_PARAMS } from './SeedEngine';
import { TAU, hash3, makeNoise, makeNoise4, makeRng, mod, mulberry32 } from './rng';
import type { BackdropConfig, Calm, DrawFn, GenContext, Layer, Palette } from './types';

export interface Renderer {
  w: number;
  h: number;
  pal: Palette;
  /** true when every pattern in the config loops natively (no crossfade needed). */
  trueLoop: boolean;
  /** Draw the frame at time `t` seconds, optionally driven by audio. */
  render(t: number, audio?: AudioFrame | null): void;
}

export interface LoopOptions {
  /** Clip length in seconds. Frame `length` is identical to frame 0. */
  length: number;
  /** Crossfade length in seconds, used only for patterns that can't loop natively (clamped to half the clip). */
  fade: number;
}

/** Audio features for one frame, each 0..1, plus `warp`: accumulated loudness in seconds. */
export interface AudioFrame {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  warp: number;
}

export interface RendererOptions {
  /** Frame-exact mode for video rendering: stateful generators re-simulate instead of skipping gaps. */
  exact?: boolean;
  /** Make the clip loop seamlessly. Ignored when audio reactivity is on (audio doesn't loop). */
  loop?: LoopOptions | null;
  /** No background: clear to transparent, and fade (instead of darken) for vignette and calm zone. */
  transparent?: boolean;
  /** 0..2: how strongly audio pushes time forward, zooms on bass and flashes. 0 = off. */
  reactivity?: number;
}

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

/** Ease for the loop crossfade weight. */
const smooth = (x: number) => x * x * (3 - 2 * x);

function makeGrainTiles(seed: number) {
  const r = mulberry32(seed ^ 0x51ed), tiles: HTMLCanvasElement[] = [];
  for (let k = 0; k < 6; k++) {
    const c = makeCanvas(256, 256), x = c.getContext('2d')!, im = x.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) { const v = (r() * 255) | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0); tiles.push(c);
  }
  return tiles;
}

/** Paint a soft "quiet" area. In transparent mode the same gradient erases instead of darkening. */
function paintCalm(c: CanvasRenderingContext2D, w: number, h: number, calm: Calm, color: string, transparent: boolean) {
  const a = Math.min(1, Math.max(0, calm.strength));
  if (calm.zone === 'off' || a <= 0) return;
  const col = transparent ? '#000000' : color;
  let gr: CanvasGradient;
  c.save();
  if (transparent) c.globalCompositeOperation = 'destination-out';
  if (calm.zone === 'center') {
    // Ellipse: a circular gradient squashed by the frame's aspect.
    c.setTransform(w / 2, 0, 0, h / 2, w / 2, h / 2);
    gr = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.45, rgba(col, a * 0.85)); gr.addColorStop(1, rgba(col, 0));
    c.fillStyle = gr; c.fillRect(-1, -1, 2, 2);
  } else {
    const [x0, y0, x1, y1] = { left: [0, 0, w, 0], right: [w, 0, 0, 0], top: [0, 0, 0, h], bottom: [0, h, 0, 0] }[calm.zone];
    gr = c.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, rgba(col, a)); gr.addColorStop(0.38, rgba(col, a * 0.85)); gr.addColorStop(0.62, rgba(col, 0));
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }
  c.restore();
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
  const transparent = !!opts.transparent, react = Math.max(0, opts.reactivity ?? 0);

  /** Film grain, re-rolled 24×/s. With a loop `period`, the sequence of grain frames repeats exactly. */
  const drawGrain = (c: CanvasRenderingContext2D, t: number, amount: number, period = 0) => {
    const n = period ? Math.max(1, Math.round(period * 24)) : 0;
    const f = n ? mod(Math.floor((t * n) / period + 1e-6), n) : Math.floor(t * 24), tile = tiles[mod(f, tiles.length)];
    const pat = c.createPattern(tile, 'repeat')!;
    pat.setTransform(new DOMMatrix().translate(hash3(f, 1, 2) % 256, hash3(f, 3, 4) % 256).scale(Math.max(0.5, s)));
    c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = amount; c.fillStyle = pat; c.fillRect(0, 0, w, h); c.restore();
  };

  const isChaos = cfg.type === 'chaos' || cfg.type === 'stack'; // both are multi-layer configs
  const defs: Layer[] = isChaos
    ? cfg.layers ?? []
    : [{ type: cfg.type, seed: cfg.seed, blend: 'source-over', opacity: 1, params: {}, opts: cfg.opts }];

  // Looping: native when every pattern supports it, otherwise a crossfade. Audio time-warp can't loop.
  const loopLen = opts.loop && opts.loop.length > 0 && !react ? opts.loop.length : 0;
  const trueLoop = loopLen > 0 && defs.every(L => GENERATORS[L.type]?.loops !== false);
  const fadeLoop = loopLen > 0 && !trueLoop ? { length: loopLen, fade: Math.min(Math.max(0.05, opts.loop!.fade), loopLen / 2) } : null;

  const bgA = makeRng((cfg.seed ?? 1) ^ 0x77)() * TAU, D = Math.hypot(w, h) / 2;

  /** A scene draws background + pattern layers (no vignette/grain/calm) into `target`. */
  const makeScene = (target: CanvasRenderingContext2D) => {
    const layers = defs.map(L => {
      const gen = GENERATORS[L.type];
      if (!gen) return null;
      const p = { ...base, ...(L.params ?? {}) };
      // Chaos layers each get their own canvas so masks, blend modes and opacity composite cleanly.
      const lc = isChaos ? makeCanvas(w, h) : null;
      const lctx = lc ? lc.getContext('2d')! : target;
      const period = trueLoop ? loopLen * p.speed : 0;
      const noise = makeNoise(L.seed), noise4 = period ? makeNoise4(L.seed) : null;
      const g: GenContext = {
        ctx: lctx, w, h, s, p, pal, seed: L.seed >>> 0, rng: makeRng(L.seed), noise, exact: !!opts.exact, period,
        c: i => pal.colors[mod(i, nc)],
        drawGrain: (c, t, amount) => drawGrain(c, t, amount, period),
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
        o: (key, auto) => (typeof L.opts?.[key] === 'number' ? L.opts[key] : auto),
        tn(x, y, t, rate) {
          if (!noise4) return noise(x, y, t * rate);
          // Walk a circle whose circumference equals the distance a straight walk would cover in one period.
          const a = (TAU * t) / period, r = (rate * period) / TAU;
          return noise4(x, y, Math.cos(a) * r, Math.sin(a) * r);
        },
        lq(v, unit = TAU, min1 = true) {
          if (!period || !v) return v;
          let n = Math.round((v * period) / unit);
          if (!n && min1) n = Math.sign(v);
          return (n * unit) / period;
        },
        cyc(t, dur, phase = 0) {
          if (period) {
            const n = Math.max(1, Math.round(period / dur)), x = (t * n) / period + phase, k = Math.floor(x);
            return [mod(k, n), x - k];
          }
          const x = t / dur + phase, k = Math.floor(x);
          return [k, x - k];
        },
      };
      const draw: DrawFn = gen.make(g);
      return { draw, lc, lctx, blend: L.blend || 'source-over', opacity: L.opacity ?? 1, speed: p.speed, mask: L.mask };
    });
    const bgGrad = target.createLinearGradient(w / 2 - Math.cos(bgA) * D, h / 2 - Math.sin(bgA) * D, w / 2 + Math.cos(bgA) * D, h / 2 + Math.sin(bgA) * D);
    bgGrad.addColorStop(0, pal.bg[0]); bgGrad.addColorStop(1, pal.bg[1]);
    return (t: number) => {
      target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = 1; target.globalCompositeOperation = 'source-over';
      if (transparent) target.clearRect(0, 0, w, h);
      else { target.fillStyle = bgGrad; target.fillRect(0, 0, w, h); }
      if (!isChaos) { layers[0]?.draw(t * layers[0].speed); return; }
      for (const L of layers) {
        if (!L?.lc) continue;
        L.lctx.setTransform(1, 0, 0, 1, 0, 0); L.lctx.globalAlpha = 1; L.lctx.globalCompositeOperation = 'source-over';
        L.lctx.clearRect(0, 0, w, h);
        L.draw(t * L.speed);
      }
      // Masks run high index → low, so a mask source is still unmasked when an earlier layer uses it.
      for (let i = layers.length - 1; i >= 0; i--) {
        const L = layers[i], M = L?.mask != null ? layers[L.mask] : null;
        if (!L?.lc || !M?.lc || M === L) continue;
        L.lctx.save(); L.lctx.setTransform(1, 0, 0, 1, 0, 0); L.lctx.globalCompositeOperation = 'destination-in';
        L.lctx.drawImage(M.lc, 0, 0); L.lctx.restore();
      }
      for (const L of layers) {
        if (!L?.lc || L.opacity <= 0) continue;
        target.save(); target.globalCompositeOperation = L.blend; target.globalAlpha = L.opacity; target.drawImage(L.lc, 0, 0); target.restore();
      }
    };
  };

  // With audio the scene goes to a stage canvas first so it can be zoomed on the beat.
  const stage = react > 0 ? makeCanvas(w, h) : null;
  const main = makeScene(stage ? stage.getContext('2d')! : ctx);
  // Crossfade loop (fallback): the first `fade` seconds blend from F(t + length) into F(t), so frame 0 shows
  // F(length), which is exactly where the last frame is heading. A second, independent scene renders the
  // "ahead" time so stateful patterns (Flow Field) only ever simulate forward.
  let ahead: { cv: HTMLCanvasElement; draw: (t: number) => void } | null = null;
  let copy: HTMLCanvasElement | null = null;

  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, `rgba(0,0,0,${base.vignette})`);

  return {
    w, h, pal, trueLoop,
    render(t, audio) {
      const A = react > 0 && audio ? audio : null;
      // Loud passages push time forward, so motion surges with the music.
      main(A ? t + react * 1.2 * A.warp : t);
      if (stage) {
        const z = 1 + 0.05 * react * (A?.bass ?? 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
        ctx.setTransform(z, 0, 0, z, (w / 2) * (1 - z), (h / 2) * (1 - z)); ctx.drawImage(stage, 0, 0);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const kick = Math.max(0, (A?.bass ?? 0) - 0.55) / 0.45;
        if (kick > 0) {
          ctx.save(); ctx.globalCompositeOperation = transparent ? 'source-atop' : 'lighter';
          ctx.globalAlpha = Math.min(0.35, 0.14 * react * kick * kick); ctx.fillStyle = pal.colors[0]; ctx.fillRect(0, 0, w, h); ctx.restore();
        }
      }
      if (fadeLoop && t < fadeLoop.fade) {
        if (!ahead) { const cv = makeCanvas(w, h); ahead = { cv, draw: makeScene(cv.getContext('2d')!) }; }
        ahead.draw(t + fadeLoop.length);
        const a = smooth(t / fadeLoop.fade);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (transparent) {
          // Exact lerp of premultiplied pixels: a·now + (1−a)·ahead, summed with 'lighter'.
          copy ??= makeCanvas(w, h);
          const cc = copy.getContext('2d')!; cc.clearRect(0, 0, w, h); cc.drawImage(canvas, 0, 0);
          ctx.clearRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a; ctx.drawImage(copy, 0, 0);
          ctx.globalAlpha = 1 - a; ctx.drawImage(ahead.cv, 0, 0);
        } else { ctx.globalAlpha = 1 - a; ctx.drawImage(ahead.cv, 0, 0); }
        ctx.restore();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      if (cfg.calm) paintCalm(ctx, w, h, cfg.calm, pal.bg[0], transparent);
      if (base.vignette > 0) {
        ctx.save(); if (transparent) ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = vig; ctx.fillRect(0, 0, w, h); ctx.restore();
      }
      if (base.grain > 0 && !transparent) drawGrain(ctx, t, base.grain * 0.5, loopLen);
    },
  };
}
