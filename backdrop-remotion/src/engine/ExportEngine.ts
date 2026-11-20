/**
 * In-browser export (no CLI needed): renders frame-by-frame offline and encodes with WebCodecs.
 * For the Remotion pipeline (ProRes, GIF, H.265, server/Lambda rendering) see src/remotion.
 */
import { getAudioData } from '@remotion/media-utils';
import { analyzeAudio } from './AudioEngine';
import { createRenderer, type AudioFrame } from './MotionEngine';
import { clamp } from './rng';
import type { BackdropConfig } from './types';

export type ExportFormat = 'mp4' | 'webm' | 'png-seq' | 'png';

export interface ExportJob {
  cfg: BackdropConfig;
  width: number;
  height: number;
  fps: number;
  durationInSeconds: number;
  format: ExportFormat;
  /** Seamless loop; `loopFade` is the crossfade for patterns that can't loop natively. */
  loop?: boolean;
  loopFade?: number;
  /** Transparent background (PNG formats only; use the Remotion CLI for ProRes 4444 / VP9 alpha video). */
  transparent?: boolean;
  /** Audio-reactive motion. Quick export drives the motion from the track but writes no soundtrack. */
  audio?: { src: string; reactivity?: number } | null;
  /** Time of the still frame (format 'png'). */
  stillTime?: number;
  signal?: AbortSignal;
  onProgress?: (fraction: number, message: string) => void;
}

export interface ExportResult { blob: Blob; filename: string }

// MessageChannel yields aren't throttled like setTimeout when the tab is in the background.
const mc = new MessageChannel(), queue: (() => void)[] = [];
mc.port1.onmessage = () => queue.shift()?.();
const yieldUI = () => new Promise<void>(r => { queue.push(r); mc.port2.postMessage(0); });

const toPng = (cv: HTMLCanvasElement) => new Promise<Blob>((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));

async function pickCodec(list: string[], width: number, height: number, framerate: number, bitrate: number) {
  for (const codec of list) {
    try {
      const r = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate, latencyMode: 'quality' });
      if (r.supported && r.config) return r.config;
    } catch { /* try next */ }
  }
  return null;
}

export const baseName = (cfg: BackdropConfig, w: number, h: number) => `backdrop_${cfg.type}_${cfg.seed}_${w}x${h}`;

export async function runExport(job: ExportJob): Promise<ExportResult> {
  const { cfg, width: w, height: h, fps, format, signal, onProgress = () => {} } = job;
  const total = Math.round(fps * job.durationInSeconds), name = baseName(cfg, w, h);
  const transparent = !!job.transparent;
  if (transparent && (format === 'mp4' || format === 'webm')) throw new Error('MP4/WebM quick export has no alpha. Use PNG, or the Remotion CLI with ProRes 4444 / VP9.');
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const reactivity = job.audio?.src ? job.audio.reactivity ?? 1 : 0;
  let features: AudioFrame[] | null = null;
  if (reactivity > 0) {
    onProgress(0, 'Analysing audio…');
    features = analyzeAudio(await getAudioData(job.audio!.src), fps, total);
  }
  const r = createRenderer(cv, cfg, { exact: true, transparent, reactivity, loop: job.loop ? { length: total / fps, fade: job.loopFade ?? 1.5 } : null });
  const draw = (i: number) => r.render(i / fps, features?.[i] ?? null);
  const checkAbort = () => { if (signal?.aborted) throw new Error('Cancelled.'); };

  if (format === 'png') {
    const t = job.stillTime ?? 0;
    draw(Math.round(t * fps));
    return { blob: await toPng(cv), filename: `${name}_t${t.toFixed(2)}.png` };
  }

  if (format === 'png-seq') {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip(), pad = Math.max(5, String(total).length);
    for (let i = 0; i < total; i++) {
      checkAbort();
      draw(i);
      zip.file(`${name}_${String(i).padStart(pad, '0')}.png`, await toPng(cv));
      onProgress(((i + 1) / total) * 0.9, `Frame ${i + 1}/${total}`);
    }
    onProgress(0.9, 'Zipping…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, m => onProgress(0.9 + m.percent / 1000, 'Zipping…'));
    return { blob, filename: `${name}_png.zip` };
  }

  if (!('VideoEncoder' in window)) throw new Error('WebCodecs is not available. Use a recent Chrome or Edge, or render with the Remotion CLI.');
  const bitrate = Math.round(clamp(w * h * fps * 0.12, 4e6, 80e6));
  let config: VideoEncoderConfig | null;
  let addChunk: (c: EncodedVideoChunk, m?: EncodedVideoChunkMetadata) => void;
  let finish: () => ArrayBuffer;

  if (format === 'mp4') {
    const Mp4 = await import('mp4-muxer');
    config = await pickCodec(['avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.640028', 'avc1.4d0034', 'avc1.42003e'], w, h, fps, bitrate);
    if (!config) throw new Error(`No H.264 encoder supports ${w}×${h}@${fps}. Try WebM or the Remotion CLI.`);
    const muxer = new Mp4.Muxer({ target: new Mp4.ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' });
    addChunk = (c, m) => muxer.addVideoChunk(c, m); finish = () => { muxer.finalize(); return muxer.target.buffer; };
  } else {
    const Webm = await import('webm-muxer');
    config = await pickCodec(['vp09.00.51.08', 'vp09.00.41.08', 'vp09.00.31.08', 'vp8'], w, h, fps, bitrate);
    if (!config) throw new Error(`No VP9 encoder supports ${w}×${h}@${fps}.`);
    const muxer = new Webm.Muxer({ target: new Webm.ArrayBufferTarget(), video: { codec: config.codec === 'vp8' ? 'V_VP8' : 'V_VP9', width: w, height: h, frameRate: fps } });
    addChunk = (c, m) => muxer.addVideoChunk(c, m); finish = () => { muxer.finalize(); return muxer.target.buffer; };
  }

  let encErr: Error | null = null;
  const enc = new VideoEncoder({ output: (c, m) => addChunk(c, m), error: e => { encErr = e; } });
  enc.configure(config);
  const t0 = performance.now();
  let lastUI = 0;
  try {
    for (let i = 0; i < total; i++) {
      checkAbort();
      if (encErr) throw encErr;
      draw(i);
      const frame = new VideoFrame(cv, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      enc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (enc.encodeQueueSize > 6) await new Promise(res => enc.addEventListener('dequeue', res, { once: true }));
      if (performance.now() - lastUI > 120 || i === total - 1) {
        lastUI = performance.now();
        const rate = (i + 1) / ((performance.now() - t0) / 1000);
        onProgress((i + 1) / total, `Frame ${i + 1}/${total} · ${rate.toFixed(1)} fps · ETA ${((total - i - 1) / rate).toFixed(0)}s · ${config.codec}`);
        await yieldUI();
      }
    }
    await enc.flush();
  } finally {
    if (enc.state !== 'closed') enc.close();
  }
  return { blob: new Blob([finish()], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' }), filename: `${name}.${format}` };
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
