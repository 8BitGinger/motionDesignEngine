import { getAudioDurationInSeconds } from '@remotion/media-utils';
import { Composition } from 'remotion';
import { DEFAULT_CONFIG, makeChaos } from '../engine/SeedEngine';
import { Backdrop, resolveAudioSrc, type BackdropRenderProps } from './Backdrop';

const defaults: BackdropRenderProps = {
  cfg: DEFAULT_CONFIG, width: 1920, height: 1080, fps: 30, durationInSeconds: 10, loop: false, loopFade: 1.5, transparent: false, audio: null,
};

/**
 * Render any saved look with:
 *   npm run render -- out/bg.mp4 --props=./my-look.json
 * where my-look.json is { "cfg": {...}, "width": 3840, "height": 2160, "fps": 60, "durationInSeconds": 20,
 *   "loop": true, "transparent": false, "audio": { "src": "track.mp3", "reactivity": 1, "matchLength": true } }
 * (the editor's "Download props" button writes exactly this file; audio files go in public/).
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
      calculateMetadata={async ({ props }) => {
        let seconds = props.durationInSeconds;
        if (props.audio?.src && props.audio.matchLength) seconds = await getAudioDurationInSeconds(resolveAudioSrc(props.audio.src));
        return {
          width: Math.round(props.width / 2) * 2,
          height: Math.round(props.height / 2) * 2,
          fps: props.fps,
          durationInFrames: Math.max(1, Math.round(props.fps * seconds)),
        };
      }}
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
