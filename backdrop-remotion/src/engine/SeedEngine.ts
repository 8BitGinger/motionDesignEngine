import { GENERATORS, GENERATOR_KEYS } from '../generators';
import { THEME_KEYS } from './ColorEngine';
import { clamp, makeRng } from './rng';
import type { BackdropConfig, Calm, CalmZone, Layer, Opts, PaletteConfig, PaletteMode, Params, Rng } from './types';

export const randSeed = () => (Math.random() * 2 ** 31) >>> 0;

export const DEFAULT_PARAMS: Params = { speed: 1, density: 1, glow: false, grain: 0.12, vignette: 0.35 };

export const DEFAULT_CONFIG: BackdropConfig = {
  version: 1,
  type: 'aurora',
  seed: 1337,
  palette: { mode: 'theme', theme: 'cyberpunk', hue: 265, hue2: 320, custom: [] },
  params: { ...DEFAULT_PARAMS },
};

export const CALM_ZONES: CalmZone[] = ['off', 'left', 'right', 'top', 'bottom', 'center'];

const BLENDS: GlobalCompositeOperation[] = ['screen', 'lighter', 'overlay', 'soft-light'];
const FIELDS = GENERATOR_KEYS.filter(k => GENERATORS[k].kind === 'field');
const SHAPES = GENERATOR_KEYS.filter(k => GENERATORS[k].kind === 'shape');
/** Shapes with plenty of solid coverage make good masks ("show plasma through the halftone dots"). */
const GOOD_MASKS = ['halftone', 'hex', 'confetti', 'geometric', 'kaleidoscope', 'matrix', 'bokeh', 'waves', 'blobs', 'mosaic'].filter(k => SHAPES.includes(k));

const take = (r: Rng, pool: string[], used: Set<string>) => {
  const free = pool.filter(k => !used.has(k));
  const k = free[Math.floor(r() * free.length)] ?? pool[0];
  used.add(k);
  return k;
};
const layerParams = (r: Rng) => ({ speed: +r.range(0.4, 1.6).toFixed(2), density: +r.range(0.4, 1.8).toFixed(2) });

/**
 * Chaos generator: 1–3 patterns stacked with blends, fully determined by `seed`.
 * Rules that keep results good: at most one opaque "field" pattern, always at the bottom; upper layers are
 * transparent shapes; and ~30% of the time a "reveal": a field shown only through a shape layer's pixels.
 */
