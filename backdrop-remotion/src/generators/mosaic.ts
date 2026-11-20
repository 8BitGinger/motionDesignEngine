import type { Generator } from '../engine/types';
import { clamp, hash3, lerp, mod } from '../engine/rng';

/** Tile grid whose colours drift through the palette, with occasional per-tile flashes. */
export const mosaic: Generator = {
  name: 'Mosaic Tiles',
  kind: 'field',
  controls: [{ key: 'tile', label: 'Tile size', min: 12, max: 220, step: 1 }],
  make(g) {
    const { ctx, w, h, s, p, pal } = g;
    const cell = g.o('tile', 64 / Math.sqrt(p.density)) * s, cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), gap = Math.max(1, 2 * s);
    const ox = (w - cols * cell) / 2, oy = (h - rows * cell) / 2, nc = pal.rgb.length, bg = pal.bgRgb[0], flash = g.lq(0.15, 1);
    return t => {
      ctx.save();
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const n = clamp(g.tn(c * 0.16, r * 0.16, t, 0.2) * 0.9 + 0.5, 0, 0.999) * Math.max(1, nc - 1);
        const i0 = Math.floor(n), f = n - i0, A = pal.rgb[i0 % nc], B = pal.rgb[(i0 + 1) % nc];
        let br = clamp(0.5 + g.tn(c * 0.5 + 50, r * 0.5, t, 0.6) * 1.2, 0, 1) * 0.75 + 0.1;
        const ph = mod(t * flash + ((hash3(c, r, 7) % 1000) / 1000) * 13, 1);
        if (ph < 0.06) br = Math.min(1, br + (1 - ph / 0.06) * 0.6);
        const ch = (k: number) => lerp(bg[k], lerp(A[k], B[k], f), br) | 0;
        ctx.fillStyle = `rgb(${ch(0)},${ch(1)},${ch(2)})`;
        ctx.fillRect(ox + c * cell + gap / 2, oy + r * cell + gap / 2, cell - gap, cell - gap);
      }
      ctx.restore();
    };
  },
};
