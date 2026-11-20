#!/usr/bin/env node
/**
 * Determinism tests. Renders a small still of every pattern (plus loop, chaos, mask, calm and transparent
 * cases) through the real Remotion pipeline and compares a hash of the pixels with tests/snapshots.json.
 *
 *   npm test                 compare against the stored snapshots
 *   npm test -- --update     re-record snapshots (after an intentional visual change)
 *
 * Every case is rendered twice (in a different order) and must match itself, which catches
 * order-dependent state even before a snapshot exists. Hashes are per-machine: the headless browser's
 * rasteriser can differ slightly across OS/GPU, so record snapshots on the machine that runs the tests.
 */
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const update = process.argv.includes('--update');
const snapFile = path.join(root, 'tests/snapshots.json');

// Pattern keys straight from the registry source (keeps this script free of a TS build step).
const reg = readFileSync(path.join(root, 'src/generators/index.ts'), 'utf8');
const keys = reg.match(/GENERATORS[^=]*=\s*\{([\s\S]*?)\}/)[1].split(/[\s,]+/).filter(Boolean);

const params = { speed: 1, density: 1, glow: true, grain: 0, vignette: 0.3 };
const look = (type, extra = {}) => ({ version: 1, type, seed: 7, palette: { mode: 'theme', theme: 'cyberpunk' }, params, ...extra });
const props = (cfg, extra = {}) => ({ cfg, width: 320, height: 180, fps: 30, durationInSeconds: 4, ...extra });

const cases = [];
for (const k of keys) cases.push({ name: k, frame: 45, props: props(look(k)) });
for (const k of ['particles', 'galaxy', 'landscape', 'matrix', 'starfield', 'tunnel']) cases.push({ name: `${k}+loop`, frame: 60, props: props(look(k), { loop: true }) });
cases.push({ name: 'flowfield+crossfade-loop', frame: 10, props: props(look('flowfield'), { loop: true, loopFade: 1 }) });
cases.push({
  name: 'chaos+mask', frame: 30,
  props: props({
    ...look('chaos'),
    layers: [
      { type: 'waves', seed: 1, blend: 'source-over', opacity: 1 },
      { type: 'halftone', seed: 2, blend: 'screen', opacity: 0 },
      { type: 'plasma', seed: 3, blend: 'source-over', opacity: 1, mask: 1 },
    ],
  }),
});
cases.push({ name: 'calm+opts', frame: 30, props: props(look('tunnel', { opts: { sides: 6, rings: 30 }, calm: { zone: 'left', strength: 0.8 } })) });
cases.push({ name: 'transparent', frame: 30, props: props(look('bokeh'), { transparent: true }), png: true });

console.log(`Bundling… (${cases.length} cases)`);
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/remotion/index.ts') });
const dir = mkdtempSync(path.join(tmpdir(), 'backdrop-snap-'));

const shot = async c => {
  const composition = await selectComposition({ serveUrl, id: 'Backdrop', inputProps: c.props });
  const output = path.join(dir, `${c.name.replace(/[^a-z0-9+-]/gi, '_')}.png`);
  await renderStill({ serveUrl, composition, inputProps: c.props, frame: c.frame, output, imageFormat: 'png', overwrite: true });
  return createHash('sha256').update(readFileSync(output)).digest('hex').slice(0, 16);
};

const first = {};
for (const c of cases) first[c.name] = await shot(c);
// Second pass in reverse order: identical output proves no hidden state leaks between renders.
let fails = 0;
for (const c of [...cases].reverse()) {
  const again = await shot(c);
  if (again !== first[c.name]) { fails++; console.log(`✗ ${c.name}: not deterministic (${first[c.name]} vs ${again})`); }
}

const stored = existsSync(snapFile) ? JSON.parse(readFileSync(snapFile, 'utf8')) : {};
if (update || !existsSync(snapFile)) {
  mkdirSync(path.dirname(snapFile), { recursive: true });
  writeFileSync(snapFile, JSON.stringify(first, null, 2) + '\n');
  console.log(`Recorded ${cases.length} snapshots → tests/snapshots.json`);
} else {
  for (const c of cases) {
    if (!stored[c.name]) console.log(`? ${c.name}: no stored snapshot (run with --update)`);
    else if (stored[c.name] !== first[c.name]) { fails++; console.log(`✗ ${c.name}: changed (${stored[c.name]} → ${first[c.name]})`); }
  }
}
rmSync(dir, { recursive: true, force: true });
if (fails) { console.log(`\n${fails} failure(s).`); process.exit(1); }
console.log(`✓ ${cases.length} cases deterministic${update || !Object.keys(stored).length ? '' : ' and matching snapshots'}.`);
