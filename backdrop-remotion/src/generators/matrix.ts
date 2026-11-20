import type { Generator } from '../engine/types';
import { hash3, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

const CH = '0123456789ABCDEF<>/|=+*:;#$%&{}[]'.split('');

/** Falling glyph columns. Glyphs are hashed from (column, row, time) so any frame is reproducible. */
export const matrix: Generator = {
  name: 'Matrix Streams',
  kind: 'shape',
  controls: [{ key: 'cell', label: 'Glyph size', min: 10, max: 64, step: 1 }],
  make(g) {
    const { ctx, w, h, s, rng, p } = g;
    const cell = g.o('cell', 24 / Math.sqrt(p.density)) * s, cols = Math.ceil(w / cell), rowsN = Math.ceil(h / cell) + 1;
    const st = Array.from({ length: cols }, () => {
      const S = { sp: rng.range(5, 18), len: rng.int(8, 30), off: rng() * 100, col: g.c(rng.int(0, 2)), rate: rng.range(2, 8) };
      // Looping: whole trips down the column per period, and a whole number of glyph swaps (counted mod n).
      const n = g.period ? Math.max(1, Math.round(S.rate * g.period)) : 0;
      return { ...S, sp: g.lq(S.sp, rowsN + S.len), rate: n ? n / g.period : S.rate, n };
    });
    return t => {
      ctx.save();
      ctx.font = `${Math.round(cell * 0.85)}px Consolas, "DejaVu Sans Mono", "Courier New", monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let c = 0; c < cols; c++) {
        const S = st[c], head = Math.floor(mod(S.off + S.sp * t, rowsN + S.len)), x = c * cell + cell / 2;
        for (let k = 0; k <= S.len; k++) {
          const row = head - k;
          if (row < 0 || row >= rowsN) continue;
          const tick = Math.floor(t * S.rate + row * 0.37);
          const ch = CH[hash3(c, row, S.n ? mod(tick, S.n) : tick) % CH.length];
          ctx.fillStyle = k === 0 ? 'rgba(255,255,255,.95)' : rgba(S.col, (1 - k / S.len) ** 1.5 * 0.85);
          ctx.fillText(ch, x, row * cell);
          if (p.glow && k < 3) { ctx.fillStyle = rgba(S.col, 0.12); ctx.fillRect(x - cell * 0.6, row * cell - cell * 0.1, cell * 1.2, cell * 1.2); }
        }
      }
      ctx.restore();
    };
  },
};
