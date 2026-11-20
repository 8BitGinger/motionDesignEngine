import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/**
 * Spiral galaxy: stars on logarithmic arms with differential rotation (inner stars orbit faster).
 * When looping, every arm is an exact copy of the first, so each star only needs to advance a whole
 * number of arm-spacings (TAU / arms) per period to land on an identical picture.
 */
export const galaxy: Generator = {
  name: 'Spiral Galaxy',
  kind: 'shape',
  controls: [
    { key: 'arms', label: 'Arms', min: 1, max: 8, step: 1 },
    { key: 'wind', label: 'Winding', min: -8, max: 8, step: 0.1 },
  ],
  make(g) {
    const { ctx, w, h, s, rng, p } = g;
    const arms = Math.max(1, Math.round(g.o('arms', rng.int(2, 5)))), N = Math.round(5000 * p.density), R = Math.hypot(w, h) * 0.42;
    const tilt = rng.range(0.45, 0.8), rot = rng() * TAU;
    const wind = g.o('wind', rng.range(2.5, 5) * (rng() < 0.5 ? -1 : 1)), unit = TAU / arms, loop = g.period > 0;
    const mk = (arm: number) => {
      const r = Math.pow(rng(), 1.15), spread = (rng() + rng() - 1) * (0.35 + r * 0.5);
      return { r, a: arm * unit + r * wind + spread, sz: rng.range(1.4, 3.8) * s * (1.3 - r * 0.5), c: r < 0.18 ? 0 : 1 + Math.floor(rng() * 4), b: rng.range(0.4, 1), om: 0 };
    };
    let stars: ReturnType<typeof mk>[];
    if (loop) {
      const per = Math.ceil(N / arms);
      stars = [];
      for (let i = 0; i < per; i++) { const q = mk(0); for (let k = 0; k < arms; k++) stars.push({ ...q, a: q.a + k * unit }); }
    } else stars = Array.from({ length: N }, () => mk(rng.int(0, arms - 1)));
    for (const q of stars) q.om = g.lq(0.12 / (0.25 + q.r), unit);
    const buckets: number[][] = [[], [], [], [], []];
    stars.forEach((q, i) => buckets[q.c].push(i));
    return t => {
      const cx = w / 2, cy = h / 2, ca = Math.cos(rot), sa = Math.sin(rot);
      ctx.save();
      // core glow from a radial gradient (cheap, no blur)
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.35);
      cg.addColorStop(0, rgba(g.c(0), 0.75)); cg.addColorStop(0.4, rgba(g.c(0), 0.25)); cg.addColorStop(1, rgba(g.c(0), 0));
      ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      buckets.forEach((idx, c) => {
        ctx.fillStyle = rgba(g.c(c), 1);
        for (const i of idx) {
          const q = stars[i], a = q.a + t * q.om;
          const x0 = Math.cos(a) * q.r * R, y0 = Math.sin(a) * q.r * R * tilt;
          const x = cx + x0 * ca - y0 * sa, y = cy + x0 * sa + y0 * ca;
          ctx.globalAlpha = q.b;
          ctx.fillRect(x - q.sz / 2, y - q.sz / 2, q.sz, q.sz);
          if (p.glow && q.sz > 2.6 * s) { ctx.globalAlpha = q.b * 0.15; ctx.fillRect(x - q.sz * 2, y - q.sz * 2, q.sz * 4, q.sz * 4); }
        }
      });
      ctx.restore();
    };
  },
};
