import type { Generator } from '../engine/types';
import { TAU, makeRng, mod } from '../engine/rng';
import { rgba } from '../engine/ColorEngine';

/** Swaying additive light shafts from an off-screen source, plus floating dust motes. */
export const rays: Generator = {
  name: 'Light Rays',
  kind: 'shape',
  controls: [{ key: 'beams', label: 'Beams', min: 2, max: 30, step: 1 }],
  make(g) {
    const { ctx, w, h, s, rng, p } = g, loop = g.period > 0, r2 = makeRng(g.seed ^ 0x2a7);
    const sx = w * rng.range(0.2, 0.8), sy = -h * rng.range(0.1, 0.3), L = Math.hypot(w, h) * 1.4;
    const beams = Array.from({ length: Math.round(g.o('beams', 8 + 8 * p.density)) }, (_, i) => {
      const b = { ang: Math.PI / 2 + rng.range(-0.75, 0.75), wd: rng.range(0.015, 0.07), sw: rng.range(0.02, 0.08), sp: rng.range(0.1, 0.35), ph: rng() * TAU, col: g.c(i), al: rng.range(0.1, 0.3) };
      return { ...b, w1: g.lq(b.sp), w2: g.lq(b.sp * 2.3) };
    });
    const motes = Array.from({ length: Math.round(60 * p.density) }, () => {
      const m = { x: rng() * w, y: rng() * h, vx: rng.range(-6, 6) * s, vy: rng.range(-12, 4) * s, r: rng.range(0.8, 2.4) * s, ph: rng() * TAU };
      return { ...m, a: r2.range(20, 70) * s, wx: g.lq(r2.range(0.1, 0.3)), wy: g.lq(r2.range(0.1, 0.3)) };
    });
    const tw = g.lq(0.8);
    return t => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const r of beams) {
        const a = r.ang + Math.sin(t * r.w1 + r.ph) * r.sw, fl = 0.6 + 0.4 * Math.sin(t * r.w2 + r.ph * 2);
        const gr = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L);
        gr.addColorStop(0, rgba(r.col, r.al * fl)); gr.addColorStop(0.55, rgba(r.col, r.al * fl * 0.3)); gr.addColorStop(1, rgba(r.col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a - r.wd) * L, sy + Math.sin(a - r.wd) * L);
        ctx.lineTo(sx + Math.cos(a + r.wd) * L, sy + Math.sin(a + r.wd) * L);
        ctx.closePath(); ctx.fill();
      }
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * 0.6);
      sg.addColorStop(0, rgba(g.c(1), 0.35)); sg.addColorStop(1, rgba(g.c(1), 0));
      ctx.fillStyle = sg; ctx.fillRect(sx - h * 0.6, sy - h * 0.6, h * 1.2, h * 1.2);
      for (const m of motes) {
        const x = loop ? mod(m.x + Math.sin(t * m.wx + m.ph) * m.a, w) : mod(m.x + m.vx * t, w);
        const y = loop ? mod(m.y + Math.cos(t * m.wy + m.ph) * m.a, h) : mod(m.y + m.vy * t, h);
        ctx.fillStyle = rgba('#ffffff', 0.25 + 0.25 * Math.sin(t * tw + m.ph));
        ctx.beginPath(); ctx.arc(x, y, m.r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    };
  },
};
