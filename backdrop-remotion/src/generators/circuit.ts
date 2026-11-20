import type { Generator } from '../engine/types';
import { TAU, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** PCB traces (drawn once into a buffer) with light pulses travelling along them. */
export const circuit: Generator = {
  name: 'Circuit Board',
  kind: 'shape',
  controls: [{ key: 'grid', label: 'Grid size', min: 12, max: 64, step: 1 }],
  make(g) {
    const { ctx, w, h, s, rng, p } = g;
    const step = g.o('grid', 28) * s, cols = Math.floor(w / step), rows = Math.floor(h / step);
    const used = new Uint8Array((cols + 1) * (rows + 1));
    const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    type Trace = { pts: number[]; cum: number[]; len: number; c: number };
    const traces: Trace[] = [];
    const T = Math.round(70 * p.density);
    for (let n = 0; n < T * 3 && traces.length < T; n++) {
      let x = rng.int(0, cols), y = rng.int(0, rows);
      if (used[y * (cols + 1) + x]) continue;
      let dir = rng.int(0, 3) * 2; // start orthogonal
      const pts = [x, y]; used[y * (cols + 1) + x] = 1;
      const L = rng.int(4, 24);
      for (let k = 0; k < L; k++) {
        if (rng() < 0.25) dir = mod(dir + (rng() < 0.5 ? 1 : -1), 8); // 45° turns
        const nx = x + DIRS[dir][0], ny = y + DIRS[dir][1];
        if (nx < 0 || ny < 0 || nx > cols || ny > rows || used[ny * (cols + 1) + nx]) break;
        x = nx; y = ny; used[y * (cols + 1) + x] = 1; pts.push(x, y);
      }
      if (pts.length < 6) continue;
      const px = pts.map((v, i) => (v + 0.5) * step + (i % 2 ? (h - rows * step) / 2 - step / 2 : (w - cols * step) / 2 - step / 2));
      const cum = [0];
      for (let i = 2; i < px.length; i += 2) cum.push(cum[cum.length - 1] + Math.hypot(px[i] - px[i - 2], px[i + 1] - px[i - 1]));
      traces.push({ pts: px, cum, len: cum[cum.length - 1], c: rng.int(0, 4) });
    }
    const { buf, bctx } = g.buffer();
    bctx.lineCap = 'round'; bctx.lineJoin = 'round';
    for (const tr of traces) {
      bctx.strokeStyle = rgba(g.c(tr.c), 0.38); bctx.lineWidth = 2.4 * s; bctx.beginPath();
      for (let i = 0; i < tr.pts.length; i += 2) i ? bctx.lineTo(tr.pts[i], tr.pts[i + 1]) : bctx.moveTo(tr.pts[i], tr.pts[i + 1]);
      bctx.stroke();
      bctx.fillStyle = rgba(g.c(tr.c), 0.8);
      for (const i of [0, tr.pts.length - 2]) { bctx.beginPath(); bctx.arc(tr.pts[i], tr.pts[i + 1], 3.2 * s, 0, TAU); bctx.fill(); }
    }
    const pulses = traces.map(tr => {
      const q = { tr, v: rng.range(80, 220) * s, off: rng() * 10, tail: rng.range(30, 90) * s, gap: rng.range(0.6, 2.5) };
      const cycle = tr.len + q.tail + q.gap * q.v;
      // Looping: the pulse speed is nudged so it completes whole trips per period.
      return { ...q, cycle, vt: g.lq(q.v, cycle) };
    });
    const at = (tr: Trace, d: number) => {
      let i = 1; while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
      const a = tr.cum[i - 1], b = tr.cum[i], f = b > a ? (d - a) / (b - a) : 0, k = (i - 1) * 2;
      return [tr.pts[k] + (tr.pts[k + 2] - tr.pts[k]) * f, tr.pts[k + 1] + (tr.pts[k + 3] - tr.pts[k + 1]) * f];
    };
    return t => {
      ctx.drawImage(buf, 0, 0);
      ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 3.2 * s;
      for (const q of pulses) {
        const head = mod(q.off * q.v + t * q.vt, q.cycle);
        if (head - q.tail > q.tr.len) continue;
        const d0 = Math.max(0, head - q.tail), d1 = Math.min(q.tr.len, head);
        if (d1 <= d0) continue;
        ctx.beginPath();
        const N = 8;
        for (let k = 0; k <= N; k++) { const pt = at(q.tr, d0 + ((d1 - d0) * k) / N); k ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]); }
        ctx.strokeStyle = rgba(g.c(q.tr.c), 0.95); g.stroke();
        const hp = at(q.tr, d1);
        ctx.fillStyle = rgba('#ffffff', 0.85); ctx.beginPath(); ctx.arc(hp[0], hp[1], 2.4 * s, 0, TAU); ctx.fill();
      }
      ctx.restore();
    };
  },
};
