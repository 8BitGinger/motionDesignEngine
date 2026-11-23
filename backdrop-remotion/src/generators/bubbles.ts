import type { Generator } from '../engine/types';
import { TAU, hash3, makeRng } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/**
 * Translucent soap bubbles that wobble upward with a glossy rim and highlight.
 * One sprite per palette colour; each bubble crosses the frame once per cycle (loops exactly).
 */
export const bubbles: Generator = {
  name: 'Bubbles',
  kind: 'shape',
  controls: [
    { key: 'size', label: 'Bubble size', min: 0.3, max: 3, step: 0.05 },
    { key: 'count', label: 'Bubbles', min: 5, max: 150, step: 1 },
  ],
  make(g) {
    const { ctx, w, h, s, rng, p, pal } = g, r2 = makeRng(g.seed ^ 0xb0b);
    const sprites = pal.colors.map(col => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const x = c.getContext('2d')!;
      const body = x.createRadialGradient(128, 128, 20, 128, 128, 120);
      body.addColorStop(0, rgba(col, 0.02)); body.addColorStop(0.8, rgba(col, 0.12)); body.addColorStop(1, rgba(col, 0.35));
      x.fillStyle = body; x.beginPath(); x.arc(128, 128, 120, 0, TAU); x.fill();
      x.lineWidth = 5; x.strokeStyle = rgba(col, 0.85); x.beginPath(); x.arc(128, 128, 118, 0, TAU); x.stroke();
      x.lineCap = 'round'; x.lineWidth = 9; x.strokeStyle = 'rgba(255,255,255,0.85)'; // glossy highlight
      x.beginPath(); x.arc(128, 128, 90, Math.PI * 1.1, Math.PI * 1.4); x.stroke();
      x.lineWidth = 5; x.strokeStyle = 'rgba(255,255,255,0.35)';
      x.beginPath(); x.arc(128, 128, 90, Math.PI * 0.1, Math.PI * 0.25); x.stroke();
      return c;
    });
    const size = g.o('size', 1), N = Math.round(g.o('count', 38 * p.density));
    const bs = Array.from({ length: N }, (_, i) => {
      const depth = rng();
      const b = { i, depth, r: (12 + depth * depth * 90) * s * size, ph: rng(), life: r2.range(7, 14) * (1.2 - depth * 0.5), sw: r2.range(12, 45) * s, f: r2.range(0.4, 1.2), pp: r2() * TAU, sp: rng.int(0, sprites.length - 1) };
      return { ...b, fs: g.lq(b.f) };
    }).sort((a, b) => a.depth - b.depth);
    return t => {
      ctx.save();
      for (const b of bs) {
        const [k, u] = g.cyc(t, b.life, b.ph), M = b.r * 2;
        const x = ((hash3(b.i, k, g.seed) % 10000) / 10000) * w + Math.sin(t * b.fs + b.pp) * b.sw;
        const y = h + M - u * (h + 2 * M);
        const squash = 1 + 0.05 * Math.sin(t * b.fs * 2 + b.pp), rx = b.r * squash, ry = b.r / squash;
        ctx.globalAlpha = (0.35 + b.depth * 0.65) * Math.min(1, u * 6) * Math.min(1, (1 - u) * 6);
        if (p.glow) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(sprites[b.sp], x - rx * 1.1, y - ry * 1.1, rx * 2.2, ry * 2.2); ctx.globalCompositeOperation = 'source-over'; }
        ctx.drawImage(sprites[b.sp], x - rx, y - ry, rx * 2, ry * 2);
      }
      ctx.restore();
    };
  },
};
