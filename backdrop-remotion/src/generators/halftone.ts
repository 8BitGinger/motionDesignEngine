import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Rotated halftone dot screen whose dot sizes follow a drifting noise field. */
export const halftone: Generator = {
  name: 'Halftone',
  make(g) {
    const { ctx, w, h, s, rng, noise, p } = g;
    const cell = (30 / Math.sqrt(p.density)) * s, ang = rng.range(0.15, 0.6), ca = Math.cos(ang), sa = Math.sin(ang);
    const D = Math.hypot(w, h), n = Math.ceil(D / cell) + 2, sc = 1 / (520 * s), sq = rng() < 0.3;
    const paths: Path2D[] = [];
    return t => {
      paths.length = 0;
      for (let c = 0; c < 5; c++) paths.push(new Path2D());
      const dx = t * 18 * s, z = t * 0.07;
      for (let j = -n / 2; j < n / 2; j++) for (let i = -n / 2; i < n / 2; i++) {
        const gx = i * cell, gy = j * cell;
        const x = w / 2 + gx * ca - gy * sa, y = h / 2 + gx * sa + gy * ca;
        if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
        const v = noise((x + dx) * sc, y * sc, z) * 0.75 + noise((x - dx) * sc * 2.6, y * sc * 2.6, z * 1.3) * 0.35;
        const r = Math.max(0, (v + 0.55) * 0.55) * cell * 0.62;
        if (r < 0.5 * s) continue;
        const k = Math.min(4, Math.max(0, Math.floor((v + 0.6) * 3.5)));
        const P = paths[k];
        if (sq) P.rect(x - r, y - r, r * 2, r * 2);
        else { P.moveTo(x + r, y); P.arc(x, y, r, 0, TAU); }
      }
      ctx.save();
      paths.forEach((P, k) => { ctx.fillStyle = rgba(g.c(k), 0.55 + k * 0.1); ctx.fill(P); });
      if (p.glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.fillStyle = rgba(g.c(4), 1); ctx.fill(paths[4]); }
      ctx.restore();
    };
  },
};
