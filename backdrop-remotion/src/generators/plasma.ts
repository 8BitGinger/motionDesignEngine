import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';

/** Classic sine plasma mapped through a looping palette ramp, computed small and upscaled smoothly. */
export const plasma: Generator = {
  name: 'Plasma',
  make(g) {
    const { ctx, w, h, rng, p, pal } = g;
    const lw = 200, lh = Math.max(8, Math.round((200 * h) / w));
    const off = document.createElement('canvas'); off.width = lw; off.height = lh;
    const octx = off.getContext('2d')!, img = octx.createImageData(lw, lh), d = img.data;
    // 256-entry cyclic ramp: bg → colours → back, so the palette wraps without a seam.
    const stops = [pal.bgRgb[0], ...pal.rgb, pal.bgRgb[1]], n = stops.length, lut = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const x = (i / 256) * n, k = Math.floor(x), f = x - k, A = stops[k % n], B = stops[(k + 1) % n], e = f * f * (3 - 2 * f);
      for (let c = 0; c < 3; c++) lut[i * 3 + c] = A[c] + (B[c] - A[c]) * e;
    }
    const k = 0.6 + 0.6 * p.density, asp = w / h;
    const ph = Array.from({ length: 6 }, () => rng() * TAU), fr = Array.from({ length: 6 }, () => rng.range(0.6, 1.4));
    return t => {
      const cx = 0.5 * asp + Math.sin(t * 0.13 + ph[0]) * 0.4, cy = 0.5 + Math.cos(t * 0.11 + ph[1]) * 0.35;
      for (let y = 0; y < lh; y++) {
        const ny = (y / lh) * k * 4;
        for (let x = 0; x < lw; x++) {
          const nx = (x / lw) * asp * k * 4;
          let v = Math.sin(nx * fr[0] + t * 0.5 + ph[2]);
          v += Math.sin((ny * fr[1] + t * 0.37) + ph[3]);
          v += Math.sin((nx * 0.7 + ny * 0.7) * fr[2] + t * 0.29 + ph[4]);
          const dx = nx / (k * 4) - cx, dy = ny / (k * 4) - cy;
          v += Math.sin(Math.sqrt(dx * dx + dy * dy) * 14 * fr[3] - t * 0.8 + ph[5]);
          const i = (((v * 0.125 + 0.5 + t * 0.02) % 1) + 1) % 1 * 255 | 0, o = (y * lw + x) * 4;
          d[o] = lut[i * 3]; d[o + 1] = lut[i * 3 + 1]; d[o + 2] = lut[i * 3 + 2]; d[o + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(off, 0, 0, w, h); ctx.restore();
    };
  },
};
