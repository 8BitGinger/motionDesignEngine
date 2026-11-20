import { useAudioData } from '@remotion/media-utils';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { analyzeAudio } from '../engine/AudioEngine';
import { createRenderer, type AudioFrame, type Renderer } from '../engine/MotionEngine';
import type { BackdropConfig } from '../engine/types';

export type AudioProps = {
  /** A URL, or a file name inside the project's `public/` folder (used by CLI renders). */
  src: string;
  /** 0..2, how strongly the music drives the motion (default 1). */
  reactivity?: number;
  /** Soundtrack volume in the output, 0..1 (default 1). */
  volume?: number;
  /** Make the composition exactly as long as the track (CLI renders). */
  matchLength?: boolean;
};

export type GuideKind = 'none' | 'safe' | 'social' | 'thirds';

export type BackdropProps = {
  cfg: BackdropConfig;
  /** Seamless loop: the last frame flows into the first. */
  loop?: boolean;
  /** Crossfade length (s) for patterns that can't loop natively (default 1.5). */
  loopFade?: number;
  /** Transparent background (use ProRes 4444, VP9 or PNG output to keep the alpha). */
  transparent?: boolean;
  /** Audio-reactive mode: motion surges with loudness, zooms and flashes on bass. Also adds the track to the output. */
  audio?: AudioProps | null;
  /** Editor-only overlay. Never set this in a render props file. */
  guides?: GuideKind;
};

/** Everything Remotion needs to render a file: the look plus output settings. */
export type BackdropRenderProps = BackdropProps & {
  width: number;
  height: number;
  fps: number;
  durationInSeconds: number;
};

export const resolveAudioSrc = (src: string) => (/^(https?:|blob:|data:|\/)/.test(src) ? src : staticFile(src));

/**
 * Remotion composition. Draws synchronously in a layout effect, so the frame is complete before Remotion
 * screenshots it. Used by both the Player (editor preview) and the CLI renderer.
 */
export const Backdrop: React.FC<BackdropProps> = props =>
  props.audio?.src ? <WithAudio {...props} audio={props.audio} /> : <BackdropCanvas {...props} features={null} />;

const WithAudio: React.FC<BackdropProps & { audio: AudioProps }> = props => {
  const src = resolveAudioSrc(props.audio.src);
  const { fps, durationInFrames } = useVideoConfig();
  // useAudioData holds the render (delayRender) until the track is decoded, so CLI frames never miss it.
  const data = useAudioData(src);
  const features = useMemo(() => (data ? analyzeAudio(data, fps, durationInFrames) : null), [data, fps, durationInFrames]);
  return (
    <>
      <BackdropCanvas {...props} features={features} />
      <Audio src={src} volume={props.audio.volume ?? 1} />
    </>
  );
};

const BackdropCanvas: React.FC<BackdropProps & { features: AudioFrame[] | null }> = ({ cfg, loop = false, loopFade = 1.5, transparent = false, audio, guides = 'none', features }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<{ key: string; r: Renderer } | null>(null);
  const reactivity = audio?.src ? audio.reactivity ?? 1 : 0;
  const loopOpt = loop ? { length: durationInFrames / fps, fade: loopFade } : null;
  const key = `${width}x${height}:${JSON.stringify(cfg)}:${JSON.stringify(loopOpt)}:${transparent}:${reactivity}`;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (rendererRef.current?.key !== key) {
      rendererRef.current = { key, r: createRenderer(canvas, cfg, { exact: true, loop: loopOpt, transparent, reactivity }) };
    }
    rendererRef.current.r.render(frame / fps, features?.[frame] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, fps, key, features]);

  return (
    <AbsoluteFill style={{ backgroundColor: transparent ? 'transparent' : '#000' }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%', display: 'block' }} />
      {guides !== 'none' && <Guides kind={guides} />}
    </AbsoluteFill>
  );
};

/** Composition overlays for layout. Only the editor passes `guides`, so they never reach a render. */
function Guides({ kind }: { kind: GuideKind }) {
  const line = { fill: 'none', stroke: 'rgba(255,255,255,.75)', strokeWidth: 0.25, vectorEffect: 'non-scaling-stroke' as const };
  const zone = { fill: 'rgba(255,40,80,.18)', stroke: 'rgba(255,80,110,.8)', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const };
  const label = { fill: '#fff', fontSize: 2.4, fontFamily: 'system-ui, sans-serif' };
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {kind === 'safe' && (
        <>
          <rect x={3.5} y={3.5} width={93} height={93} {...line} strokeDasharray="1 1" />
          <rect x={5} y={5} width={90} height={90} {...line} />
          <text x={5.6} y={8.5} {...label}>title safe 90%</text>
        </>
      )}
      {kind === 'thirds' && (
        <>
          {[33.333, 66.667].map(v => <line key={'v' + v} x1={v} y1={0} x2={v} y2={100} {...line} />)}
          {[33.333, 66.667].map(v => <line key={'h' + v} x1={0} y1={v} x2={100} y2={v} {...line} />)}
        </>
      )}
      {kind === 'social' && (
        <>
          {/* Typical vertical-video UI: status/header on top, caption + buttons at the bottom, action rail on the right. */}
          <rect x={0} y={0} width={100} height={12} {...zone} />
          <rect x={0} y={78} width={100} height={22} {...zone} />
          <rect x={86} y={40} width={14} height={38} {...zone} />
          <rect x={6} y={12} width={80} height={66} {...line} />
          <text x={7} y={16} {...label}>content safe</text>
        </>
      )}
    </svg>
  );
}
