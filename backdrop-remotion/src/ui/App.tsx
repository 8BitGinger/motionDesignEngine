import { getAudioDurationInSeconds } from '@remotion/media-utils';
import { Player, type PlayerRef } from '@remotion/player';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PALETTE_MODES, THEMES, THEME_KEYS, buildPalette } from '../engine/ColorEngine';
import { downloadBlob, runExport, baseName, type ExportFormat } from '../engine/ExportEngine';
import { CALM_ZONES, DEFAULT_CONFIG, makeChaos, mutate, normalizeConfig, randSeed } from '../engine/SeedEngine';
import type { BackdropConfig, CalmZone, Control, Layer, Opts, Params } from '../engine/types';
import { GENERATORS, GENERATOR_KEYS } from '../generators';
import { Backdrop, type BackdropRenderProps, type GuideKind } from '../remotion/Backdrop';
import {
  cfgId, clearHistory, decodeShare, encodeShare, loadFavorites, loadHistory, pushHistory, removeFavorite, toggleFavorite, type LibraryEntry,
} from './library';
import { ASPECTS, QUALITIES, type OutputSettings, outputSize, previewSize, sizeFor } from './output';
import { Thumbnail } from './Thumbnail';

const TYPES = [...GENERATOR_KEYS, 'chaos'];
const nameOf = (k: string) => (k === 'chaos' ? 'Chaos' : GENERATORS[k]?.name ?? k);
const typeLabel = (k: string) => (k === 'chaos' ? `${GENERATOR_KEYS.length + 1} · Chaos` : `${GENERATOR_KEYS.indexOf(k) + 1} · ${GENERATORS[k].name}`);

const REMOTION_CODECS = [
  { value: 'h264', label: 'MP4 · H.264', ext: 'mp4', flags: '--codec=h264', alpha: false },
  { value: 'h265', label: 'MP4 · H.265', ext: 'mp4', flags: '--codec=h265', alpha: false },
  { value: 'vp9', label: 'WebM · VP9', ext: 'webm', flags: '--codec=vp9', alpha: true, alphaFlags: '--codec=vp9 --image-format=png --pixel-format=yuva420p' },
  { value: 'prores', label: 'MOV · ProRes 4444', ext: 'mov', flags: '--codec=prores --prores-profile=4444', alpha: true, alphaFlags: '--codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le' },
  { value: 'gif', label: 'GIF', ext: 'gif', flags: '--codec=gif --every-nth-frame=2', alpha: false },
  { value: 'png', label: 'PNG sequence', ext: '', flags: '--sequence --image-format=png', alpha: true, alphaFlags: '--sequence --image-format=png' },
];
const GUIDES: { value: GuideKind; label: string }[] = [
  { value: 'none', label: 'No guides' }, { value: 'safe', label: 'Title / action safe' }, { value: 'social', label: 'Social (vertical UI zones)' }, { value: 'thirds', label: 'Rule of thirds' },
];

function Range({ label, value, min, max, step, onChange, display }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display?: string }) {
  return (
    <div className="range">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
      <output>{display ?? value.toFixed(step < 1 ? 2 : 0)}</output>
    </div>
  );
}

/** Pattern-specific sliders. An unset control shows "auto" (seeded); ↺ returns it to auto. */
function Controls({ controls, opts, onChange }: { controls: Control[]; opts: Opts | undefined; onChange: (o: Opts | undefined) => void }) {
  const set = (k: string, v: number | null) => {
    const n: Opts = { ...(opts ?? {}) };
    if (v === null) delete n[k]; else n[k] = v;
    onChange(Object.keys(n).length ? n : undefined);
  };
  return (
    <>
      {controls.map(c => {
        const v = opts?.[c.key], has = typeof v === 'number';
        return (
          <div key={c.key} className="ctl">
            <Range label={c.label} min={c.min} max={c.max} step={c.step} value={has ? v : (c.min + c.max) / 2} onChange={x => set(c.key, x)}
              display={has ? v.toFixed(c.step < 1 ? 2 : 0) : 'auto'} />
            <button className="mini" title="Back to auto (seeded)" disabled={!has} onClick={() => set(c.key, null)}>↺</button>
          </div>
        );
      })}
    </>
  );
}

