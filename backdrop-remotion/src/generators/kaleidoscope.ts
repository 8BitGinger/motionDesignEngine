import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Moving shapes drawn once per frame into a wedge, then mirrored around the centre. */
export const kaleidoscope: Generator = {
  name: 'Kaleidoscope',
  make(g) {
    const { ctx, w, h, s, rng, p } = g;
    const S = 2 * rng.int(3, 7), A = TAU / S, R = Math.hypot(w, h) / 2 + 4;
    // The wedge only needs a buffer as big as its bounding box: radius R, angle 0..A.
    const bw = Math.ceil(R), bh = Math.ceil(R * Math.sin(Math.min(A, Math.PI / 2))) + 2;
    const buf = document.createElement('canvas'); buf.width = bw; buf.height = bh;
    const b = buf.getContext('2d')!;
    const N = Math.round(22 + 16 * p.density);
    const shapes = Array.from({ length: N }, () => ({
      r: Math.pow(rng(), 1.4) * R * 0.8, ar: rng.range(0.05, 0.2) * R, a: rng(), sp: rng.range(-0.08, 0.08), ap: rng() * TAU, af: rng.range(0.2, 0.6),
      size: rng.range(30, 150) * s, kind: rng.int(0, 2), c: rng.int(0, 4), rs: rng.range(-1, 1), fill: rng() < 0.5,
    }));
    const wedge = new Path2D(); wedge.moveTo(0, 0); wedge.arc(0, 0, R, -0.002, A + 0.002); wedge.closePath();
    return t => {
      b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, bw, bh);
      b.save(); b.clip(wedge); b.lineWidth = 3 * s; b.lineJoin = 'round';
      for (const q of shapes) {
        const r = q.r + Math.sin(t * q.af + q.ap) * q.ar, a = (((q.a + t * q.sp) % 1) + 1) % 1 * A;
        const x = Math.cos(a) * r, y = Math.sin(a) * r, z = q.size * (0.8 + 0.3 * Math.sin(t * 0.7 + q.ap));
        b.setTransform(Math.cos(t * q.rs), Math.sin(t * q.rs), -Math.sin(t * q.rs), Math.cos(t * q.rs), x, y);
        b.beginPath();
        if (q.kind === 0) b.arc(0, 0, z, 0, TAU);
        else if (q.kind === 1) { b.moveTo(0, -z); b.lineTo(z * 0.87, z * 0.5); b.lineTo(-z * 0.87, z * 0.5); b.closePath(); }
        else b.rect(-z * 0.7, -z * 0.18, z * 1.4, z * 0.36);
        if (q.fill) { b.fillStyle = rgba(g.c(q.c), 0.32); b.fill(); }
        b.strokeStyle = rgba(g.c(q.c), 0.85); g.stroke(null, b);
      }
      b.restore();
      const cx = w / 2, cy = h / 2, spin = t * 0.04;
      ctx.save();
      for (let k = 0; k < S; k++) {
        const a = spin + k * A, ca = Math.cos(a), sa = Math.sin(a), m = k % 2 ? -1 : 1;
        // odd segments are mirrored, and rotated by an extra A so the mirrored edge lines up
        if (m > 0) ctx.setTransform(ca, sa, -sa, ca, cx, cy);
        else { const a2 = a + A, c2 = Math.cos(a2), s2 = Math.sin(a2); ctx.setTransform(c2, s2, s2, -c2, cx, cy); }
        ctx.drawImage(buf, 0, 0);
      }
      ctx.restore();
    };
  },
};
