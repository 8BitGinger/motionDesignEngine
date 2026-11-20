import type { Generator } from '../engine/types';
import { rgba } from '../engine/ColorEngine';

/** Bundles of flowing curves that fan out in the middle and pinch at the edges. */
export const lines: Generator = {
  name: 'Abstract Lines',
  kind: 'shape',
  controls: [
    { key: 'bundles', label: 'Bundles', min: 1, max: 4, step: 1 },
    { key: 'spread', label: 'Spread', min: 0.2, max: 3, step: 0.05 },
  ],
  make(g) {
    const { ctx, w, h, s, rng, p } = g, N = Math.round(18 + 18 * p.density), steps = 80;
    const nb = Math.round(g.o('bundles', rng.int(1, 2))), spread = g.o('spread', 1);
    const bundles = Array.from({ length: nb }, (_, b) => {
      const gr = ctx.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, rgba(g.c(b * 2), 0.9)); gr.addColorStop(1, rgba(g.c(b * 2 + 1), 0.9));
      const v = rng.range(0.15, 0.4);
      return {
        cy: h * rng.range(0.3, 0.7), spread: h * rng.range(0.15, 0.35) * spread, A: h * rng.range(0.08, 0.2), f1: rng.range(0.5, 1.5), f2: rng.range(1.5, 3),
        v1: g.lq(v), v2: g.lq(v * 0.7), ph: rng() * 10, tilt: rng.range(-0.15, 0.15) * h, gr,
      };
    });
    return t => {
      ctx.save(); ctx.lineWidth = 1.2 * s;
      for (const B of bundles) {
        ctx.strokeStyle = B.gr;
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1) - 0.5;
          ctx.beginPath();
          for (let k = 0; k <= steps; k++) {
            const x = -0.05 + (1.1 * k) / steps;
            const y = B.cy + B.tilt * (x - 0.5) * 2 + u * B.spread * (0.35 + 0.65 * Math.sin(x * Math.PI))
              + B.A * Math.sin(x * Math.PI * B.f1 + t * B.v1 + u * 1.2 + B.ph)
              + B.A * 0.4 * Math.sin(x * Math.PI * B.f2 - t * B.v2 + u * 2.5);
            if (k) ctx.lineTo(x * w, y); else ctx.moveTo(x * w, y);
          }
          ctx.globalAlpha = 0.25 + 0.55 * (1 - Math.abs(u) * 2);
          g.stroke();
        }
      }
      ctx.restore();
    };
  },
};
