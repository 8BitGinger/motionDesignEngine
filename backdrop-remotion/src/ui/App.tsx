import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PALETTE_MODES, THEMES, THEME_KEYS, buildPalette } from '../engine/ColorEngine';
import { downloadBlob, runExport, baseName, type ExportFormat } from '../engine/ExportEngine';
import { DEFAULT_CONFIG, makeChaos, normalizeConfig, randSeed } from '../engine/SeedEngine';
import type { BackdropConfig, Params } from '../engine/types';
import { GENERATORS, GENERATOR_KEYS } from '../generators';
import { Backdrop, type BackdropRenderProps } from '../remotion/Backdrop';
import { ASPECTS, QUALITIES, type OutputSettings, outputSize, previewSize, sizeFor } from './output';
import { Thumbnail } from './Thumbnail';

const TYPES = [...GENERATOR_KEYS, 'chaos'];
const typeLabel = (k: string) => (k === 'chaos' ? `${GENERATOR_KEYS.length + 1} · Chaos` : `${GENERATOR_KEYS.indexOf(k) + 1} · ${GENERATORS[k].name}`);

const REMOTION_CODECS = [
  { value: 'h264', label: 'MP4 · H.264', ext: 'mp4', flags: '--codec=h264' },
  { value: 'h265', label: 'MP4 · H.265', ext: 'mp4', flags: '--codec=h265' },
  { value: 'vp9', label: 'WebM · VP9', ext: 'webm', flags: '--codec=vp9' },
  { value: 'prores', label: 'MOV · ProRes 4444', ext: 'mov', flags: '--codec=prores --prores-profile=4444' },
  { value: 'gif', label: 'GIF', ext: 'gif', flags: '--codec=gif --every-nth-frame=2' },
  { value: 'png', label: 'PNG sequence', ext: '', flags: '--sequence --image-format=png' },
];

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="range">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
      <output>{value.toFixed(step < 1 ? 2 : 0)}</output>
    </div>
  );
}

