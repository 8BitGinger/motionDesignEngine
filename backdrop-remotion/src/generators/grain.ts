import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Rotating three-stop gradient with a drifting shadow and heavy animated film grain. */
export const grain: Generator = {
  name: 'Gradient Noise',
  kind: 'field',
  controls: [{ key: 'grain', label: 'Grain amount', min: 0, max: 1, step: 0.01 }],
  make(g) {
    const { ctx, w, h, rng, p } = g, D = Math.hypot(w, h), a0 = rng() * TAU, amount = g.o('grain', 0.35 + (0.4 * p.density) / 2);
    const [r0, c1, s1, st, s2, c2] = [0.15, 0.2, 0.17, 0.4, 0.13, 0.11].map(v => g.lq(v));
    return t => {
      const a = a0 + t * r0, cx = w / 2 + Math.cos(t * c1) * w * 0.15, cy = h / 2 + Math.sin(t * s1) * h * 0.15;
      const gr = ctx.createLinearGradient(cx - (Math.cos(a) * D) / 2, cy - (Math.sin(a) * D) / 2, cx + (Math.cos(a) * D) / 2, cy + (Math.sin(a) * D) / 2);
      gr.addColorStop(0, rgba(g.c(0), 0.9)); gr.addColorStop(0.5 + 0.2 * Math.sin(t * st), rgba(g.c(1), 0.7)); gr.addColorStop(1, rgba(g.c(2), 0.9));
      ctx.save(); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      const sx = w * (0.5 + 0.35 * Math.sin(t * s2 + a0)), sy = h * (0.5 + 0.35 * Math.cos(t * c2)), r = D * 0.45;
      const dk = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      dk.addColorStop(0, rgba(g.pal.bg[0], 0.75)); dk.addColorStop(1, rgba(g.pal.bg[0], 0));
      ctx.fillStyle = dk; ctx.fillRect(0, 0, w, h);
      if (amount > 0) g.drawGrain(ctx, t, amount);
      ctx.restore();
    };
  },
};
