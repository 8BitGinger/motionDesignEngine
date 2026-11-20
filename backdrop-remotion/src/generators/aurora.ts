import type { Generator } from '../engine/types';
import { clamp } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Curtain-like bands: one cached vertical gradient per band, stamped as thin translated strips. */
export const aurora: Generator = {
  name: 'Aurora Waves',
  kind: 'shape',
  controls: [{ key: 'bands', label: 'Bands', min: 1, max: 12, step: 1 }],
  make(g) {
    const { ctx, w, h, rng, p } = g;
    const n = Math.round(g.o('bands', 3 + 2 * p.density)), steps = 360, sw = w / steps;
    const bands = Array.from({ length: n }, (_, i) => {
      const th = h * rng.range(0.16, 0.34), col = g.c(i);
      const grad = ctx.createLinearGradient(0, 0, 0, th);
      grad.addColorStop(0, rgba(col, 0)); grad.addColorStop(0.55, rgba(col, 0.55));
      grad.addColorStop(0.78, rgba(col, 0.2)); grad.addColorStop(1, rgba(col, 0));
      const sp = rng.range(0.06, 0.16);
      return { y: h * rng.range(0.2, 0.65), amp: h * rng.range(0.08, 0.18), th, f: rng.range(0.8, 2), sp, ph: rng() * 100, grad, wv: g.lq(sp * 4) };
    });
    return t => {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (const b of bands) {
        ctx.fillStyle = b.grad;
        for (let k = 0; k < steps; k++) {
          const x = k / steps;
          const y = b.y + g.tn(x * b.f, b.ph, t, b.sp) * b.amp * 2 + Math.sin(x * Math.PI * b.f + t * b.wv + b.ph) * b.amp * 0.6;
          ctx.globalAlpha = clamp(0.45 + 1.1 * g.tn(x * 4, b.ph + 5, t, b.sp * 3), 0, 1) * clamp(0.65 + 0.8 * g.tn(x * 16, b.ph + 9, t, 0.4), 0, 1);
          const x0 = Math.round(k * sw), x1 = Math.round((k + 1) * sw);
          ctx.setTransform(1, 0, 0, 1, x0, y - b.th * 0.5);
          ctx.fillRect(0, 0, x1 - x0, b.th);
        }
      }
      ctx.restore();
    };
  },
};