export function App() {
  const [cfg, setCfg] = useState<BackdropConfig>(DEFAULT_CONFIG);
  const [out, setOut] = useState<OutputSettings>({ aspect: '16:9', quality: '1080', customW: 1920, customH: 1080 });
  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(10);
  const [loop, setLoop] = useState(true);
  const [loopFade, setLoopFade] = useState(1.5);
  const [lockPalette, setLockPalette] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonFocused, setJsonFocused] = useState(false);
  const [jsonStatus, setJsonStatus] = useState('');
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [codec, setCodec] = useState('h264');
  const abortRef = useRef<AbortController | null>(null);
  const playerRef = useRef<PlayerRef>(null);

  const { w, h } = outputSize(out);
  const pv = previewSize(w, h);
  const custom = out.aspect === 'custom' || out.quality === 'custom';
  const durationInFrames = Math.max(1, Math.round(fps * duration));
  const pal = useMemo(() => buildPalette(cfg.palette), [cfg.palette]);
  const fade = Math.min(loopFade, duration / 2);
  const inputProps = useMemo(() => ({ cfg, loop, loopFade: fade }), [cfg, loop, fade]);
  const renderProps: BackdropRenderProps = { cfg, width: w, height: h, fps, durationInSeconds: duration, loop, loopFade: fade };
  const name = baseName(cfg, w, h);

  useEffect(() => { if (!jsonFocused) setJsonText(JSON.stringify(cfg, null, 2)); }, [cfg, jsonFocused]);

  const setParam = <K extends keyof Params>(k: K, v: Params[K]) => setCfg(c => ({ ...c, params: { ...c.params, [k]: v } }));
  const setPalette = (patch: Partial<BackdropConfig['palette']>) => setCfg(c => ({ ...c, palette: { ...c.palette, ...patch } }));
  const chaos = () => setCfg(c => makeChaos(randSeed(), lockPalette ? c.palette : null));
  const pickType = (t: string) => {
    if (t === 'chaos') return chaos();
    setCfg(c => { const { layers: _drop, ...rest } = c; return { ...rest, type: t }; });
  };
  const reseed = () => setCfg(c => (c.type === 'chaos' ? makeChaos(randSeed(), lockPalette ? c.palette : null) : { ...c, seed: randSeed() }));
  const setOutput = (patch: Partial<OutputSettings>) =>
    setOut(o => {
      const n = { ...o, ...patch };
      // When switching into custom, seed the inputs with the current size.
      if ((n.aspect === 'custom' || n.quality === 'custom') && !(o.aspect === 'custom' || o.quality === 'custom')) {
        const cur = outputSize(o); n.customW = cur.w; n.customH = cur.h;
      }
      return n;
    });

  const applyJson = () => {
    try {
      setCfg(normalizeConfig(JSON.parse(jsonText)));
      setJsonStatus('Applied.'); setJsonFocused(false);
    } catch (e) { setJsonStatus('Error: ' + (e as Error).message); }
  };
  const copyText = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); setJsonStatus(msg); } catch { setJsonStatus('Clipboard blocked — select the text and copy it.'); }
  };

  const doExport = async () => {
    const ac = new AbortController(); abortRef.current = ac;
    setBusy(true); setProgress(0); setStatus('Preparing…');
    const t0 = performance.now();
    try {
      const stillTime = (playerRef.current?.getCurrentFrame() ?? 0) / fps;
      const res = await runExport({ cfg, width: w, height: h, fps, durationInSeconds: duration, format, stillTime, loopFade: loop ? fade : 0, signal: ac.signal, onProgress: (f, m) => { setProgress(f); setStatus(m); } });
      downloadBlob(res.blob, res.filename);
      setProgress(1); setStatus(`Done in ${((performance.now() - t0) / 1000).toFixed(1)}s · ${(res.blob.size / 1e6).toFixed(1)} MB`);
    } catch (e) { console.error(e); setProgress(0); setStatus((e as Error).message); }
    finally { setBusy(false); abortRef.current = null; }
  };

  const rc = REMOTION_CODECS.find(c => c.value === codec)!;
  const outPath = rc.ext ? `out/${name}.${rc.ext}` : `out/${name}`;
  const command = `npm run render -- ${outPath} --props=./${name}.json ${rc.flags}`;
  const downloadProps = () => downloadBlob(new Blob([JSON.stringify(renderProps, null, 2)], { type: 'application/json' }), `${name}.json`);

  return (
    <div className="app">
      <aside>
        <h1>Backdrop Studio</h1>
        <div className="sub">Seeded motion backgrounds · React + Remotion · Canvas 2D</div>

        <section>
          <h2>Output</h2>
          <div className="row">
            <div>
              <label>Aspect ratio</label>
              <select value={out.aspect} onChange={e => setOutput({ aspect: e.target.value })}>
                {Object.keys(ASPECTS).map(a => <option key={a}>{a}</option>)}
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label>Resolution</label>
              <select value={out.quality} onChange={e => setOutput({ quality: e.target.value })}>
                {QUALITIES.map(q => {
                  const s = out.aspect !== 'custom' ? sizeFor(out.aspect, q.value) : null;
                  return <option key={q.value} value={q.value}>{q.label}{s ? ` (${s.w}×${s.h})` : ''}</option>;
                })}
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          {custom && (
            <div className="row">
              <div><label>Width</label><input type="number" min={64} max={7680} step={2} value={out.customW} onChange={e => setOutput({ customW: +e.target.value })} /></div>
              <div><label>Height</label><input type="number" min={64} max={7680} step={2} value={out.customH} onChange={e => setOutput({ customH: +e.target.value })} /></div>
            </div>
          )}
          <div className="row">
            <div><label>FPS</label><select value={fps} onChange={e => setFps(+e.target.value)}>{[24, 25, 30, 50, 60].map(f => <option key={f}>{f}</option>)}</select></div>
            <div><label>Duration (s)</label><input type="number" min={1} max={600} value={duration} onChange={e => setDuration(Math.min(600, Math.max(1, +e.target.value || 1)))} /></div>
          </div>
          <label className="check"><input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} /> Seamless loop</label>
          {loop && <Range label="Crossfade" value={fade} min={0.25} max={Math.max(0.25, Math.min(5, duration / 2))} step={0.05} onChange={setLoopFade} />}
          <div className="dims">{w} × {h} px · {durationInFrames} frames{loop ? ' · last frame flows into the first' : ''}</div>
        </section>

        <section>
          <h2>Pattern</h2>
          <div className="types">
            {TYPES.map((k, i) => {
              const thumbCfg: BackdropConfig = k === 'chaos' ? makeChaos(4242, cfg.palette) : { ...cfg, type: k, seed: 7, layers: undefined, params: { ...cfg.params, speed: 1 } };
              return (
                <button key={k} className={'type' + (cfg.type === k ? ' on' : '')} onClick={() => pickType(k)}>
                  <Thumbnail cfg={thumbCfg} delay={i * 15} />
                  <b>{typeLabel(k)}</b>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2>Color</h2>
          <label>Mode</label>
          <select value={cfg.palette.mode} onChange={e => setPalette({ mode: e.target.value as BackdropConfig['palette']['mode'] })}>
            {PALETTE_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {cfg.palette.mode === 'theme' && (
            <>
              <label>Theme</label>
              <div className="themes">
                {THEME_KEYS.map(k => (
                  <button key={k} title={k} className={'theme' + (cfg.palette.theme === k ? ' on' : '')} onClick={() => setPalette({ theme: k })}>
                    {THEMES[k].colors.slice(0, 4).map(c => <i key={c} style={{ background: c }} />)}
                  </button>
                ))}
              </div>
            </>
          )}
          {cfg.palette.mode !== 'theme' && cfg.palette.mode !== 'custom' && (
            <>
              <Range label="Hue" value={cfg.palette.hue ?? 265} min={0} max={359} step={1} onChange={v => setPalette({ hue: v })} />
              {cfg.palette.mode === 'dual' && <Range label="Hue 2" value={cfg.palette.hue2 ?? 320} min={0} max={359} step={1} onChange={v => setPalette({ hue2: v })} />}
            </>
          )}
          {cfg.palette.mode === 'custom' && (
            <>
              <label>Hex colors (comma separated)</label>
              <input type="text" placeholder="#ff2bd6, #00f0ff, #7a3cff" defaultValue={(cfg.palette.custom ?? []).join(', ')}
                onChange={e => setPalette({ custom: e.target.value.split(/[\s,]+/).filter(Boolean) })} />
            </>
          )}
          <div className="swatches">{[...pal.bg, ...pal.colors].map((c, i) => <i key={i} style={{ background: c }} />)}</div>
          <label className="check"><input type="checkbox" checked={lockPalette} onChange={e => setLockPalette(e.target.checked)} /> Lock palette when randomizing</label>
        </section>

        <section>
          <h2>Motion</h2>
          <Range label="Speed" value={cfg.params.speed} min={0.1} max={3} step={0.05} onChange={v => setParam('speed', v)} />
          <Range label="Density" value={cfg.params.density} min={0.2} max={2} step={0.05} onChange={v => setParam('density', v)} />
          <Range label="Grain" value={cfg.params.grain} min={0} max={1} step={0.01} onChange={v => setParam('grain', v)} />
          <Range label="Vignette" value={cfg.params.vignette} min={0} max={1} step={0.01} onChange={v => setParam('vignette', v)} />
          <label className="check"><input type="checkbox" checked={cfg.params.glow} onChange={e => setParam('glow', e.target.checked)} /> Glow (additive, no blur filters)</label>
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={reseed} title="New seed, same pattern">New seed</button>
            <button className="primary" onClick={chaos} title="Randomize everything">Chaos</button>
          </div>
        </section>

        <section>
          <h2>Seed</h2>
          <textarea spellCheck={false} value={jsonText} onFocus={() => setJsonFocused(true)} onChange={e => setJsonText(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => copyText(JSON.stringify(cfg, null, 2), 'Copied.')}>Copy</button>
            <button onClick={applyJson}>Apply JSON</button>
          </div>
          <div className="status">{jsonStatus}</div>
        </section>

        <section>
          <h2>Render with Remotion</h2>
          <label>Codec</label>
          <select value={codec} onChange={e => setCodec(e.target.value)}>{REMOTION_CODECS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={downloadProps}>Download props</button>
            <button onClick={() => copyText(command, 'Command copied.')}>Copy command</button>
          </div>
          <pre className="cmd">{command}</pre>
          <div className="hint">Save the props file in the project folder, then run the command. Uses all CPU cores and supports ProRes, H.265 and GIF.</div>
        </section>

        <section>
          <h2>Quick export (in browser)</h2>
          <label>Format</label>
          <select value={format} onChange={e => setFormat(e.target.value as ExportFormat)}>
            <option value="mp4">MP4 (H.264)</option>
            <option value="webm">WebM (VP9)</option>
            <option value="png-seq">PNG sequence (.zip)</option>
            <option value="png">PNG still (current frame)</option>
          </select>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" disabled={busy} onClick={doExport}>Render</button>
            <button disabled={!busy} onClick={() => abortRef.current?.abort()}>Cancel</button>
          </div>
          <div className="progress"><i style={{ width: `${(progress * 100).toFixed(1)}%` }} /></div>
          <div className="status">{status}</div>
        </section>
      </aside>

      <main>
        <div className="stage">
          <Player
            ref={playerRef}
            component={Backdrop}
            inputProps={inputProps}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={pv.w}
            compositionHeight={pv.h}
            style={{ width: '100%', height: '100%' }}
            controls
            loop
            autoPlay
            acknowledgeRemotionLicense
          />
        </div>
      </main>
    </div>
  );
}
