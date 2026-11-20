import type { Noise, Rng } from './types';

export const TAU = Math.PI * 2;
export const mod = (a: number, b: number) => ((a % b) + b) % b;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number): Rng {
  const r = mulberry32(seed >>> 0) as Rng;
  r.range = (a, b) => a + r() * (b - a);
  r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  return r;
}

export const hash3 = (a: number, b: number, c: number) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

/** Seeded 3D value noise, roughly in [-1, 1]. */
export function makeNoise(seed: number): Noise {
  const r = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const vals = new Float32Array(256); for (let i = 0; i < 256; i++) vals[i] = r() * 2 - 1;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const H = (x: number, y: number, z: number) => vals[p[p[p[x & 255] + (y & 255)] + (z & 255)]];
  return (x, y = 0, z = 0) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const u = fade(x - X), v = fade(y - Y), w = fade(z - Z);
    return lerp(
      lerp(lerp(H(X, Y, Z), H(X + 1, Y, Z), u), lerp(H(X, Y + 1, Z), H(X + 1, Y + 1, Z), u), v),
      lerp(lerp(H(X, Y, Z + 1), H(X + 1, Y, Z + 1), u), lerp(H(X, Y + 1, Z + 1), H(X + 1, Y + 1, Z + 1), u), v), w);
  };
}

/**
 * Seeded 4D value noise, roughly in [-1, 1]. Used for seamless loops: walking a circle in the (z, w)
 * plane gives a noise signal that returns exactly to its start after one lap.
 */
export function makeNoise4(seed: number) {
  const r = mulberry32((seed ^ 0x85ebca6b) >>> 0);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Uint8Array(512); for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const vals = new Float32Array(256); for (let i = 0; i < 256; i++) vals[i] = r() * 2 - 1;
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const H = (x: number, y: number, z: number, w: number) => vals[p[p[p[p[x & 255] + (y & 255)] + (z & 255)] + (w & 255)]];
  return (x: number, y: number, z: number, w: number) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), W = Math.floor(w);
    const u = fade(x - X), v = fade(y - Y), s = fade(z - Z), q = fade(w - W);
    const cube = (W0: number) => lerp(
      lerp(lerp(H(X, Y, Z, W0), H(X + 1, Y, Z, W0), u), lerp(H(X, Y + 1, Z, W0), H(X + 1, Y + 1, Z, W0), u), v),
      lerp(lerp(H(X, Y, Z + 1, W0), H(X + 1, Y, Z + 1, W0), u), lerp(H(X, Y + 1, Z + 1, W0), H(X + 1, Y + 1, Z + 1, W0), u), v), s);
    return lerp(cube(W), cube(W + 1), q);
  };
}