export function makeChaos(seed: number, lockedPalette?: PaletteConfig | null): BackdropConfig {
  const r = makeRng(seed), used = new Set<string>(), layers: Layer[] = [];
  const reveal = r() < 0.3;
  if (reveal) {
    // [base] + [mask source, hidden or faint] + [field revealed through it]
    const base = take(r, r() < 0.5 ? FIELDS : SHAPES, used);
    const maskSrc = take(r, GOOD_MASKS, used);
    const field = take(r, FIELDS, used);
    layers.push({ type: base, seed: Math.floor(r() * 2 ** 31), blend: 'source-over', opacity: 1, params: layerParams(r) });
    layers.push({ type: maskSrc, seed: Math.floor(r() * 2 ** 31), blend: 'screen', opacity: +(r() < 0.6 ? 0 : r.range(0.15, 0.4)).toFixed(2), params: layerParams(r) });
    layers.push({ type: field, seed: Math.floor(r() * 2 ** 31), blend: r.pick(['source-over', 'screen', 'lighter'] as GlobalCompositeOperation[]), opacity: +r.range(0.75, 1).toFixed(2), params: layerParams(r), mask: 1 });
  } else {
    const n = r.int(1, 3);
    for (let i = 0; i < n; i++) {
      // Bottom layer: fields are welcome (weighted up); above it, shapes only.
      const pool = i === 0 ? (r() < 0.4 ? FIELDS : SHAPES) : SHAPES;
      layers.push({
        type: take(r, pool, used),
        seed: Math.floor(r() * 2 ** 31),
        blend: i === 0 ? 'source-over' : r.pick(BLENDS),
        opacity: +(i === 0 ? 1 : r.range(0.45, 1)).toFixed(2),
        params: layerParams(r),
      });
    }
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

const nudge = (r: Rng, v: number, amt: number, lo: number, hi: number, dp = 2) => +clamp(v + (r() * 2 - 1) * amt, lo, hi).toFixed(dp);

function mutateOpts(r: Rng, type: string, opts: Opts | undefined): Opts | undefined {
  const ctrls = GENERATORS[type]?.controls ?? [];
  if (!ctrls.length) return opts;
  const out: Opts = { ...(opts ?? {}) };
  for (const c of ctrls) {
    const span = c.max - c.min;
    if (typeof out[c.key] === 'number') {
      if (r() < 0.6) out[c.key] = +clamp(Math.round((out[c.key] + (r() * 2 - 1) * span * 0.12) / c.step) * c.step, c.min, c.max).toFixed(3);
    } else if (r() < 0.2) {
      // Occasionally pin an "auto" control to a random value so mutation can explore it.
      out[c.key] = +clamp(Math.round((c.min + r() * span) / c.step) * c.step, c.min, c.max).toFixed(3);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * A small variation of `cfg`: nudged motion params, per-pattern options, layer mix and hue, while keeping
 * the pattern and its layout (seed). Deterministic for a given `seed`, so a mutation is reproducible too.
 */
export function mutate(cfg: BackdropConfig, seed: number): BackdropConfig {
  const r = makeRng(seed ^ 0x3c3c);
  const c: BackdropConfig = structuredClone(cfg);
  c.params = {
    ...c.params,
    speed: nudge(r, c.params.speed, 0.2, 0.1, 3),
    density: nudge(r, c.params.density, 0.2, 0.2, 2),
    grain: nudge(r, c.params.grain, 0.05, 0, 1),
    vignette: nudge(r, c.params.vignette, 0.06, 0, 1),
  };
  if (c.palette.mode !== 'theme' && c.palette.mode !== 'custom') {
    c.palette.hue = ((c.palette.hue ?? 0) + r.int(-18, 18) + 360) % 360;
    if (c.palette.mode === 'dual') c.palette.hue2 = ((c.palette.hue2 ?? 0) + r.int(-18, 18) + 360) % 360;
  }
  if (c.type === 'chaos' && c.layers) {
    c.layers = c.layers.map((L, i) => {
      const n: Layer = { ...L, params: { ...L.params, speed: nudge(r, L.params?.speed ?? 1, 0.2, 0.2, 2.5), density: nudge(r, L.params?.density ?? 1, 0.2, 0.3, 2) } };
      if (i > 0 && n.opacity > 0) n.opacity = nudge(r, n.opacity, 0.12, 0.2, 1);
      if (i > 0 && L.mask == null && r() < 0.15) n.blend = r.pick(BLENDS);
      n.opts = mutateOpts(r, L.type, L.opts);
      return n;
    });
    // Now and then re-roll one layer's layout so the mutation can also find a new arrangement.
    if (r() < 0.25) { const i = r.int(0, c.layers.length - 1); c.layers[i] = { ...c.layers[i], seed: Math.floor(r() * 2 ** 31) }; }
  } else {
    c.opts = mutateOpts(r, c.type, c.opts);
  }
  return c;
}

function cleanOpts(type: string, o: unknown): Opts | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const ctrls = GENERATORS[type]?.controls ?? [], out: Opts = {};
  for (const c of ctrls) {
    const v = (o as Record<string, unknown>)[c.key];
    if (typeof v === 'number' && Number.isFinite(v)) out[c.key] = clamp(v, c.min, c.max);
  }
  return Object.keys(out).length ? out : undefined;
}

function cleanCalm(x: unknown): Calm | undefined {
  if (!x || typeof x !== 'object') return undefined;
  const c = x as Partial<Calm>;
  if (!c.zone || !CALM_ZONES.includes(c.zone) || c.zone === 'off') return undefined;
  return { zone: c.zone, strength: clamp(Number(c.strength ?? 0.6), 0, 1) };
}

/** Validate + fill defaults for user-supplied JSON. Throws with a readable message. */
export function normalizeConfig(input: unknown): BackdropConfig {
  if (!input || typeof input !== 'object') throw new Error('Config must be a JSON object.');
  const c = input as Partial<BackdropConfig>;
  const type = c.type ?? '';
  if (type !== 'chaos' && !GENERATOR_KEYS.includes(type)) throw new Error(`Unknown type "${type}". Valid: ${[...GENERATOR_KEYS, 'chaos'].join(', ')}`);
  let layers: Layer[] | undefined;
  if (type === 'chaos') {
    if (!Array.isArray(c.layers) || !c.layers.length) throw new Error('A chaos config needs a non-empty "layers" array.');
    layers = c.layers.map((L, i) => {
      if (!GENERATOR_KEYS.includes(L.type)) throw new Error(`Unknown layer type "${L.type}".`);
      if (L.mask != null && (!Number.isInteger(L.mask) || L.mask < 0 || L.mask >= c.layers!.length || L.mask === i)) throw new Error(`Layer ${i}: "mask" must be the index of another layer.`);
      const opts = cleanOpts(L.type, L.opts);
      return { ...L, seed: (L.seed ?? 1) >>> 0, opacity: clamp(L.opacity ?? 1, 0, 1), blend: L.blend || 'source-over', ...(opts ? { opts } : { opts: undefined }) };
    });
  }
  const opts = type === 'chaos' ? undefined : cleanOpts(type, c.opts);
  const calm = cleanCalm(c.calm);
  return {
    version: 1,
    type,
    seed: (c.seed ?? 1) >>> 0,
    palette: { ...DEFAULT_CONFIG.palette, ...(c.palette ?? {}) },
    params: { ...DEFAULT_PARAMS, ...(c.params ?? {}) },
    ...(opts ? { opts } : {}),
    ...(calm ? { calm } : {}),
    ...(layers ? { layers } : {}),
  };
}
