import type { Generator } from '../engine/types';
import { rgba } from '../engine/ColorEngine';

/** Topographic contour lines of a slowly morphing height field (marching squares). */
export const topo: Generator = {
  name: 'Topographic',
  make(g) {
    const { ctx, w, h, s, noise, p, rng } = g;
    const cell = 16 * s, cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
    const levels = Math.round(9 + 7 * p.density), sc = 1 / (420 * s), ox = rng() * 100, oy = rng() * 100;
    const f = new Float32Array(cols * rows);
    const paths: Path2D[] = [];
    return t => {
      const z = t * 0.06;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = i * cell * sc + ox, y = j * cell * sc + oy;
        // two octaves, remapped to ~[0,1)
        f[j * cols + i] = 0.5 + 0.38 * noise(x, y, z) + 0.2 * noise(x * 2.3 + 7, y * 2.3, z * 1.7);
      }
      paths.length = 0;
      for (let L = 0; L < levels; L++) paths.push(new Path2D());
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = f[j * cols + i], b = f[j * cols + i + 1], c = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
        const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
        const x0 = i * cell, y0 = j * cell;
        for (let L = Math.max(0, Math.ceil(lo * levels)); L <= Math.min(levels - 1, Math.floor(hi * levels)); L++) {
          const v = L / levels;
          const code = (a > v ? 8 : 0) | (b > v ? 4 : 0) | (c > v ? 2 : 0) | (d > v ? 1 : 0);
          if (code === 0 || code === 15) continue;
          // edge crossing points: top, right, bottom, left
          const T = () => [x0 + ((v - a) / (b - a)) * cell, y0];
          const R = () => [x0 + cell, y0 + ((v - b) / (c - b)) * cell];
          const B = () => [x0 + ((v - d) / (c - d)) * cell, y0 + cell];
          const Lf = () => [x0, y0 + ((v - a) / (d - a)) * cell];
          const P = paths[L];
          const seg = (e1: () => number[], e2: () => number[]) => { const p1 = e1(), p2 = e2(); P.moveTo(p1[0], p1[1]); P.lineTo(p2[0], p2[1]); };
          switch (code) {
            case 1: case 14: seg(Lf, B); break;
            case 2: case 13: seg(B, R); break;
            case 3: case 12: seg(Lf, R); break;
            case 4: case 11: seg(T, R); break;
            case 5: seg(Lf, T); seg(B, R); break;
            case 6: case 9: seg(T, B); break;
            case 7: case 8: seg(Lf, T); break;
            case 10: seg(Lf, B); seg(T, R); break;
          }
        }
      }
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      paths.forEach((P, L) => {
        const major = L % 4 === 0;
        ctx.lineWidth = (major ? 2.8 : 1.5) * s;
        ctx.strokeStyle = rgba(g.c(Math.floor((L / levels) * 5)), major ? 1 : 0.65);
        g.stroke(P);
      });
      ctx.restore();
    };
  },
};
