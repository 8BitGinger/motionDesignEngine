import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';

/** Mesh gradient: inverse-distance blend of moving colour points on a tiny canvas, upscaled smoothly. */
export const mesh: Generator = {
  name: 'Liquid Mesh',
  make(g) {
    const { ctx, w, h, rng, p, pal } = g;
    const lw = 96, lh = Math.max(8, Math.round((96 * h) / w));
    const off = document.createElement('canvas'); off.width = lw; off.height = lh;
    const octx = off.getContext('2d')!, img = octx.createImageData(lw, lh), asp = w / h;
    const K = Math.round(4 + 3 * p.density);
    const cols = [...Array.from({ length: K }, (_, i) => pal.rgb[i % pal.rgb.length]), pal.bgRgb[0], pal.bgRgb[1]];
    const pts = cols.map(rgb => ({
      x: rng(), y: rng(), ax: rng.range(0.15, 0.4), ay: rng.range(0.15, 0.4), fx: rng.range(0.08, 0.2), fy: rng.range(0.08, 0.2), ph: rng() * TAU, rgb,
    }));
    const P = pts.length, px = new Float32Array(P), py = new Float32Array(P);
    return t => {
      for (let i = 0; i < P; i++) {
        const q = pts[i];
        px[i] = (q.x + Math.sin(t * q.fx + q.ph) * q.ax) * asp; py[i] = q.y + Math.cos(t * q.fy + q.ph * 1.3) * q.ay;
      }
      const d = img.data;
      for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
        const nx = (x / (lw - 1)) * asp, ny = y / (lh - 1);
        let r = 0, gg = 0, b = 0, ws = 0;
        for (let i = 0; i < P; i++) {
          const dx = nx - px[i], dy = ny - py[i], wt = 1 / Math.pow(dx * dx + dy * dy + 0.015, 1.6);
          ws += wt; r += pts[i].rgb[0] * wt; gg += pts[i].rgb[1] * wt; b += pts[i].rgb[2] * wt;
        }
        const o = (y * lw + x) * 4; d[o] = r / ws; d[o + 1] = gg / ws; d[o + 2] = b / ws; d[o + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(off, 0, 0, w, h); ctx.restore();
    };
  },
};
