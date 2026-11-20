import { visualizeAudio, type MediaUtilsAudioData } from '@remotion/media-utils';
import type { AudioFrame } from './MotionEngine';

const cache = new WeakMap<MediaUtilsAudioData, Map<string, AudioFrame[]>>();

const percentile = (arr: Float32Array, q: number) => {
  const s = Array.from(arr).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] || 1;
};

/**
 * Per-frame audio features for a whole track: bass / mid / treble / level in 0..1 plus `warp`, the
 * running sum of loudness (seconds). Computed once for every frame in order, so any single frame can be
 * rendered in isolation (parallel Remotion tabs) and still get identical values.
 */
export function analyzeAudio(audioData: MediaUtilsAudioData, fps: number, frames: number): AudioFrame[] {
  const key = `${fps}:${frames}`;
  const hit = cache.get(audioData)?.get(key);
  if (hit) return hit;

  const N = frames, bass = new Float32Array(N), mid = new Float32Array(N), treb = new Float32Array(N);
  const lastFrame = Math.floor(audioData.durationInSeconds * fps) - 1;
  for (let f = 0; f < N && f <= lastFrame; f++) {
    const v = visualizeAudio({ fps, frame: f, audioData, numberOfSamples: 64 });
    let b = 0, m = 0, t = 0;
    for (let i = 0; i < 64; i++) { if (i < 4) b += v[i]; else if (i < 16) m += v[i]; else t += v[i]; }
    bass[f] = b / 4; mid[f] = m / 12; treb[f] = t / 48;
  }
  // Normalise each band to its own loud passages, so quiet tracks still react.
  const nb = percentile(bass, 0.95), nm = percentile(mid, 0.95), nt = percentile(treb, 0.95);
  const out: AudioFrame[] = new Array(N);
  let eb = 0, em = 0, et = 0, warp = 0;
  for (let f = 0; f < N; f++) {
    // Envelope: instant attack, smooth release (so hits read as pulses, not flicker).
    eb = Math.max(Math.min(1, bass[f] / nb), eb * 0.82);
    em = Math.max(Math.min(1, mid[f] / nm), em * 0.86);
    et = Math.max(Math.min(1, treb[f] / nt), et * 0.8);
    const level = 0.5 * eb + 0.3 * em + 0.2 * et;
    out[f] = { level, bass: eb, mid: em, treble: et, warp };
    warp += level / fps;
  }
  if (!cache.has(audioData)) cache.set(audioData, new Map());
  cache.get(audioData)!.set(key, out);
  return out;
}
