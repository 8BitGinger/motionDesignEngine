import { GENERATOR_KEYS } from '../generators';
import { THEME_KEYS } from './ColorEngine';
import { makeRng } from './rng';
import type { BackdropConfig, Layer, PaletteConfig, PaletteMode, Params } from './types';

export const randSeed = () => (Math.random() * 2 ** 31) >>> 0;

export const DEFAULT_PARAMS: Params = { speed: 1, density: 1, glow: false, grain: 0.12, vignette: 0.35 };

export const DEFAULT_CONFIG: BackdropConfig = {
  version: 1,
  type: 'aurora',
  seed: 1337,
  palette: { mode: 'theme', theme: 'cyberpunk', hue: 265, hue2: 320, custom: [] },
  params: { ...DEFAULT_PARAMS },
};

const BLENDS: GlobalCompositeOperation[] = ['screen', 'lighter', 'overlay', 'soft-light'];

/** Chaos generator: 1–3 distinct patterns stacked with random blends. Fully determined by `seed`. */
export function makeChaos(seed: number, lockedPalette?: PaletteConfig | null): BackdropConfig {
  const r = makeRng(seed);
  const n = r.int(1, 3), pool = [...GENERATOR_KEYS], layers: Layer[] = [];
  for (let i = 0; i < n; i++) {
    const type = pool.splice(Math.floor(r() * pool.length), 1)[0];
    layers.push({
      type,
      seed: Math.floor(r() * 2 ** 31),
      blend: i === 0 ? 'source-over' : r.pick(BLENDS),
      opacity: +(i === 0 ? 1 : r.range(0.45, 1)).toFixed(2),
      params: { speed: +r.range(0.4, 1.6).toFixed(2), density: +r.range(0.4, 1.8).toFixed(2) },
    });
  }
  const modes: PaletteMode[] = ['theme', 'theme', 'single', 'dual', 'triadic', 'analogous', 'complementary'];
  const palette: PaletteConfig = lockedPalette
    ? structuredClone(lockedPalette)
    : { mode: r.pick(modes), theme: r.pick(THEME_KEYS), hue: r.int(0, 359), hue2: r.int(0, 359), custom: [] };
  return {
    version: 1, type: 'chaos', seed, palette,
    params: { speed: 1, density: 1, glow: r() < 0.4, grain: +r.range(0, 0.45).toFixed(2), vignette: +r.range(0.15, 0.7).toFixed(2) },
    layers,
  };
}

/** Validate + fill defaults for user-supplied JSON. Throws with a readable message. */
export function normalizeConfig(input: unknown): BackdropConfig {
  if (!input || typeof input !== 'object') throw new Error('Config must be a JSON object.');
  const c = input as Partial<BackdropConfig>;
  const type = c.type ?? '';
  if (type !== 'chaos' && !GENERATOR_KEYS.includes(type)) throw new Error(`Unknown type "${type}". Valid: ${[...GENERATOR_KEYS, 'chaos'].join(', ')}`);
  if (type === 'chaos') {
    if (!Array.isArray(c.layers) || !c.layers.length) throw new Error('A chaos config needs a non-empty "layers" array.');
    for (const L of c.layers) if (!GENERATOR_KEYS.includes(L.type)) throw new Error(`Unknown layer type "${L.type}".`);
  }
  return {
    version: 1,
    type,
    seed: (c.seed ?? 1) >>> 0,
    palette: { ...DEFAULT_CONFIG.palette, ...(c.palette ?? {}) },
    params: { ...DEFAULT_PARAMS, ...(c.params ?? {}) },
    ...(type === 'chaos' ? { layers: c.layers } : {}),
  };
}
