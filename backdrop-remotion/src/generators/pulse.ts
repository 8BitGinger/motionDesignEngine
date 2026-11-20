import type { Generator } from '../engine/types';
import { TAU, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Concentric rings expanding from slowly drifting emitters. */
export const pulse: Generator = {
  name: 'Pulse Circles',
  kind: 'shape',
  controls: [
    { key: 'emitters', label: 'Emitters', min: 1, max: 8, step: 1 },
    { key: 'rings', label: 'Rings each', min: 2, max: 14, step: 1 },
  ],
  make(g) {
    const { ctx, w, h, s, rng, p } = g, maxR = Math.hypot(w, h) * 0.6, R = Math.round(g.o('rings', 6));
    const em = Array.from({ length: Math.round(g.o('emitters', 2 + Math.round(p.density * 2))) }, (_, i) => ({
      x: w * rng.range(0.15, 0.85), y: h * rng.range(0.15, 0.85), sp: g.lq(rng.range(0.08, 0.16), 1 / R), col: g.c(i), ph: rng() * TAU,
    }));
    const dx = g.lq(0.05, TAU, false), dy = g.lq(0.04, TAU, false), beat = g.lq(2);
    return t => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const e of em) {
        const x = e.x + Math.sin(t * dx + e.ph) * w * 0.05, y = e.y + Math.cos(t * dy + e.ph) * h * 0.05;
        for (let k = 0; k < R; k++) {
          const f = mod(t * e.sp + k / R, 1);
          ctx.strokeStyle = rgba(e.col, (1 - f) ** 1.6 * 0.7); ctx.lineWidth = s * (1 + 4 * (1 - f));
          ctx.beginPath(); ctx.arc(x, y, f * maxR, 0, TAU); g.stroke();
        }
        const pr = (6 + 3 * Math.sin(t * beat + e.ph)) * s;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, pr * 6);
        gr.addColorStop(0, rgba(e.col, 0.8)); gr.addColorStop(1, rgba(e.col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, pr * 6, 0, TAU); ctx.fill();
      }
      ctx.restore();
    };
  },
};
