import type { Generator } from '../engine/types';
import { TAU, makeRng, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Drifting, rotating polygons, largest drawn first. When looping, shapes wander around a home position. */
export const geometric: Generator = {
  name: 'Geometric Drift',
  kind: 'shape',
  controls: [
    { key: 'sides', label: 'Sides (0 = mixed)', min: 0, max: 8, step: 1 },
    { key: 'size', label: 'Size', min: 0.3, max: 2.5, step: 0.05 },
  ],
  make(g) {
    const { ctx, w, h, s, rng, p } = g, M = 130 * s, loop = g.period > 0, r2 = makeRng(g.seed ^ 0x6e0);
    const fixedSides = Math.round(g.o('sides', 0)), size = g.o('size', 1);
    const shapes = Array.from({ length: Math.round(36 * p.density) + 8 }, (_, i) => {
      const q = {
        x: rng() * (w + 2 * M), y: rng() * (h + 2 * M), vx: rng.range(-25, 25) * s, vy: rng.range(-25, 25) * s, sz: rng.range(18, 110) * s * size,
        sides: rng.int(3, 6), rot: rng() * TAU, vr: rng.range(-0.4, 0.4), col: g.c(i), fill: rng() < 0.4, al: rng.range(0.2, 0.7), lw: rng.range(1, 3) * s,
      };
      if (fixedSides >= 3) q.sides = fixedSides;
      const ax = r2.range(60, 180) * s, ay = r2.range(60, 180) * s;
      return {
        ...q, ax, ay, wx: g.lq(Math.max(0.05, Math.abs(q.vx) / ax)), wy: g.lq(Math.max(0.05, Math.abs(q.vy) / ay)),
        px: r2() * TAU, py: r2() * TAU, wr: g.lq(q.vr, TAU / q.sides),
      };
    }).sort((a, b) => b.sz - a.sz);
    return t => {
      ctx.save();
      for (const q of shapes) {
        const x = loop ? mod(q.x + Math.sin(t * q.wx + q.px) * q.ax, w + 2 * M) - M : mod(q.x + q.vx * t, w + 2 * M) - M;
        const y = loop ? mod(q.y + Math.sin(t * q.wy + q.py) * q.ay, h + 2 * M) - M : mod(q.y + q.vy * t, h + 2 * M) - M;
        const a0 = q.rot + q.wr * t;
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
