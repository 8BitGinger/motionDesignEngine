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

export interface Layer {
  type: string;
  seed: number;
  blend: GlobalCompositeOperation;
  opacity: number;
  params?: Partial<Params>;
}

/** The full, serialisable description of a background. Same config = same pixels. */
export interface BackdropConfig {
  version: 1;
  type: string; // a generator key, or 'chaos'
  seed: number;
  palette: PaletteConfig;
  params: Params;
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
  c(i: number): string;
  drawGrain(c: CanvasRenderingContext2D, t: number, amount: number): void;
  buffer(): { buf: HTMLCanvasElement; bctx: CanvasRenderingContext2D };
  /** Stroke the current path (or `path`), adding an additive glow pass when params.glow is on. */
  stroke(path?: Path2D | null, c?: CanvasRenderingContext2D): void;
}

/** Draws one frame. `t` is pattern time in seconds (already multiplied by speed). */
export type DrawFn = (t: number) => void;

export interface Generator {
  name: string;
  make(g: GenContext): DrawFn;
}
