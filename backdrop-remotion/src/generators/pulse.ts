import type { Generator } from '../engine/types';
import { TAU, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Concentric rings expanding from slowly drifting emitters. */
export const pulse: Generator = {
  name: 'Pulse Circles',
  make(g) {
    const { ctx, w, h, s, rng, p } = g, maxR = Math.hypot(w, h) * 0.6, R = 6;
    const em = Array.from({ length: 2 + Math.round(p.density * 2) }, (_, i) => ({
      x: w * rng.range(0.15, 0.85), y: h * rng.range(0.15, 0.85), sp: rng.range(0.08, 0.16), col: g.c(i), ph: rng() * TAU,
    }));
    return t => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const e of em) {
        const x = e.x + Math.sin(t * 0.05 + e.ph) * w * 0.05, y = e.y + Math.cos(t * 0.04 + e.ph) * h * 0.05;
        for (let k = 0; k < R; k++) {
          const f = mod(t * e.sp + k / R, 1);
          ctx.strokeStyle = rgba(e.col, (1 - f) ** 1.6 * 0.7); ctx.lineWidth = s * (1 + 4 * (1 - f));
          ctx.beginPath(); ctx.arc(x, y, f * maxR, 0, TAU); g.stroke();
        }
        const pr = (6 + 3 * Math.sin(t * 2 + e.ph)) * s;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, pr * 6);
        gr.addColorStop(0, rgba(e.col, 0.8)); gr.addColorStop(1, rgba(e.col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, pr * 6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    };
  },
};
