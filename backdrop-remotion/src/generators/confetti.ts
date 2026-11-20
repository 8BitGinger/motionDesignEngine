import type { Generator } from '../engine/types';
import { TAU, mod } from '../engine/rng';

/** Falling confetti that sways and flips (3D flip faked with a cosine scale). */
export const confetti: Generator = {
  name: 'Confetti',
  kind: 'shape',
  controls: [{ key: 'size', label: 'Piece size', min: 0.3, max: 3, step: 0.05 }],
  make(g) {
    const { ctx, w, h, s, rng, p } = g;
    const N = Math.round(220 * p.density), M = 40 * s, size = g.o('size', 1);
    const bits = Array.from({ length: N }, () => {
      const b = {
        x: rng(), y: rng(), v: rng.range(60, 160) * s, sw: rng.range(10, 50) * s, sf: rng.range(0.4, 1.4), ph: rng() * TAU,
        rot: rng() * TAU, vr: rng.range(-2, 2), flip: rng.range(1.5, 5), fw: rng.range(14, 30) * s * size, fh: rng.range(7, 14) * s * size,
        c: rng.int(0, 4), round: rng() < 0.25,
      };
      // Looping: whole falls per period, whole sway/flip/spin cycles.
      return { ...b, v: g.lq(b.v, h + 2 * M), sf: g.lq(b.sf), flip: g.lq(b.flip), vr: g.lq(b.vr) };
    });
    return t => {
      ctx.save();
      for (const b of bits) {
        const x = mod(b.x * (w + 2 * M) + Math.sin(t * b.sf + b.ph) * b.sw, w + 2 * M) - M;
        const y = mod(b.y * (h + 2 * M) + b.v * t, h + 2 * M) - M;
        const fl = Math.cos(t * b.flip + b.ph), a = b.rot + t * b.vr;
        const ca = Math.cos(a), sa = Math.sin(a);
        ctx.setTransform(ca, sa, -sa * fl, ca * fl, x, y);
        ctx.fillStyle = g.c(b.c);
        ctx.globalAlpha = 0.55 + 0.45 * Math.abs(fl); // darker when edge-on
        if (b.round) { ctx.beginPath(); ctx.arc(0, 0, b.fh, 0, TAU); ctx.fill(); }
        else ctx.fillRect(-b.fw / 2, -b.fh / 2, b.fw, b.fh);
      }
      ctx.restore();
    };
  },
};
