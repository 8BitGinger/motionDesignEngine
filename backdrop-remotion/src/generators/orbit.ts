import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Concentric HUD rings: dashed arcs, tick rings and orbiting dots at independent speeds. */
export const orbit: Generator = {
  name: 'Orbit Rings',
  kind: 'shape',
  controls: [{ key: 'rings', label: 'Rings', min: 3, max: 30, step: 1 }],
  make(g) {
    const { ctx, w, h, s, rng, p } = g, m = Math.min(w, h);
    const cx = w * rng.range(0.35, 0.65), cy = h * rng.range(0.35, 0.65), n = Math.round(g.o('rings', 8 + 6 * p.density));
    const rings = Array.from({ length: n }, (_, i) => {
      const R = {
        r: m * (0.06 + (i * 0.44) / n) + m * rng.range(-0.01, 0.01), lw: s * rng.pick([1, 1, 1.5, 2, 4, 8]),
        dash: rng() < 0.5 ? [] : [rng.range(2, 30) * s, rng.range(4, 30) * s], a0: rng() * TAU, sweep: rng() < 0.4 ? TAU : rng.range(0.6, 4.5),
        sp: rng.range(0.05, 0.4) * (rng() < 0.5 ? -1 : 1), col: g.c(i), al: rng.range(0.25, 0.85), dots: rng() < 0.35 ? rng.int(1, 3) : 0, ticks: rng() < 0.2,
      };
      return { ...R, w1: g.lq(R.sp), w2: g.lq(R.sp * 1.5) };
    });
    return t => {
      ctx.save(); ctx.translate(cx, cy);
      for (const R of rings) {
        ctx.save(); ctx.rotate(R.a0 + t * R.w1);
        ctx.strokeStyle = rgba(R.col, R.al); ctx.lineWidth = R.lw; ctx.setLineDash(R.dash);
        ctx.beginPath(); ctx.arc(0, 0, R.r, 0, R.sweep); g.stroke();
        ctx.setLineDash([]);
        if (R.ticks) {
          ctx.lineWidth = s; ctx.beginPath();
          for (let k = 0; k < 72; k++) {
            const a = (k / 72) * TAU, l = (k % 6 ? 5 : 12) * s, r0 = R.r + 6 * s;
            ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * (r0 + l), Math.sin(a) * (r0 + l));
          }
          ctx.stroke();
        }
        for (let d = 0; d < R.dots; d++) {
          const a = (d / R.dots) * TAU + t * R.w2, x = Math.cos(a) * R.r, y = Math.sin(a) * R.r;
          if (p.glow) { ctx.fillStyle = rgba(R.col, 0.15); ctx.beginPath(); ctx.arc(x, y, 14 * s, 0, TAU); ctx.fill(); }
          ctx.fillStyle = rgba(R.col, 1); ctx.beginPath(); ctx.arc(x, y, 4 * s, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      ctx.restore();
    };
  },
};
