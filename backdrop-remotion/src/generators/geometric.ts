import type { Generator } from '../engine/types';
import { TAU, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Drifting, rotating polygons (3–6 sides), largest drawn first. */
export const geometric: Generator = {
  name: 'Geometric Drift',
  make(g) {
    const { ctx, w, h, s, rng, p } = g, M = 130 * s;
    const shapes = Array.from({ length: Math.round(36 * p.density) + 8 }, (_, i) => ({
      x: rng() * (w + 2 * M), y: rng() * (h + 2 * M), vx: rng.range(-25, 25) * s, vy: rng.range(-25, 25) * s, sz: rng.range(18, 110) * s,
      sides: rng.int(3, 6), rot: rng() * TAU, vr: rng.range(-0.4, 0.4), col: g.c(i), fill: rng() < 0.4, al: rng.range(0.2, 0.7), lw: rng.range(1, 3) * s,
    })).sort((a, b) => b.sz - a.sz);
    return t => {
      ctx.save();
      for (const q of shapes) {
        const x = mod(q.x + q.vx * t, w + 2 * M) - M, y = mod(q.y + q.vy * t, h + 2 * M) - M, a0 = q.rot + q.vr * t;
        ctx.beginPath();
        for (let k = 0; k < q.sides; k++) {
          const a = a0 + (k / q.sides) * TAU;
          if (k) ctx.lineTo(x + Math.cos(a) * q.sz, y + Math.sin(a) * q.sz); else ctx.moveTo(x + Math.cos(a) * q.sz, y + Math.sin(a) * q.sz);
        }
        ctx.closePath();
        if (q.fill) { ctx.fillStyle = rgba(q.col, q.al * 0.35); ctx.fill(); }
        else { ctx.strokeStyle = rgba(q.col, q.al); ctx.lineWidth = q.lw; g.stroke(); }
      }
      ctx.restore();
    };
  },
};
