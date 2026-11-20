import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';

/** Organic Voronoi cells with lit edges. Distance field computed at a fixed small size, upscaled smoothly. */
export const cells: Generator = {
  name: 'Organic Cells',
  kind: 'field',
  controls: [
    { key: 'cells', label: 'Cells', min: 4, max: 80, step: 1 },
    { key: 'edge', label: 'Edge width', min: 0.2, max: 4, step: 0.05 },
  ],
  make(g) {
    const { ctx, w, h, rng, p, pal } = g;
    const lw = 400, lh = Math.max(8, Math.round((400 * h) / w)), asp = w / h;
    const off = document.createElement('canvas'); off.width = lw; off.height = lh;
    const octx = off.getContext('2d')!, img = octx.createImageData(lw, lh), d = img.data;
    const N = Math.round(g.o('cells', 14 + 14 * p.density)), edgeK = 60 / g.o('edge', 1);
    const pts = Array.from({ length: N }, (_, i) => ({
      x: rng() * asp, y: rng(), ax: rng.range(0.03, 0.12), ay: rng.range(0.03, 0.12), fx: g.lq(rng.range(0.1, 0.3)), fy: g.lq(rng.range(0.1, 0.3)), ph: rng() * TAU,
      rgb: pal.rgb[i % pal.rgb.length], shade: rng.range(0.18, 0.5),
    }));
    const px = new Float32Array(N), py = new Float32Array(N), bg = pal.bgRgb[0];
    const edge = pal.rgb[0], glow = p.glow ? 1.6 : 1;
    return t => {
      for (let i = 0; i < N; i++) { const q = pts[i]; px[i] = q.x + Math.sin(t * q.fx + q.ph) * q.ax; py[i] = q.y + Math.cos(t * q.fy + q.ph * 1.7) * q.ay; }
      for (let y = 0; y < lh; y++) {
        const ny = y / (lh - 1);
        for (let x = 0; x < lw; x++) {
          const nx = (x / (lw - 1)) * asp;
          let d1 = 1e9, d2 = 1e9, k1 = 0;
          for (let i = 0; i < N; i++) {
            const dx = nx - px[i], dy = ny - py[i], dd = dx * dx + dy * dy;
            if (dd < d1) { d2 = d1; d1 = dd; k1 = i; } else if (dd < d2) d2 = dd;
          }
          const a = Math.sqrt(d1), b = Math.sqrt(d2), gap = b - a;
          const e = Math.max(0, 1 - gap * edgeK) * glow, core = Math.max(0, 1 - a * 5) * 0.5;
          const q = pts[k1], m = q.shade + core, o = (y * lw + x) * 4;
          d[o] = Math.min(255, bg[0] + (q.rgb[0] - bg[0]) * m + edge[0] * e);
          d[o + 1] = Math.min(255, bg[1] + (q.rgb[1] - bg[1]) * m + edge[1] * e);
          d[o + 2] = Math.min(255, bg[2] + (q.rgb[2] - bg[2]) * m + edge[2] * e);
          d[o + 3] = 255;
        }
      }
      octx.putImageData(img, 0, 0);
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(off, 0, 0, w, h); ctx.restore();
    };
  },
};
