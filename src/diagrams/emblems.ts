// Small ink sketches for the empty corners of a study's sheet, one per view, after its Latin motto: the way Leonardo
// filled the margins of a page with wheels, water and moons around the drawing it was for. Three are his own, traced
// from his notebooks (scripts/trace-leonardo.mjs): the wheels of a winch, water running past an obstacle, a door's
// lock. The rest were drawn by an image model in the manner of his pen and traced the same way
// (scripts/gen-emblems.sh). Each is placed in a box from -50 to 50 by the view (src/data), in the ink's colour.
// Ornament only; InkMap hides them from assistive technology.
import rotae from '../assets/leonardo/rotae.svg?raw';
import vortex from '../assets/leonardo/flumen.svg?raw';
import porta from '../assets/leonardo/porta.svg?raw';
import clepsydra from '../assets/emblems/clepsydra.svg?raw';
import epistola from '../assets/emblems/epistola.svg?raw';
import fax from '../assets/emblems/fax.svg?raw';
import luna from '../assets/emblems/luna.svg?raw';
import nodus from '../assets/emblems/nodus.svg?raw';
import scutum from '../assets/emblems/scutum.svg?raw';
import via from '../assets/emblems/via.svg?raw';

const SOURCES = { rotae, clepsydra, epistola, fax, luna, nodus, porta, scutum, via, vortex };

/** A traced file's drawing, fitted and centred in the box from -50 to 50. */
function fit(svg: string): string {
  const box = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const body = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!box || !body) throw new Error('not a traced drawing');
  const w = Number(box[1]), h = Number(box[2]);
  const k = 100 / Math.max(w, h);
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `<g class="traced" transform="translate(${r(-(w * k) / 2)} ${r(-(h * k) / 2)}) scale(${r(k)})">${body[1].trim()}</g>`;
}
const EMBLEMS = Object.fromEntries(Object.entries(SOURCES).map(([n, s]) => [n, fit(s)])) as Record<keyof typeof SOURCES, string>;

export interface Emblem {
  name: keyof typeof SOURCES;
  /** Its centre on the 800 × 470 sheet, and the width of its box. */
  x: number;
  y: number;
  size: number;
  /** Its name, in the same Latin, under it. */
  label?: string;
}
export function emblem(e: Emblem, _uid?: string): string {
  const drawing = EMBLEMS[e.name];
  if (!drawing) throw new Error(`no emblem called ${e.name}`);
  return drawing;
}
