import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Soft radial gradients on Lissajous paths. Radial falloff replaces filter: blur(). */
export const blobs: Generator = {
  name: 'Floating Blobs',
  kind: 'shape',
  controls: [
    { key: 'count', label: 'Blobs', min: 2, max: 16, step: 1 },
    { key: 'size', label: 'Size', min: 0.3, max: 2, step: 0.05 },
  ],
  make(g) {
    const { ctx, w, h, rng, p } = g, m = Math.min(w, h), size = g.o('size', 1), breathe = g.lq(0.3);
    const bl = Array.from({ length: Math.round(g.o('count', 4 + 4 * p.density)) }, (_, i) => ({
      cx: w * rng(), cy: h * rng(), r: m * rng.range(0.3, 0.6) * size, ax: w * rng.range(0.1, 0.3), ay: h * rng.range(0.1, 0.3),
      fx: g.lq(rng.range(0.1, 0.25)), fy: g.lq(rng.range(0.1, 0.25)), ph: rng() * TAU, col: g.c(i),
    }));
    return t => {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (const b of bl) {
        const x = b.cx + Math.sin(t * b.fx + b.ph) * b.ax, y = b.cy + Math.cos(t * b.fy + b.ph * 1.7) * b.ay;
        const r = b.r * (1 + 0.12 * Math.sin(t * breathe + b.ph));
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, rgba(b.col, 0.7)); gr.addColorStop(0.45, rgba(b.col, 0.3)); gr.addColorStop(1, rgba(b.col, 0));
        ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      ctx.restore();
    };
  },
};
