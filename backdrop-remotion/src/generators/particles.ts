import type { Generator } from '../engine/types';
import { TAU, makeRng, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/**
 * Drifting points joined by proximity lines. Positions are a pure function of t.
 * When looping, points wander around a home position instead of drifting off (a straight drift can't repeat).
 */
export const particles: Generator = {
  name: 'Particle Flow',
  kind: 'shape',
  controls: [{ key: 'link', label: 'Link distance', min: 0.04, max: 0.35, step: 0.01 }],
  make(g) {
    const { ctx, w, h, s, rng, p } = g, N = Math.round(110 * p.density), M = 40 * s, loop = g.period > 0;
    const r2 = makeRng(g.seed ^ 0x5151);
    const pts = Array.from({ length: N }, () => {
      const q = { x: rng() * (w + 2 * M), y: rng() * (h + 2 * M), vx: rng.range(-30, 30) * s, vy: rng.range(-30, 30) * s, r: rng.range(1.2, 3) * s, c: rng.int(0, 2) };
      const ax = r2.range(40, 140) * s, ay = r2.range(40, 140) * s;
      return { ...q, ax, ay, wx: g.lq(Math.max(0.05, Math.abs(q.vx) / ax)), wy: g.lq(Math.max(0.05, Math.abs(q.vy) / ay)), px: r2() * TAU, py: r2() * TAU };
    });
    const D = Math.min(w, h) * g.o('link', 0.16), D2 = D * D, xs = new Float32Array(N), ys = new Float32Array(N);
    return t => {
      for (let i = 0; i < N; i++) {
        const q = pts[i];
        if (loop) { xs[i] = mod(q.x + Math.sin(t * q.wx + q.px) * q.ax, w + 2 * M) - M; ys[i] = mod(q.y + Math.sin(t * q.wy + q.py) * q.ay, h + 2 * M) - M; }
        else { xs[i] = mod(q.x + q.vx * t, w + 2 * M) - M; ys[i] = mod(q.y + q.vy * t, h + 2 * M) - M; }
      }
      // bucket links by opacity so we stroke 5 paths instead of hundreds
      const buckets: number[][] = [[], [], [], [], []];
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = xs[i] - xs[j], dy = ys[i] - ys[j], d2 = dx * dx + dy * dy;
        if (d2 < D2) buckets[Math.min(4, Math.floor((1 - Math.sqrt(d2) / D) * 5))].push(i, j);
      }
      ctx.save(); ctx.lineWidth = 1.4 * s;
      buckets.forEach((b, k) => {
        if (!b.length) return;
        ctx.beginPath();
        for (let q = 0; q < b.length; q += 2) { ctx.moveTo(xs[b[q]], ys[b[q]]); ctx.lineTo(xs[b[q + 1]], ys[b[q + 1]]); }
        ctx.strokeStyle = rgba(g.c(0), ((k + 1) / 5) * 0.75); g.stroke();
      });
      for (let c = 0; c < 3; c++) {
        ctx.beginPath();
        for (let i = 0; i < N; i++) if (pts[i].c === c) { ctx.moveTo(xs[i] + pts[i].r, ys[i]); ctx.arc(xs[i], ys[i], pts[i].r, 0, TAU); }
        ctx.fillStyle = rgba(g.c(c + 1), 0.95); ctx.fill();
        if (p.glow) {
          ctx.beginPath();
          for (let i = 0; i < N; i++) if (pts[i].c === c) { ctx.moveTo(xs[i] + pts[i].r * 4, ys[i]); ctx.arc(xs[i], ys[i], pts[i].r * 4, 0, TAU); }
          ctx.fillStyle = rgba(g.c(c + 1), 0.12); ctx.fill();
        }
      }
      ctx.restore();
    };
  },
};
