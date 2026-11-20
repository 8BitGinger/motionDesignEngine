import type { Generator } from '../engine/types';
import { aurora } from './aurora';
import { blobs } from './blobs';
import { particles } from './particles';
import { hex } from './hex';
import { landscape } from './landscape';
import { orbit } from './orbit';
import { geometric } from './geometric';
import { grain } from './grain';
import { rays } from './rays';
import { matrix } from './matrix';
import { flowfield } from './flowfield';
import { mesh } from './mesh';
import { waves } from './waves';
import { starfield } from './starfield';
import { lines } from './lines';
import { mosaic } from './mosaic';
import { pulse } from './pulse';
import { ribbons } from './ribbons';
import { digital } from './digital';
import { bokeh } from './bokeh';
import { topo } from './topo';
import { plasma } from './plasma';
import { cells } from './cells';
import { tunnel } from './tunnel';
import { galaxy } from './galaxy';
import { circuit } from './circuit';
import { confetti } from './confetti';
import { halftone } from './halftone';
import { kaleidoscope } from './kaleidoscope';

/** Registry in display order. Keys are the `type` values used in seed JSON. Chaos is shown after these. */
export const GENERATORS: Record<string, Generator> = {
  aurora, blobs, particles, hex, landscape, orbit, geometric, grain, rays, matrix,
  flowfield, mesh, waves, starfield, lines, mosaic, pulse, ribbons, digital,
  bokeh, topo, plasma, cells, tunnel, galaxy, circuit, confetti, halftone, kaleidoscope,
};

export const GENERATOR_KEYS = Object.keys(GENERATORS);
