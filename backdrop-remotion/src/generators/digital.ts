import type { Generator } from '../engine/types';
import { TAU, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Tech grid: data packets racing along lines, blinking nodes and a slow scan band. */
export const digital: Generator = {
  name: 'Digital Grid',
  make(g) {
    const { ctx, w, h, s, rng, p } = g;
    const cell = (72 * s) / Math.sqrt(p.density), cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
    const ox = (w - (cols - 1) * cell) / 2, oy = (h - (rows - 1) * cell) / 2;
    const grid = new Path2D();
    for (let c = 0; c < cols; c++) { grid.moveTo(ox + c * cell, 0); grid.lineTo(ox + c * cell, h); }
    for (let r = 0; r < rows; r++) { grid.moveTo(0, oy + r * cell); grid.lineTo(w, oy + r * cell); }
    const nodes = Array.from({ length: 50 }, () => ({ c: rng.int(0, cols - 1), r: rng.int(0, rows - 1), sp: rng.range(0.3, 1.2), ph: rng() * TAU, col: g.c(rng.int(0, 2)) }));
    const packets = Array.from({ length: Math.round(26 * p.density) + 6 }, (_, i) => {
      const horiz = rng() < 0.5;
      return {
        horiz, line: horiz ? rng.int(0, rows - 1) : rng.int(0, cols - 1), sp: rng.range(1.5, 5) * cell, dir: rng() < 0.5 ? -1 : 1,
        len: rng.range(1.5, 4) * cell, off: rng() * 5000 * s, col: g.c(i % 3),
      };
    });
    return t => {
      ctx.save(); ctx.lineWidth = s; ctx.strokeStyle = rgba(g.c(0), 0.15); ctx.stroke(grid);
      const sy = mod(t * h * 0.12, h * 1.4) - h * 0.2, band = ctx.createLinearGradient(0, sy - h * 0.12, 0, sy + h * 0.12);
      band.addColorStop(0, rgba(g.c(1), 0)); band.addColorStop(0.5, rgba(g.c(1), 0.07)); band.addColorStop(1, rgba(g.c(1), 0));
      ctx.fillStyle = band; ctx.fillRect(0, sy - h * 0.12, w, h * 0.24);
      for (const n of nodes) {
        const a = Math.max(0, Math.sin(t * n.sp + n.ph)) ** 6;
        if (a < 0.02) continue;
        const x = ox + n.c * cell, y = oy + n.r * cell, sz = 5 * s;
        ctx.fillStyle = rgba(n.col, a); ctx.fillRect(x - sz, y - sz, sz * 2, sz * 2);
        ctx.strokeStyle = rgba(n.col, a * 0.5); ctx.strokeRect(x - sz * 2.5, y - sz * 2.5, sz * 5, sz * 5);
      }
      ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
      for (const q of packets) {
        const span = (q.horiz ? w : h) + q.len * 2, pos = mod(q.off + q.sp * q.dir * t, span) - q.len, tail = pos - q.dir * q.len;
        const fixed = q.horiz ? oy + q.line * cell : ox + q.line * cell;
        const [x1, y1, x2, y2] = q.horiz ? [tail, fixed, pos, fixed] : [fixed, tail, fixed, pos];
        const gr = ctx.createLinearGradient(x1, y1, x2, y2);
        gr.addColorStop(0, rgba(q.col, 0)); gr.addColorStop(1, rgba(q.col, 0.95));
        ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); g.stroke();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x2 - 2 * s, y2 - 2 * s, 4 * s, 4 * s);
      }
      ctx.restore();
    };
  },
};
