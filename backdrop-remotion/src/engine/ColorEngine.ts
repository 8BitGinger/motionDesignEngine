import themesJson from '../presets/themes.json';
import { clamp, lerp, mod } from './rng';
import type { Palette, PaletteConfig, PaletteMode } from './types';

export const THEMES: Record<string, { bg: string[]; colors: string[] }> = themesJson;
export const THEME_KEYS = Object.keys(THEMES);
export const PALETTE_MODES: { value: PaletteMode; label: string }[] = [
  { value: 'theme', label: 'Preset theme' }, { value: 'single', label: 'Single color' }, { value: 'dual', label: 'Dual gradient' },
  { value: 'triadic', label: 'Triadic' }, { value: 'analogous', label: 'Analogous' }, { value: 'complementary', label: 'Complementary' },
  { value: 'custom', label: 'Custom palette' },
];

export const hexToRgb = (hex: string): number[] => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export const rgba = (hex: string, a = 1) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1).toFixed(3)})`;
};
export const mixHex = (a: string, b: string, t: number) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
};
export const isHex = (s: string) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());

export function hsl2hex(h: number, s: number, l: number) {
  h = mod(h, 360) / 360;
  const f = (n: number) => {
    const k = mod(n + h * 12, 12), a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export function hexToHsl(hex: string) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

export function buildPalette(pc: PaletteConfig): Palette {
  let bg: string[], colors: string[];
  if (pc.mode === 'theme') {
    const th = THEMES[pc.theme ?? ''] ?? THEMES.cyberpunk;
    bg = th.bg; colors = th.colors;
  } else if (pc.mode === 'custom') {
    colors = (pc.custom ?? []).filter(isHex).map(c => '#' + c.trim().replace('#', ''));
    if (!colors.length) colors = ['#ffffff'];
    const d = hexToHsl(colors[0]);
    bg = [hsl2hex(d.h, d.s * 0.6, 0.05), hsl2hex(d.h + 20, d.s * 0.6, 0.11)];
  } else {
    const H = pc.hue ?? 265, H2 = pc.hue2 ?? 320;
    const table: Record<string, number[]> = {
      single: [H], dual: [H, H2], triadic: [H, H + 120, H + 240], analogous: [H - 30, H, H + 30], complementary: [H, H + 180],
    };
    const hues = table[pc.mode] ?? [H];
    colors = [...hues.map(h => hsl2hex(h, 0.85, 0.58)), ...hues.map(h => hsl2hex(h + 8, 0.9, 0.74))];
    if (pc.mode === 'single') colors.push(hsl2hex(H, 0.75, 0.42), hsl2hex(H - 6, 0.9, 0.86));
    bg = [hsl2hex(H, 0.55, 0.05), hsl2hex(pc.mode === 'dual' ? H2 : H + 15, 0.55, 0.12)];
  }
  return { bg, colors, rgb: colors.map(hexToRgb), bgRgb: bg.map(hexToRgb) };
}
