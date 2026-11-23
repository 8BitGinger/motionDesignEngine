import type { Generator } from '../engine/types';
import { TAU, hash3, makeRng } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/**
 * Flames: additive glowing embers that rise from the bottom edge, shrink, cool and sway.
 * Each ember lives one cycle (hashed spawn spot per cycle), so it loops exactly when the clip loops.
 */
export const fire: Generator = {
  name: 'Fire',
  kind: 'shape',
  controls: [
    { key: 'height', label: 'Flame height', min: 0.2, max: 1.2, step: 0.02 },
    { key: 'count', label: 'Embers', min: 30, max: 500, step: 5 },
    { key: 'width', label: 'Fire width', min: 0.2, max: 1, step: 0.02 },
  ],
  make(g) {
    const { ctx, w, h, s, rng, p, pal } = g, r2 = makeRng(g.seed ^ 0xf1e);
    // Three heat stages (young → old) as pre-rendered soft sprites: hot core, body, cooling smoke-red.
    const stage = (i: number, core: number) => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d')!, gr = x.createRadialGradient(64, 64, 0, 64, 64, 64), col = g.c(i);
      gr.addColorStop(0, rgba(col, core)); gr.addColorStop(0.35, rgba(col, core * 0.6)); gr.addColorStop(1, rgba(col, 0));
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      return c;
    };
    const sprites = [stage(2, 1), stage(1, 0.85), stage(0, 0.6)];
    const hot = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!, gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, rgba(g.c(2), 0.5)); gr.addColorStop(1, rgba(g.c(2), 0)); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return c; })();
    const N = Math.round(g.o('count', 160 * p.density)), rise = h * g.o('height', 0.7), spread = w * g.o('width', 0.7);
    const embers = Array.from({ length: N }, (_, i) => {
      const e = { i, ph: rng(), life: r2.range(1.1, 2.6), r: r2.range(28, 80) * s, sway: r2.range(10, 40) * s, f: r2.range(0.8, 2.2), pp: r2() * TAU, hi: r2.range(0.7, 1.15) };
      return { ...e, fs: g.lq(e.f) };
    });
    return t => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const e of embers) {
        const [k, u] = g.cyc(t, e.life, e.ph);
        // Gaussian-ish spawn position: embers cluster in the middle of the fire's width.
        const a = (hash3(e.i, k, g.seed) % 10000) / 10000, b = (hash3(k, e.i, g.seed ^ 7) % 10000) / 10000, hv = 0.6 + 0.8 * b;
        const bx = w / 2 + (a + (hash3(e.i, k, g.seed ^ 3) % 10000) / 10000 - 1) * spread;
        const x = bx + Math.sin(t * e.fs + e.pp + u * 4) * e.sway * u;
        const y = h + e.r * 0.3 - Math.pow(u, 0.85) * rise * hv * e.hi;
        const r = e.r * (1 - u * 0.85) * (0.8 + 0.4 * b);
        ctx.globalAlpha = Math.min(1, u * 8) * (1 - u) * (1 - u) * 1.2;
        ctx.drawImage(sprites[Math.min(2, Math.floor(u * 3))], x - r, y - r, r * 2, r * 2);
        if (u < 0.45) { ctx.globalAlpha *= 0.8; const q = r * 0.55; ctx.drawImage(hot, x - q, y - q, q * 2, q * 2); }
      }
      if (p.glow) { // a soft warm bed along the bottom
        const gr = ctx.createLinearGradient(0, h, 0, h - rise * 0.5);
        gr.addColorStop(0, rgba(g.c(1), 0.35)); gr.addColorStop(1, rgba(g.c(1), 0));
        ctx.globalAlpha = 1; ctx.fillStyle = gr; ctx.fillRect(0, h - rise * 0.5, w, rise * 0.5);
      }
      ctx.restore();
    };
  },
};
