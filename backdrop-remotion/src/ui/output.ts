export const ASPECTS: Record<string, [number, number]> = { '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1], '4:5': [4, 5], '21:9': [21, 9] };
export const QUALITIES = [
  { value: '1080', label: '1080p' },
  { value: '1440', label: '1440p' },
  { value: '2160', label: '4K' },
];

export interface OutputSettings {
  aspect: string; // key of ASPECTS or 'custom'
  quality: string; // '1080' | '1440' | '2160' | 'custom'
  customW: number;
  customH: number;
}

const even = (v: number) => Math.round(v / 2) * 2;

/** Quality is the length of the short side, so 9:16 @ 1080p = 1080×1920. */
export function sizeFor(aspect: string, quality: string) {
  const [x, y] = ASPECTS[aspect], sh = +quality;
  return x >= y ? { w: even((sh * x) / y), h: sh } : { w: sh, h: even((sh * y) / x) };
}

export function outputSize(o: OutputSettings) {
  if (o.aspect === 'custom' || o.quality === 'custom') return { w: Math.max(64, even(o.customW)), h: Math.max(64, even(o.customH)) };
  return sizeFor(o.aspect, o.quality);
}

/** Preview size: same aspect, long side capped. Generators are resolution independent. */
export function previewSize(w: number, h: number, maxSide = 1280) {
  const k = Math.min(1, maxSide / Math.max(w, h));
  return { w: even(w * k), h: even(h * k) };
}
