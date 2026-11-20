import type { Generator } from '../engine/types';
import { TAU, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Out-of-focus light discs. Each colour gets one pre-rendered radial sprite; no blur filters. */
export const bokeh: Generator = {
  name: 'Bokeh Lights',
  make(g) {
    const { ctx, w, h, s, rng, p, pal } = g;
    const sprites = pal.colors.map(col => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d')!, gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      // Flat core with a slightly brighter rim, like a real lens aperture.
      gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(0.72, rgba(col, 0.6)); gr.addColorStop(0.86, rgba(col, 0.75));
      gr.addColorStop(0.93, rgba(col, 0.3)); gr.addColorStop(1, rgba(col, 0));
      x.fillStyle = gr; x.beginPath(); x.arc(128, 128, 128, 0, TAU); x.fill();
      return c;
    });
    const N = Math.round(46 * p.density);
    const discs = Array.from({ length: N }, () => {
      const depth = rng(); // 0 = far (small, faint), 1 = near (big, bright)
      return {
        x: rng(), y: rng(), depth, r: (18 + depth * depth * 140) * s, vx: rng.range(-10, 10) * s * (0.4 + depth), vy: rng.range(-22, -4) * s * (0.4 + depth),
        a: 0.12 + depth * 0.4, ph: rng() * TAU, f: rng.range(0.2, 0.6), sp: rng.int(0, sprites.length - 1), sw: rng.range(10, 40) * s,
      };
    }).sort((a, b) => a.depth - b.depth);
    return t => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const d of discs) {
        const M = d.r * 2, W = w + 2 * M, H = h + 2 * M;
        const x = mod(d.x * W + d.vx * t + Math.sin(t * d.f + d.ph) * d.sw, W) - M;
        const y = mod(d.y * H + d.vy * t, H) - M;
        ctx.globalAlpha = d.a * (0.65 + 0.35 * Math.sin(t * d.f * 2.3 + d.ph * 2));
        const r = d.r * (p.glow ? 1.15 : 1);
        ctx.drawImage(sprites[d.sp], x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
    };
  },
};
