import { Composition } from 'remotion';
import { DEFAULT_CONFIG, makeChaos } from '../engine/SeedEngine';
import { Backdrop, type BackdropRenderProps } from './Backdrop';

const defaults: BackdropRenderProps = { cfg: DEFAULT_CONFIG, width: 1920, height: 1080, fps: 30, durationInSeconds: 10, loop: false, loopFade: 1.5 };

/**
 * Render any saved seed with:
 *   npm run render -- out/bg.mp4 --props=./my-seed.json
 * where my-seed.json is { "cfg": {...}, "width": 3840, "height": 2160, "fps": 60, "durationInSeconds": 20, "loop": true, "loopFade": 1.5 }
 * (the editor's "Download Remotion props" button writes exactly this file).
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Backdrop"
      component={Backdrop as React.FC<BackdropRenderProps>}
      defaultProps={defaults}
      width={defaults.width}
      height={defaults.height}
      fps={defaults.fps}
      durationInFrames={defaults.fps * defaults.durationInSeconds}
      calculateMetadata={({ props }) => ({
        width: Math.round(props.width / 2) * 2,
        height: Math.round(props.height / 2) * 2,
        fps: props.fps,
        durationInFrames: Math.max(1, Math.round(props.fps * props.durationInSeconds)),
      })}
    />
    {/* A ready-made chaos example to browse in Remotion Studio */}
    <Composition
      id="ChaosExample"
      component={Backdrop}
      defaultProps={{ cfg: makeChaos(4242), loop: true }}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={300}
    />
  </>
);
