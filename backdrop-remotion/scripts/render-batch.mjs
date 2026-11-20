#!/usr/bin/env node
/**
 * Render one look at several aspect ratios in one go (the look is resolution independent).
 *
 *   npm run batch -- --props=./my-look.json [--aspects=16:9,9:16,1:1,4:5] [--quality=1080]
 *                    [--codec=h264|h265|vp9|prores|gif] [--out=out]
 *
 * Transparent looks ("transparent": true) automatically render with alpha: ProRes 4444 (.mov) or VP9 (.webm).
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)=?(.*)$/); return m ? [m[1], m[2] || 'true'] : [a, 'true']; }));

if (!args.props) {
  console.error('Usage: npm run batch -- --props=./my-look.json [--aspects=16:9,9:16,1:1,4:5] [--quality=1080] [--codec=h264] [--out=out]');
  process.exit(1);
}

const ASPECTS = { '16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1], '4:5': [4, 5], '21:9': [21, 9] };
const even = v => Math.round(v / 2) * 2;
/** Quality is the short side, so 9:16 @ 1080 = 1080×1920 (same rule as the editor). */
const sizeFor = (aspect, q) => {
  const [x, y] = ASPECTS[aspect];
  return x >= y ? { width: even((q * x) / y), height: q } : { width: q, height: even((q * y) / x) };
};

const base = JSON.parse(readFileSync(path.resolve(args.props), 'utf8'));
const aspects = (args.aspects ?? '16:9,9:16,1:1,4:5').split(',').map(s => s.trim());
for (const a of aspects) if (!ASPECTS[a]) { console.error(`Unknown aspect "${a}". Valid: ${Object.keys(ASPECTS).join(', ')}`); process.exit(1); }
const quality = Number(args.quality ?? 1080);
const transparent = !!base.transparent;
let codec = args.codec ?? (transparent ? 'prores' : 'h264');
if (transparent && !['prores', 'vp9'].includes(codec)) { console.warn(`"${codec}" can't carry alpha; using ProRes 4444.`); codec = 'prores'; }
const ext = { h264: 'mp4', h265: 'mp4', vp9: 'webm', prores: 'mov', gif: 'gif' }[codec];
if (!ext) { console.error(`Unsupported codec "${codec}".`); process.exit(1); }
const outDir = path.resolve(args.out ?? 'out');
mkdirSync(outDir, { recursive: true });

console.log('Bundling…');
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/remotion/index.ts'), publicDir: path.join(root, 'public') });
const stem = path.basename(args.props, '.json');

for (const aspect of aspects) {
  const size = sizeFor(aspect, quality);
  const inputProps = { ...base, ...size };
  const composition = await selectComposition({ serveUrl, id: 'Backdrop', inputProps });
  const outputLocation = path.join(outDir, `${stem}_${aspect.replace(':', 'x')}_${size.width}x${size.height}.${ext}`);
  const t0 = Date.now();
  let last = -1;
  await renderMedia({
    serveUrl, composition, inputProps, codec, outputLocation, overwrite: true,
    imageFormat: transparent ? 'png' : 'jpeg', jpegQuality: 95,
    ...(transparent ? { pixelFormat: codec === 'prores' ? 'yuva444p10le' : 'yuva420p' } : {}),
    ...(codec === 'prores' ? { proResProfile: transparent ? '4444' : 'hq' } : {}),
    ...(codec === 'gif' ? { everyNthFrame: 2 } : {}),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= last + 10) { last = pct; process.stdout.write(`\r${aspect} ${size.width}×${size.height}: ${pct}%   `); }
    },
  });
  console.log(`\r${aspect} ${size.width}×${size.height}: done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${path.relative(process.cwd(), outputLocation)}`);
}
