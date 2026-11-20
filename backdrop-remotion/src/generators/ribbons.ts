import type { Generator } from '../engine/types';
import { mixHex, rgba } from '../engine/ColorEngine';

/** Twisting ribbons built from parallel strands; a signed half-width gives the 3D twist. */
export const ribbons: Generator = {
  name: 'Ribbon Paths',
  kind: 'shape',
  controls: [
    { key: 'ribbons', label: 'Ribbons', min: 1, max: 6, step: 1 },
    { key: 'strands', label: 'Strands', min: 6, max: 60, step: 1 },
  ],
  make(g) {
    const { ctx, w, h, s, rng, p } = g, strands = Math.round(g.o('strands', 28)), steps = 90;
    const rib = Array.from({ length: Math.round(g.o('ribbons', 1 + Math.round(p.density * 1.5))) }, (_, i) => {
      const v = rng.range(0.15, 0.35);
      return {
        cy: h * rng.range(0.25, 0.75), A: h * rng.range(0.1, 0.22), f: rng.range(0.5, 1.2), v1: g.lq(v), v2: g.lq(v * 1.4), W: h * rng.range(0.05, 0.12),
        ft: rng.range(0.6, 1.6), vt: g.lq(rng.range(0.2, 0.5)), ph: rng() * 10,
        cols: Array.from({ length: strands }, (_, j) => rgba(mixHex(g.c(i), g.c(i + 1), j / Math.max(1, strands - 1)), 0.28)),
      };
    });
    const yc = new Float32Array(steps + 1), hw = new Float32Array(steps + 1);
    return t => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = s;
      for (const R of rib) {
        for (let k = 0; k <= steps; k++) {
          const x = -0.05 + (1.1 * k) / steps;
          yc[k] = R.cy + R.A * Math.sin(x * Math.PI * R.f + t * R.v1 + R.ph) + R.A * 0.35 * Math.sin(x * Math.PI * R.f * 2.6 - t * R.v2);
          hw[k] = R.W * Math.sin(x * Math.PI * R.ft + t * R.vt + R.ph);
        }
        for (let j = 0; j < strands; j++) {
          const u = (j / Math.max(1, strands - 1)) * 2 - 1;
          ctx.beginPath();
          for (let k = 0; k <= steps; k++) {
            const x = (-0.05 + (1.1 * k) / steps) * w, y = yc[k] + hw[k] * u;
            if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.strokeStyle = R.cols[j]; g.stroke();
        }
      }
      ctx.restore();
    };
  },
};
