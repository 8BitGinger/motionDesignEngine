import { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { createRenderer, type Renderer } from '../engine/MotionEngine';
import type { BackdropConfig } from '../engine/types';

export type BackdropProps = {
  cfg: BackdropConfig;
  /** Seamless loop: the last frame flows into the first. */
  loop?: boolean;
  /** Loop crossfade length in seconds (default 1.5). */
  loopFade?: number;
};

/** Everything Remotion needs to render a file: the look (cfg) plus output settings. */
export type BackdropRenderProps = BackdropProps & {
  width: number;
  height: number;
  fps: number;
  durationInSeconds: number;
};

/**
 * Remotion composition. Draws synchronously in a layout effect, so the frame is complete
 * before Remotion screenshots it — no delayRender needed. Used by both the Player
 * (editor preview) and the CLI renderer.
 */
export const Backdrop: React.FC<BackdropProps> = ({ cfg, loop = false, loopFade = 1.5 }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<{ key: string; r: Renderer } | null>(null);
  const loopOpt = loop ? { length: durationInFrames / fps, fade: loopFade } : null;
  const key = `${width}x${height}:${JSON.stringify(cfg)}:${JSON.stringify(loopOpt)}`;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (rendererRef.current?.key !== key) rendererRef.current = { key, r: createRenderer(canvas, cfg, { exact: true, loop: loopOpt }) };
    rendererRef.current.r.render(frame / fps);
  }, [frame, fps, key, cfg]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: '100%', display: 'block' }} />
    </AbsoluteFill>
  );
};
