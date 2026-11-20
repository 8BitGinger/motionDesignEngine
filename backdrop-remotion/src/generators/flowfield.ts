import type { Generator } from '../engine/types';
import { TAU, makeRng } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/**
 * Particles advected through a noise vector field, leaving fading trails.
 * This is the one stateful generator: it integrates at a fixed 60 Hz in pattern time.
 * Seeking backwards (or any seek in exact mode) re-simulates from the start, so a given
 * frame is identical no matter which Remotion tab renders it or in what order.
 */
export const flowfield: Generator = {
  name: 'Flow Field',
  kind: 'shape',
  // Stateful (trails accumulate), so it can't repeat exactly: loops use the crossfade fallback.
  loops: false,
  controls: [
    { key: 'turbulence', label: 'Turbulence', min: 0.3, max: 6, step: 0.1 },
    { key: 'trail', label: 'Trail length', min: 0.1, max: 3, step: 0.05 },
  ],
  make(g) {
    const { w, h, s, p, noise } = g;
    const { buf, bctx } = g.buffer();
    const N = Math.min(1500, Math.round(600 * p.density)), DT = 1 / 60, sc = 0.0022 / s, V = 70 * s, WARMUP = 3;
    const turb = TAU * g.o('turbulence', 2.2), fadeA = (0.045 / g.o('trail', 1)).toFixed(4);
    type P = { x: number; y: number; life: number; c: number };
    let rng = makeRng(g.seed ^ 0xabc), pts: P[] = [], simT = 0;
    const spawn = (q: P) => { q.x = rng() * w; q.y = rng() * h; q.life = rng.range(2, 8); return q; };
    const reset = () => {
      rng = makeRng(g.seed ^ 0xabc);
      bctx.clearRect(0, 0, w, h);
      pts = Array.from({ length: N }, (_, i) => spawn({ x: 0, y: 0, life: 0, c: i % 4 }));
      simT = -WARMUP;
    };
    const step = () => {
      bctx.globalCompositeOperation = 'destination-out'; bctx.fillStyle = `rgba(0,0,0,${fadeA})`; bctx.fillRect(0, 0, w, h);
      bctx.globalCompositeOperation = 'source-over'; bctx.lineWidth = 1.6 * s; bctx.lineCap = 'round';
      for (let c = 0; c < 4; c++) {
        bctx.beginPath();
        for (const q of pts) {
          if (q.c !== c) continue;
          const a = noise(q.x * sc, q.y * sc, simT * 0.08) * turb;
          const nx = q.x + Math.cos(a) * V * DT, ny = q.y + Math.sin(a) * V * DT;
          bctx.moveTo(q.x, q.y); bctx.lineTo(nx, ny);
          q.x = nx; q.y = ny; q.life -= DT;
          if (q.life < 0 || nx < -5 || ny < -5 || nx > w + 5 || ny > h + 5) spawn(q);
        }
        bctx.strokeStyle = rgba(g.c(c), 0.85); bctx.stroke();
      }
      simT += DT;
    };
    reset();
    return t => {
      if (t < simT - DT * 2) reset();
      // Interactive preview only: skip long gaps instead of simulating them (breaks exactness, so never in exact mode).
      if (!g.exact && t - simT > 12) { reset(); simT = t - WARMUP; }
      while (simT + DT <= t) step();
      g.ctx.save(); g.ctx.globalCompositeOperation = p.glow ? 'lighter' : 'source-over'; g.ctx.drawImage(buf, 0, 0); g.ctx.restore();
    };
  },
};
