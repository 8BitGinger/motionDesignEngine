# Backdrop Studio — React + Remotion

Seeded, procedural motion backgrounds (29 patterns + a Chaos layer-stacker) drawn with Canvas 2D,
previewed with the Remotion Player and rendered to video with the Remotion CLI.

## Run

```
npm install
npm run dev        # editor at http://localhost:5518
npm run studio     # Remotion Studio (browse the "Backdrop" and "ChaosExample" compositions)
```

## Render a background

1. In the editor, design a look, pick size/FPS/duration, choose a codec under **Render with Remotion**.
2. Click **Download props** and save the JSON into this folder.
3. Run the copied command, e.g.

```
npm run render -- out/my-bg.mp4 --props=./my-bg.json --codec=h264
```

Other codecs: `--codec=h265`, `--codec=vp9`, `--codec=prores --prores-profile=4444`, `--codec=gif --every-nth-frame=2`,
or a PNG sequence with `--sequence --image-format=png`. Stills: `npm run still -- out/frame.png --props=./my-bg.json --frame=120`.

The props file is `{ cfg, width, height, fps, durationInSeconds, loop, loopFade }`; `cfg` is the seed JSON shown in the
editor. See `examples/flowfield-ocean.json` and `examples/galaxy-loop.json`.

## Seamless loops

Tick **Seamless loop** (on by default) and the last frame flows straight into the first, so the clip can repeat
forever. The first `loopFade` seconds crossfade from the pattern's state at *t + duration* into *t*: frame 0 is
exactly where the last frame is heading. It works for every pattern and for Chaos stacks, because a second copy of
the scene renders the "ahead" time (so Flow Field only ever simulates forward). Longer crossfades hide the blend
better; a fade can be at most half the clip.

The editor also has a **Quick export** (WebCodecs, in-browser MP4/WebM/PNG) for when you don't want the CLI.

## Layout

```
src/
  engine/       rng + noise, ColorEngine, SeedEngine (chaos, validation), MotionEngine (renderer), ExportEngine (WebCodecs)
  generators/   one file per pattern; index.ts is the registry
  presets/      themes.json
  remotion/     Backdrop composition (shared by Player and CLI), Root, entry
  ui/           React editor
```

Add a pattern: create `src/generators/<name>.ts` exporting a `Generator` (`make(g) => (t) => draw`), register it in
`generators/index.ts`. Scale every pixel size by `g.s` and derive motion from `t` + `g.rng` so it is deterministic.

## Notes

- Frames are a pure function of (config, time), so Remotion can render frames in parallel. The one stateful
  pattern, Flow Field, re-simulates from t=0 when seeked, so its frames match across tabs too.
- Windows: Remotion spawns `ffmpeg.exe` and a headless Chrome from `node_modules`. If the project lives in a folder
  whose path is very long (over ~150 characters), those spawns fail with `ENOENT` because of the 260-character path
  limit. Keep the project in a short path such as `C:\dev\backdrop`.
