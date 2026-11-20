import type { Generator } from '../engine/types';
import { TAU } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Endless tunnel of twisting polygons rushing toward the viewer, with rotating spokes. */
export const tunnel: Generator = {
  name: 'Hyper Tunnel',
  kind: 'shape',
  controls: [
    { key: 'sides', label: 'Sides (0 = circle)', min: 0, max: 8, step: 1 },
    { key: 'twist', label: 'Twist', min: -3, max: 3, step: 0.05 },
    { key: 'rings', label: 'Rings', min: 8, max: 60, step: 1 },
  ],
  make(g) {
    const { ctx, w, h, s, rng, p, pal } = g;
    let sides = rng.pick([0, 3, 4, 5, 6, 8]);
    sides = Math.round(g.o('sides', sides)); if (sides > 0 && sides < 3) sides = 3;
    const K = Math.round(g.o('rings', 18 + 14 * p.density)), R = Math.hypot(w, h) * 0.75;
    const twist = g.o('twist', rng.range(0.6, 2.2) * (rng() < 0.5 ? -1 : 1)), spokes = rng.int(6, 16), rot0 = rng() * TAU;
    // Ring colours cycle through the palette, so a loop must advance a multiple of the palette length.
    const rate = g.lq(rng.range(0.5, 0.9), pal.colors.length);
    const spin = g.lq(0.05, TAU / spokes, false), ringRot = g.lq(0.15, sides ? TAU / sides : TAU);
    const ring = (cx: number, cy: number, r: number, a: number) => {
      ctx.beginPath();
      if (!sides) { ctx.arc(cx, cy, r, 0, TAU); return; }
      for (let k = 0; k <= sides; k++) { const q = a + (k / sides) * TAU; if (k) ctx.lineTo(cx + Math.cos(q) * r, cy + Math.sin(q) * r); else ctx.moveTo(cx + Math.cos(q) * r, cy + Math.sin(q) * r); }
    };
    return t => {
      const cx = w / 2 + g.tn(3.7, 3, t, 0.08) * w * 0.12, cy = h / 2 + g.tn(9.1, 9, t, 0.08) * h * 0.12;
      const u = t * rate, fu = u - Math.floor(u), base = Math.floor(u);
      ctx.save(); ctx.lineJoin = 'round';
      ctx.lineWidth = 1 * s; ctx.strokeStyle = rgba(g.c(0), 0.18); ctx.beginPath();
      for (let k = 0; k < spokes; k++) { const a = rot0 + (k / spokes) * TAU + t * spin; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); }
      ctx.stroke();
      for (let j = 0; j < K; j++) {
        const z = (j + fu) / K; // 0 = far, 1 = at the camera
        const r = R * (0.015 + Math.pow(z, 2.6));
        const id = j - base; // stays constant while a ring travels, so its colour never flickers
        ctx.lineWidth = (0.6 + z * 5) * s;
        ctx.strokeStyle = rgba(g.c(id), Math.min(1, z * 3) * (1 - z * 0.35) * 0.9);
        ring(cx, cy, r, rot0 + z * twist * TAU * 0.25 + t * ringRot);
        g.stroke();
      }
      ctx.restore();
    };
  },
};