function LibraryGrid({ entries, onPick, onRemove }: { entries: LibraryEntry[]; onPick: (c: BackdropConfig) => void; onRemove?: (id: string) => void }) {
  if (!entries.length) return <div className="hint">Nothing here yet.</div>;
  return (
    <div className="types">
      {entries.map((e, i) => (
        <div key={e.id} className="lib">
          <button className="type" onClick={() => onPick(e.cfg)} title={`${nameOf(e.cfg.type)} · seed ${e.cfg.seed}`}>
            <Thumbnail cfg={e.cfg} delay={i * 20} />
            <b>{nameOf(e.cfg.type)}</b>
          </button>
          {onRemove && <button className="x" title="Remove" onClick={() => onRemove(e.id)}>×</button>}
        </div>
      ))}
    </div>
  );
}

const initial = decodeShare(typeof location !== 'undefined' ? location.hash : '');

export function App() {
  const [cfg, setCfgRaw] = useState<BackdropConfig>(initial?.cfg ?? DEFAULT_CONFIG);
  const [out, setOut] = useState<OutputSettings>({
    aspect: initial?.aspect ?? '16:9', quality: initial?.quality ?? '1080', customW: initial?.customW ?? 1920, customH: initial?.customH ?? 1080,
  });
  const [fps, setFps] = useState(initial?.fps ?? 30);
  const [duration, setDuration] = useState(initial?.duration ?? 10);
  const [loop, setLoop] = useState(initial?.loop ?? true);
  const [loopFade, setLoopFade] = useState(1.5);
  const [transparent, setTransparent] = useState(initial?.transparent ?? false);
  const [guides, setGuides] = useState<GuideKind>('none');
  const [audio, setAudio] = useState<{ url: string; name: string; reactivity: number; volume: number; seconds: number } | null>(null);
  const [lockPalette, setLockPalette] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonFocused, setJsonFocused] = useState(false);
  const [msg, setMsg] = useState('');
  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [codec, setCodec] = useState('h264');
  const [batch, setBatch] = useState(false);
  const [libTab, setLibTab] = useState<'fav' | 'hist'>('fav');
  const [favorites, setFavorites] = useState<LibraryEntry[]>(loadFavorites);
  const [history, setHistory] = useState<LibraryEntry[]>(loadHistory);
  const abortRef = useRef<AbortController | null>(null);
  const playerRef = useRef<PlayerRef>(null);

  const { w, h } = outputSize(out);
  const pv = previewSize(w, h);
  const custom = out.aspect === 'custom' || out.quality === 'custom';
  const durationInFrames = Math.max(1, Math.round(fps * duration));
  const pal = useMemo(() => buildPalette(cfg.palette), [cfg.palette]);
  const fade = Math.min(loopFade, duration / 2);
  const loopOn = loop && !audio;
  const types = cfg.type === 'chaos' ? (cfg.layers ?? []).map(L => L.type) : [cfg.type];
  const nativeLoop = types.every(t => GENERATORS[t]?.loops !== false);
  const audioProps = audio ? { src: audio.url, reactivity: audio.reactivity, volume: audio.volume } : null;
  const inputProps = useMemo(() => ({ cfg, loop: loopOn, loopFade: fade, transparent, audio: audioProps, guides }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, loopOn, fade, transparent, audio, guides]);
  const name = baseName(cfg, w, h);
  const renderProps: BackdropRenderProps = {
    cfg, width: w, height: h, fps, durationInSeconds: duration, loop: loopOn, loopFade: fade, transparent,
    audio: audio ? { src: audio.name, reactivity: audio.reactivity, volume: audio.volume, matchLength: false } : null,
  };
  const isFav = favorites.some(e => e.id === cfgId(cfg));

  /** Set the look; `record` adds it to History (big moves only, not every slider tick). */
  const setCfg = (next: BackdropConfig | ((c: BackdropConfig) => BackdropConfig), record = false) =>
    setCfgRaw(c => {
      const n = typeof next === 'function' ? next(c) : next;
      if (record) setHistory(pushHistory(n));
      return n;
    });

  useEffect(() => { if (!jsonFocused) setJsonText(JSON.stringify(cfg, null, 2)); }, [cfg, jsonFocused]);

  // Keep the share link in the address bar current (replaceState: no history spam).
  const shareHash = encodeShare({ cfg, aspect: out.aspect, quality: out.quality, customW: out.customW, customH: out.customH, fps, duration, loop, transparent });
  useEffect(() => {
    const id = setTimeout(() => { try { window.history.replaceState(null, '', '#' + shareHash); } catch { /* ignore */ } }, 250);
    return () => clearTimeout(id);
  }, [shareHash]);

  // A share link pasted into an already-open editor only changes the hash: apply it.
  useEffect(() => {
    const onHash = () => {
      const st = decodeShare(location.hash);
      if (!st) return;
      setCfg(st.cfg, true);
      setOut(o => ({ aspect: st.aspect ?? o.aspect, quality: st.quality ?? o.quality, customW: st.customW ?? o.customW, customH: st.customH ?? o.customH }));
      if (st.fps) setFps(st.fps);
      if (st.duration) setDuration(st.duration);
      if (st.loop != null) setLoop(st.loop);
      if (st.transparent != null) setTransparent(st.transparent);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setParam = <K extends keyof Params>(k: K, v: Params[K]) => setCfg(c => ({ ...c, params: { ...c.params, [k]: v } }));
  const setPalette = (patch: Partial<BackdropConfig['palette']>) => setCfg(c => ({ ...c, palette: { ...c.palette, ...patch } }));
  const setLayer = (i: number, patch: Partial<Layer>) => setCfg(c => ({ ...c, layers: c.layers?.map((L, j) => (j === i ? { ...L, ...patch } : L)) }));
  const chaos = () => setCfg(c => makeChaos(randSeed(), lockPalette ? c.palette : null), true);
  const pickType = (t: string) => {
    if (t === 'chaos') return chaos();
    setCfg(c => { const { layers: _l, opts: _o, ...rest } = c; return { ...rest, type: t }; }, true);
  };
  const reseed = () => setCfg(c => (c.type === 'chaos' ? makeChaos(randSeed(), lockPalette ? c.palette : null) : { ...c, seed: randSeed() }), true);
  const doMutate = () => setCfg(c => mutate(c, randSeed()), true);
  const load = (c: BackdropConfig) => setCfg(c, true);
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
    try { setCfg(normalizeConfig(JSON.parse(jsonText)), true); setMsg('Applied.'); setJsonFocused(false); }
    catch (e) { setMsg('Error: ' + (e as Error).message); }
  };
  const copyText = async (text: string, m: string) => {
    try { await navigator.clipboard.writeText(text); setMsg(m); } catch { setMsg('Clipboard blocked — select the text and copy it.'); }
  };

  const pickAudio = async (file: File | undefined) => {
    if (!file) return;
    if (audio) URL.revokeObjectURL(audio.url);
    const url = URL.createObjectURL(file);
    let seconds = 0;
    try { seconds = await getAudioDurationInSeconds(url); } catch { /* unknown length */ }
    setAudio({ url, name: file.name, reactivity: 1, volume: 1, seconds });
  };
  const clearAudio = () => { if (audio) URL.revokeObjectURL(audio.url); setAudio(null); };

  const doExport = async () => {
    const ac = new AbortController(); abortRef.current = ac;
    setBusy(true); setProgress(0); setStatus('Preparing…');
    const t0 = performance.now();
    try {
      const stillTime = (playerRef.current?.getCurrentFrame() ?? 0) / fps;
      const res = await runExport({
        cfg, width: w, height: h, fps, durationInSeconds: duration, format, stillTime, loop: loopOn, loopFade: fade, transparent,
        audio: audioProps, signal: ac.signal, onProgress: (f, m) => { setProgress(f); setStatus(m); },
      });
      downloadBlob(res.blob, res.filename);
      setProgress(1); setStatus(`Done in ${((performance.now() - t0) / 1000).toFixed(1)}s · ${(res.blob.size / 1e6).toFixed(1)} MB`);
    } catch (e) { console.error(e); setProgress(0); setStatus((e as Error).message); }
    finally { setBusy(false); abortRef.current = null; }
  };

  const codecs = transparent ? REMOTION_CODECS.filter(c => c.alpha) : REMOTION_CODECS;
  const rc = codecs.find(c => c.value === codec) ?? codecs[0];
  const flags = transparent && rc.alphaFlags ? rc.alphaFlags : rc.flags;
  const outPath = rc.ext ? `out/${name}.${rc.ext}` : `out/${name}`;
  const qualityShort = Math.min(w, h);
  const command = batch && rc.value !== 'png'
    ? `npm run batch -- --props=./${name}.json --aspects=16:9,9:16,1:1,4:5 --quality=${qualityShort} --codec=${rc.value}`
    : `npm run render -- ${outPath} --props=./${name}.json ${flags}`;
  const downloadProps = () => downloadBlob(new Blob([JSON.stringify(renderProps, null, 2)], { type: 'application/json' }), `${name}.json`);
  const shareUrl = `${location.origin}${location.pathname}#${shareHash}`;

  const singleControls = cfg.type !== 'chaos' ? GENERATORS[cfg.type]?.controls ?? [] : [];

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
          <label className="check"><input type="checkbox" checked={loop} disabled={!!audio} onChange={e => setLoop(e.target.checked)} /> Seamless loop</label>
          {loopOn && (nativeLoop
            ? <div className="hint">True loop: every pattern here repeats exactly. Slow motions are nudged to whole cycles.</div>
            : <>
                <div className="hint">Flow Field can't repeat exactly, so the loop crossfades.</div>
                <Range label="Crossfade" value={fade} min={0.25} max={Math.max(0.25, Math.min(5, duration / 2))} step={0.05} onChange={setLoopFade} />
              </>)}
          {audio && <div className="hint">Looping is off while audio drives the motion.</div>}
          <label className="check"><input type="checkbox" checked={transparent} onChange={e => setTransparent(e.target.checked)} /> Transparent background</label>
          <div className="dims">{w} × {h} px · {durationInFrames} frames</div>
        </section>

        <section>
          <h2>Pattern</h2>
          <div className="types">
            {TYPES.map((k, i) => {
              const thumbCfg: BackdropConfig = k === 'chaos' ? makeChaos(4242, cfg.palette) : { ...cfg, type: k, seed: 7, layers: undefined, opts: undefined, calm: undefined, params: { ...cfg.params, speed: 1 } };
              return (
                <button key={k} className={'type' + (cfg.type === k ? ' on' : '')} onClick={() => pickType(k)}>
                  <Thumbnail cfg={thumbCfg} delay={i * 15} />
                  <b>{typeLabel(k)}</b>
                </button>
              );
            })}
          </div>
        </section>

        {singleControls.length > 0 && (
          <section>
            <h2>{GENERATORS[cfg.type].name} options</h2>
            <Controls controls={singleControls} opts={cfg.opts} onChange={o => setCfg(c => ({ ...c, opts: o }))} />
          </section>
        )}

        {cfg.type === 'chaos' && cfg.layers && (
          <section>
            <h2>Chaos layers</h2>
            {cfg.layers.map((L, i) => (
              <details key={i} className="layer" open={i === 0}>
                <summary>{i + 1}. {nameOf(L.type)}{L.mask != null ? ` · shown through layer ${L.mask + 1}` : ''}{L.opacity === 0 ? ' · hidden (mask)' : ''}</summary>
                <Range label="Opacity" value={L.opacity} min={0} max={1} step={0.01} onChange={v => setLayer(i, { opacity: v })} />
                {i > 0 && (
                  <div className="row">
                    <div>
                      <label>Blend</label>
                      <select value={L.blend} onChange={e => setLayer(i, { blend: e.target.value as GlobalCompositeOperation })}>
                        {['source-over', 'screen', 'lighter', 'overlay', 'soft-light', 'multiply', 'difference'].map(b => <option key={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Mask</label>
                      <select value={L.mask ?? -1} onChange={e => setLayer(i, { mask: +e.target.value < 0 ? undefined : +e.target.value })}>
                        <option value={-1}>None</option>
                        {cfg.layers!.map((M, j) => (j !== i ? <option key={j} value={j}>Layer {j + 1} · {nameOf(M.type)}</option> : null))}
                      </select>
                    </div>
                  </div>
                )}
                <Controls controls={GENERATORS[L.type]?.controls ?? []} opts={L.opts} onChange={o => setLayer(i, { opts: o })} />
              </details>
            ))}
          </section>
        )}

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
          <div className="row3" style={{ marginTop: 8 }}>
            <button onClick={reseed} title="New seed, same pattern">New seed</button>
            <button onClick={doMutate} title="A small variation of this look">Mutate</button>
            <button className="primary" onClick={chaos} title="Randomize everything">Chaos</button>
          </div>
        </section>

        <section>
          <h2>Layout</h2>
          <div className="row">
            <div>
              <label>Calm zone (for text)</label>
              <select value={cfg.calm?.zone ?? 'off'} onChange={e => {
                const zone = e.target.value as CalmZone;
                setCfg(c => { const { calm: _c, ...rest } = c; return zone === 'off' ? rest : { ...rest, calm: { zone, strength: c.calm?.strength ?? 0.6 } }; });
              }}>
                {CALM_ZONES.map(z => <option key={z} value={z}>{z[0].toUpperCase() + z.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label>Guides (preview only)</label>
              <select value={guides} onChange={e => setGuides(e.target.value as GuideKind)}>{GUIDES.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}</select>
            </div>
          </div>
          {cfg.calm && <Range label="Strength" value={cfg.calm.strength} min={0.1} max={1} step={0.01} onChange={v => setCfg(c => ({ ...c, calm: { ...c.calm!, strength: v } }))} />}
        </section>

        <section>
          <h2>Audio reactive</h2>
          {!audio ? (
            <>
              <input type="file" accept="audio/*" onChange={e => pickAudio(e.target.files?.[0])} />
              <div className="hint">Load a track: loud passages push the motion forward, bass hits zoom and flash. The track is added to Remotion renders.</div>
            </>
          ) : (
            <>
              <div className="dims">{audio.name}{audio.seconds ? ` · ${audio.seconds.toFixed(1)} s` : ''}</div>
              <Range label="Reactivity" value={audio.reactivity} min={0} max={2} step={0.05} onChange={v => setAudio(a => a && { ...a, reactivity: v })} />
              <Range label="Volume" value={audio.volume} min={0} max={1} step={0.01} onChange={v => setAudio(a => a && { ...a, volume: v })} />
              <div className="row" style={{ marginTop: 8 }}>
                <button disabled={!audio.seconds} onClick={() => setDuration(Math.max(1, Math.round(audio.seconds * 100) / 100))}>Match track length</button>
                <button onClick={clearAudio}>Remove</button>
              </div>
              <div className="hint">For CLI renders, copy <code>{audio.name}</code> into the project's <code>public/</code> folder.</div>
            </>
          )}
        </section>

        <section>
          <h2>Library</h2>
          <div className="row" style={{ marginBottom: 10 }}>
            <button className={isFav ? 'primary' : ''} onClick={() => setFavorites(toggleFavorite(cfg))}>{isFav ? '★ Saved' : '☆ Save look'}</button>
            <button onClick={() => copyText(shareUrl, 'Share link copied.')}>Copy share link</button>
          </div>
          <div className="tabs">
            <button className={libTab === 'fav' ? 'on' : ''} onClick={() => setLibTab('fav')}>Favorites ({favorites.length})</button>
            <button className={libTab === 'hist' ? 'on' : ''} onClick={() => setLibTab('hist')}>History ({history.length})</button>
          </div>
          {libTab === 'fav'
            ? <LibraryGrid entries={favorites} onPick={load} onRemove={id => setFavorites(removeFavorite(id))} />
            : <>
                <LibraryGrid entries={history} onPick={c => setCfgRaw(c)} />
                {history.length > 0 && <button className="link" onClick={() => setHistory(clearHistory())}>Clear history</button>}
              </>}
          <div className="status">{msg}</div>
        </section>

        <section>
          <h2>Seed JSON</h2>
          <textarea spellCheck={false} value={jsonText} onFocus={() => setJsonFocused(true)} onChange={e => setJsonText(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={() => copyText(JSON.stringify(cfg, null, 2), 'Copied.')}>Copy</button>
            <button onClick={applyJson}>Apply JSON</button>
          </div>
        </section>

        <section>
          <h2>Render with Remotion</h2>
          <label>Codec</label>
          <select value={rc.value} onChange={e => setCodec(e.target.value)}>{codecs.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
          {transparent && <div className="hint">Transparent: only codecs that keep alpha are listed.</div>}
          <label className="check"><input type="checkbox" checked={batch} disabled={rc.value === 'png'} onChange={e => setBatch(e.target.checked)} /> All aspect ratios (16:9, 9:16, 1:1, 4:5)</label>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={downloadProps}>Download props</button>
            <button onClick={() => copyText(command, 'Command copied.')}>Copy command</button>
          </div>
          <pre className="cmd">{command}</pre>
          <div className="hint">Save the props file in the project folder, then run the command. Uses all CPU cores; supports ProRes, H.265, GIF and alpha.</div>
        </section>

        <section>
          <h2>Quick export (in browser)</h2>
          <label>Format</label>
          <select value={format} onChange={e => setFormat(e.target.value as ExportFormat)}>
            <option value="mp4" disabled={transparent}>MP4 (H.264)</option>
            <option value="webm" disabled={transparent}>WebM (VP9)</option>
            <option value="png-seq">PNG sequence (.zip)</option>
            <option value="png">PNG still (current frame)</option>
          </select>
          {audio && <div className="hint">Quick export follows the music but writes no soundtrack; use the Remotion render for sound.</div>}
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
