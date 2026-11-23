export type PaletteMode = 'theme' | 'single' | 'dual' | 'triadic' | 'analogous' | 'complementary' | 'custom';

export interface PaletteConfig {
  mode: PaletteMode;
  theme?: string;
  hue?: number;
  hue2?: number;
  custom?: string[];
}

export interface Params {
  speed: number;
  density: number;
  glow: boolean;
  grain: number;
  vignette: number;
}

/** Per-pattern options (see Generator.controls). Missing keys fall back to a seeded "auto" value. */
export type Opts = Record<string, number>;

export interface Layer {
  type: string;
  seed: number;
  blend: GlobalCompositeOperation;
  opacity: number;
  params?: Partial<Params>;
  opts?: Opts;
  /** Index of another layer whose alpha masks this one: this layer only shows where that one drew. */
  mask?: number;
}

export type CalmZone = 'off' | 'left' | 'right' | 'top' | 'bottom' | 'center';

/** Darkens (or, with a transparent background, fades out) part of the frame so text placed there stays readable. */
export interface Calm {
  zone: CalmZone;
  strength: number;
}

/** The full, serialisable description of a background. Same config = same pixels. */
export interface BackdropConfig {
  version: 1;
  type: string; // a generator key, 'chaos' (random layers) or 'stack' (two chosen layers)
  seed: number;
  palette: PaletteConfig;
  params: Params;
  opts?: Opts;
  calm?: Calm;
  layers?: Layer[];
}

export interface Palette {
  bg: string[];
  colors: string[];
  rgb: number[][];
  bgRgb: number[][];
}

export type Rng = (() => number) & {
  range(a: number, b: number): number;
  int(a: number, b: number): number;
  pick<T>(arr: readonly T[]): T;
};

export type Noise = (x: number, y?: number, z?: number) => number;

export interface GenContext {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** min(w,h)/1080. Multiply every pixel size by this so all resolutions look identical. */
  s: number;
  p: Params;
  pal: Palette;
  seed: number;
  rng: Rng;
  noise: Noise;
  /** true when every frame must be exact regardless of seek order (video rendering). */
  exact: boolean;
  /**
   * Loop period in pattern seconds (0 = not looping). When set, the frame at t + period must equal the
   * frame at t. The helpers below take care of that and behave like plain maths when period is 0.
   */
  period: number;
  /** Per-pattern option `key`, or `auto` when the user hasn't set it. Always compute `auto` (keeps rng order stable). */
  o(key: string, auto: number): number;
  /** Time-animated noise: noise(x, y, t * rate), but periodic in t when looping. */
  tn(x: number, y: number, t: number, rate: number): number;
  /**
   * Loop-quantise a rate so that rate * period is a whole multiple of `unit` (default TAU, i.e. whole
   * turns / sine cycles). With `min1` (default) a non-zero rate never snaps to 0.
   */
  lq(v: number, unit?: number, min1?: boolean): number;
  /**
   * Lifecycle helper for things that appear, travel and fade: returns [cycle index, progress 0..1] for a
   * lifetime of ~`dur` seconds. When looping, the lifetime is adjusted to divide the period and the
   * cycle index repeats every period, so hash(cycle) based randomness loops too.
   */
  cyc(t: number, dur: number, phase?: number): [number, number];
  c(i: number): string;
  drawGrain(c: CanvasRenderingContext2D, t: number, amount: number): void;
  buffer(): { buf: HTMLCanvasElement; bctx: CanvasRenderingContext2D };
  /** Stroke the current path (or `path`), adding an additive glow pass when params.glow is on. */
  stroke(path?: Path2D | null, c?: CanvasRenderingContext2D): void;
}

/** Draws one frame. `t` is pattern time in seconds (already multiplied by speed). */
export type DrawFn = (t: number) => void;

export interface Control {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface Generator {
  name: string;
  /** 'field' covers the whole frame with opaque pixels; 'shape' draws on a transparent canvas. */
  kind: 'field' | 'shape';
  /** false for stateful patterns that can't loop exactly; they fall back to a crossfade loop. */
  loops?: boolean;
  /** Pattern-specific sliders shown in the editor; values live in cfg.opts / layer.opts. */
  controls?: Control[];
  make(g: GenContext): DrawFn;
}
