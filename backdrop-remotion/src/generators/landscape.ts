import type { Generator } from '../engine/types';
import { mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Perspective wireframe terrain. Rows are drawn far→near, each erasing what it occludes. */
export const landscape: Generator = {
  name: 'Wireframe Landscape',
  make(g) {
    const { w, h, s, rng, noise, p } = g;
    const { buf, bctx } = g.buffer();
    const cols = Math.round(40 + 20 * p.density), rows = Math.round(28 + 14 * p.density);
    const X = 14 * Math.max(1, w / h), zN = 1.2, zF = 26, dz = (zF - zN) / rows, f = h * 0.85, hor = h * 0.4, camH = 1.6, ox = rng() * 100;
    const xw = Array.from({ length: cols + 1 }, (_, i) => -X + (2 * X * i) / cols);
    const hgt = (x: number, z: number) => {
      const n = noise(x * 0.18 + ox, z * 0.18) + noise(x * 0.5 + ox, z * 0.5, 3.3) * 0.35;
      return Math.max(0, n + 0.25) * 3.4 * Math.min(1, Math.abs(x) / 3 + 0.15);
    };
    const grad = bctx.createLinearGradient(0, hor - h * 0.25, 0, h);
    grad.addColorStop(0, rgba(g.c(0), 0)); grad.addColorStop(0.25, rgba(g.c(0), 0.55)); grad.addColorStop(1, rgba(g.c(1), 0.95));
    const glow = bctx.createLinearGradient(0, hor - h * 0.3, 0, hor + h * 0.05);
    glow.addColorStop(0, rgba(g.c(2), 0)); glow.addColorStop(0.8, rgba(g.c(2), 0.22)); glow.addColorStop(1, rgba(g.c(2), 0));
    const P = Array.from({ length: rows + 1 }, () => new Float32Array((cols + 1) * 2));
    return t => {
      const travel = t * 1.8, off = mod(travel, dz);
      for (let r = 0; r <= rows; r++) {
        const z = zN + r * dz - off, wz = z + travel, row = P[r];
        for (let c = 0; c <= cols; c++) { row[c * 2] = w / 2 + (xw[c] * f) / z; row[c * 2 + 1] = hor + ((camH - hgt(xw[c], wz)) * f) / z; }
      }
      bctx.clearRect(0, 0, w, h);
      bctx.fillStyle = glow; bctx.fillRect(0, hor - h * 0.3, w, h * 0.35);
      bctx.lineWidth = 1.3 * s; bctx.strokeStyle = grad; bctx.lineJoin = 'round';
      for (let r = rows; r >= 0; r--) {
        const row = P[r];
        bctx.globalCompositeOperation = 'destination-out';
        bctx.beginPath(); bctx.moveTo(row[0], h + 10);
        for (let c = 0; c <= cols; c++) bctx.lineTo(row[c * 2], row[c * 2 + 1]);
        bctx.lineTo(row[cols * 2], h + 10); bctx.closePath(); bctx.fillStyle = '#000'; bctx.fill();
        bctx.globalCompositeOperation = 'source-over';
        bctx.beginPath(); bctx.moveTo(row[0], row[1]);
        for (let c = 1; c <= cols; c++) bctx.lineTo(row[c * 2], row[c * 2 + 1]);
        if (r < rows) {
          const fr = P[r + 1];
          for (let c = 0; c <= cols; c++) { bctx.moveTo(row[c * 2], row[c * 2 + 1]); bctx.lineTo(fr[c * 2], fr[c * 2 + 1]); }
        }
        g.stroke(null, bctx);
      }
      g.ctx.drawImage(buf, 0, 0);
    };
  },
};
