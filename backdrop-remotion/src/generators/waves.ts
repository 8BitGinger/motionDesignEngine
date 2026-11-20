import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';
import { mixHex, rgba } from '../engine/ColorEngine';

/** Stacked filled sine layers with highlighted crests. */
export const waves: Generator = {
  name: 'Wave Bands',
  make(g) {
    const { ctx, w, h, s, rng, p, pal } = g, L = Math.round(4 + 3 * p.density), steps = 90;
    const layers = Array.from({ length: L }, (_, i) => {
      const base = h * (0.3 + (0.62 * i) / L), a1 = h * rng.range(0.03, 0.08), col = g.c(i);
      const gr = ctx.createLinearGradient(0, base - a1 * 2, 0, h);
      gr.addColorStop(0, rgba(col, 0.8)); gr.addColorStop(1, rgba(mixHex(col, pal.bg[0], 0.75), 0.95));
      return {
        base, a1, f1: rng.range(1, 2.5), v1: rng.range(0.2, 0.5), a2: h * rng.range(0.01, 0.035), f2: rng.range(3, 6), v2: rng.range(-0.6, 0.6),
        ph: rng() * TAU, gr, edge: rgba(mixHex(col, '#ffffff', 0.4), 0.6),
      };
    });
    const ys = new Float32Array(steps + 1);
    return t => {
      ctx.save(); ctx.lineWidth = 2 * s;
      for (const l of layers) {
        for (let k = 0; k <= steps; k++) {
          const x = k / steps;
          ys[k] = l.base + l.a1 * Math.sin(x * TAU * l.f1 + t * l.v1 + l.ph) + l.a2 * Math.sin(x * TAU * l.f2 + t * l.v2 + l.ph * 2);
        }
        ctx.beginPath(); ctx.moveTo(0, h);
        for (let k = 0; k <= steps; k++) ctx.lineTo((k / steps) * w, ys[k]);
        ctx.lineTo(w, h); ctx.closePath(); ctx.fillStyle = l.gr; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, ys[0]);
        for (let k = 1; k <= steps; k++) ctx.lineTo((k / steps) * w, ys[k]);
        ctx.strokeStyle = l.edge; g.stroke();
      }
      ctx.restore();
    };
  },
};
