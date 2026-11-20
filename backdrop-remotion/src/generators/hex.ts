import type { Generator } from '../engine/types';
import { TAU, clamp } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Hex lattice lit by wavefronts radiating from three drifting centres. */
export const hex: Generator = {
  name: 'Hex Grid Pulse',
  kind: 'shape',
  controls: [{ key: 'size', label: 'Cell size', min: 16, max: 140, step: 1 }],
  make(g) {
    const { ctx, w, h, s, rng, p } = g;
    const R = g.o('size', 46 / Math.sqrt(p.density)) * s, dx = Math.sqrt(3) * R, dy = 1.5 * R;
    const cells: { x: number; y: number; row: number; col: number }[] = [];
    for (let row = -1; row * dy < h + R; row++)
      for (let col = -1; col * dx < w + dx; col++) cells.push({ x: col * dx + (row & 1 ? dx / 2 : 0), y: row * dy, row, col });
    const hexPath = new Path2D();
    for (let k = 0; k <= 6; k++) {
      const a = (TAU * k) / 6 + Math.PI / 6;
      if (k) hexPath.lineTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); else hexPath.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9);
    }
    const all = new Path2D();
    for (const c of cells) all.addPath(hexPath, new DOMMatrix([1, 0, 0, 1, c.x, c.y]));
    const centers = Array.from({ length: 3 }, (_, i) => ({ x: w * rng(), y: h * rng(), k: rng.range(0.8, 1.4), ph: rng() * TAU, c: g.c(i) }));
    const dX = g.lq(0.1, TAU, false), dY = g.lq(0.08, TAU, false), wave = g.lq(1.6);
    return t => {
      ctx.save(); ctx.lineWidth = s; ctx.strokeStyle = rgba(g.c(0), 0.12); ctx.stroke(all);
      const cs = centers.map(c => ({ ...c, x: c.x + Math.sin(t * dX + c.ph) * w * 0.15, y: c.y + Math.cos(t * dY + c.ph) * h * 0.15 }));
      ctx.lineWidth = 1.5 * s;
      for (const cell of cells) {
        let best = 0, bc = cs[0].c;
        for (const c of cs) {
          const v = (0.5 + 0.5 * Math.sin((Math.hypot(cell.x - c.x, cell.y - c.y) / (R * 3)) * c.k - t * wave + c.ph)) ** 8;
          if (v > best) { best = v; bc = c.c; }
        }
        best = clamp(best + Math.max(0, g.tn(cell.col * 0.3, cell.row * 0.3, t, 0.5) - 0.25) * 1.4, 0, 1);
        if (best > 0.03) {
          ctx.setTransform(1, 0, 0, 1, cell.x, cell.y);
          ctx.fillStyle = rgba(bc, best * 0.45); ctx.fill(hexPath);
          ctx.strokeStyle = rgba(bc, best * 0.9); g.stroke(hexPath);
        }
      }
      ctx.restore();
    };
  },
};
