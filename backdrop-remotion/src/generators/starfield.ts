import type { Generator } from '../engine/types';
import { TAU, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** 2D parallax stars (speed ∝ depth) with twinkle and faint drifting nebulae. */
export const starfield: Generator = {
  name: 'Starfield',
  make(g) {
    const { ctx, w, h, s, rng, p } = g, a = Math.PI + rng.range(-0.3, 0.3), V = 80 * s;
    const stars = Array.from({ length: Math.round(500 * p.density) }, () => ({
      x: rng() * w, y: rng() * h, z: rng() ** 2 * 0.9 + 0.1, sz: rng.range(0.6, 2.2), ph: rng() * TAU, tw: rng.range(0.5, 3),
      col: rng() < 0.2 ? g.c(rng.int(0, 4)) : '#ffffff',
    }));
    const neb = Array.from({ length: 3 }, (_, i) => ({ x: rng() * w, y: rng() * h, r: Math.max(w, h) * rng.range(0.3, 0.55), col: g.c(i), ph: rng() * TAU }));
    return t => {
      ctx.save();
      for (const n of neb) {
        const x = n.x + Math.sin(t * 0.03 + n.ph) * w * 0.05, y = n.y + Math.cos(t * 0.025 + n.ph) * h * 0.05;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, n.r);
        gr.addColorStop(0, rgba(n.col, 0.16)); gr.addColorStop(1, rgba(n.col, 0));
        ctx.fillStyle = gr; ctx.fillRect(x - n.r, y - n.r, n.r * 2, n.r * 2);
      }
      for (const q of stars) {
        const x = mod(q.x + Math.cos(a) * V * q.z * t, w), y = mod(q.y + Math.sin(a) * V * q.z * t, h), r = q.sz * q.z * s * 1.6;
        const al = q.z * (0.55 + 0.45 * Math.sin(t * q.tw + q.ph));
        if (p.glow && q.z > 0.7) { ctx.fillStyle = rgba(q.col, al * 0.12); ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill(); }
        ctx.fillStyle = rgba(q.col, al);
        if (r < 1.2) ctx.fillRect(x - r, y - r, r * 2, r * 2);
        else { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      }
      ctx.restore();
    };
  },
};
