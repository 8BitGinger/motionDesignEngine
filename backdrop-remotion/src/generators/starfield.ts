import type { Generator } from '../engine/types';
import { TAU, hash3, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/**
 * 2D parallax stars (speed ∝ depth) with twinkle and faint drifting nebulae.
 * When looping, each star lives for a whole fraction of the period: it fades in at a hashed position,
 * drifts at its true parallax speed, and fades out, so the sky repeats without speeding anything up.
 */
export const starfield: Generator = {
  name: 'Starfield',
  kind: 'shape',
  controls: [{ key: 'angle', label: 'Direction (°)', min: 0, max: 360, step: 1 }],
  make(g) {
    const { ctx, w, h, s, rng, p } = g, V = 80 * s, loop = g.period > 0;
    const a = (g.o('angle', ((Math.PI + rng.range(-0.3, 0.3)) * 180) / Math.PI) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const stars = Array.from({ length: Math.round(500 * p.density) }, () => {
      const q = {
        x: rng() * w, y: rng() * h, z: rng() ** 2 * 0.9 + 0.1, sz: rng.range(0.6, 2.2), ph: rng() * TAU, tw: rng.range(0.5, 3),
        col: rng() < 0.2 ? g.c(rng.int(0, 4)) : '#ffffff',
      };
      return { ...q, tw: g.lq(q.tw), life: 4 + 6 * (1 - q.z) };
    });
    const neb = Array.from({ length: 3 }, (_, i) => ({ x: rng() * w, y: rng() * h, r: Math.max(w, h) * rng.range(0.3, 0.55), col: g.c(i), ph: rng() * TAU }));
    const n1 = g.lq(0.03, TAU, false), n2 = g.lq(0.025, TAU, false);
    return t => {
      ctx.save();
      for (const n of neb) {
        const x = n.x + Math.sin(t * n1 + n.ph) * w * 0.05, y = n.y + Math.cos(t * n2 + n.ph) * h * 0.05;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, n.r);
        gr.addColorStop(0, rgba(n.col, 0.16)); gr.addColorStop(1, rgba(n.col, 0));
        ctx.fillStyle = gr; ctx.fillRect(x - n.r, y - n.r, n.r * 2, n.r * 2);
      }
      stars.forEach((q, i) => {
        let x: number, y: number, fade = 1;
        if (loop) {
          const [k, u] = g.cyc(t, q.life, q.ph / TAU);
          const hx = hash3(i, k, g.seed), hy = hash3(k, i, g.seed ^ 77);
          x = mod((hx % 10000) / 10000 * w + ca * V * q.z * u * q.life, w);
          y = mod((hy % 10000) / 10000 * h + sa * V * q.z * u * q.life, h);
          fade = Math.sin(Math.PI * u);
        } else {
          x = mod(q.x + ca * V * q.z * t, w); y = mod(q.y + sa * V * q.z * t, h);
        }
        const r = q.sz * q.z * s * 1.6, al = q.z * (0.55 + 0.45 * Math.sin(t * q.tw + q.ph)) * fade;
        if (p.glow && q.z > 0.7) { ctx.fillStyle = rgba(q.col, al * 0.12); ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill(); }
        ctx.fillStyle = rgba(q.col, al);
        if (r < 1.2) ctx.fillRect(x - r, y - r, r * 2, r * 2);
        else { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      });
      ctx.restore();
    };
  },
};
