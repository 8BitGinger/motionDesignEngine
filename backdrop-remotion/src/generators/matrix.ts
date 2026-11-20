import type { Generator } from '../engine/types';
import { hash3, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

const CH = '0123456789ABCDEF<>/|=+*:;#$%&{}[]'.split('');

/** Falling glyph columns. Glyphs are hashed from (column, row, time) so any frame is reproducible. */
export const matrix: Generator = {
  name: 'Matrix Streams',
  make(g) {
    const { ctx, w, h, s, rng, p } = g;
    const cell = (24 * s) / Math.sqrt(p.density), cols = Math.ceil(w / cell), rowsN = Math.ceil(h / cell) + 1;
    const st = Array.from({ length: cols }, () => ({ sp: rng.range(5, 18), len: rng.int(8, 30), off: rng() * 100, col: g.c(rng.int(0, 2)), rate: rng.range(2, 8) }));
    return t => {
      ctx.save();
      ctx.font = `${Math.round(cell * 0.85)}px Consolas, "DejaVu Sans Mono", "Courier New", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let c = 0; c < cols; c++) {
        const S = st[c], head = Math.floor(mod(S.off + S.sp * t, rowsN + S.len)), x = c * cell + cell / 2;
        for (let k = 0; k <= S.len; k++) {
          const row = head - k;
          if (row < 0 || row >= rowsN) continue;
          const ch = CH[hash3(c, row, Math.floor(t * S.rate + row * 0.37)) % CH.length];
          ctx.fillStyle = k === 0 ? 'rgba(255,255,255,.95)' : rgba(S.col, (1 - k / S.len) ** 1.5 * 0.85);
          ctx.fillText(ch, x, row * cell);
          if (p.glow && k < 3) { ctx.fillStyle = rgba(S.col, 0.12); ctx.fillRect(x - cell * 0.6, row * cell - cell * 0.1, cell * 1.2, cell * 1.2); }
        }
      }
      ctx.restore();
    };
  },
};
