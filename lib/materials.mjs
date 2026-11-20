// The materials of the book, computed at build time into CSS custom properties: nothing here is an image file.
//
// The leaf's outline. A sheet of vellum is the skin of an animal, cut by hand, and no edge of it is straight. The
// binder trims the gutter square, where the leaf is sewn in; the head, the fore-edge and the tail keep the wavering
// line of the knife. The outline is drawn once as a nine-slice mask (corners that keep their size, edges that repeat),
// so one drawing fits a leaf of any height. Each edge's waver is a sum of sines whose periods divide the repeating
// piece, which is what lets the piece join itself without a seam.

export const CORNER = 60; // each corner piece is CORNER square
export const TILE = 600; // the piece that repeats along an edge
export const SIZE = CORNER * 2 + TILE;

/** A small seeded generator (mulberry32): the same leaf on every build. */
/** @param {number} seed */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} seed
 * @param {number} amp
 */
function waver(seed, amp) {
  const r = rng(seed);
  const parts = [1, 2, 3, 5, 8, 13, 21].map((k) => ({ k, a: (amp * (0.5 + r())) / Math.pow(k, 0.72), p: r() * Math.PI * 2 }));
  const norm = parts.reduce((n, p) => n + p.a, 0) / amp;
  return (/** @type {number} */ x) => parts.reduce((n, p) => n + p.a * Math.sin((x / TILE) * Math.PI * 2 * p.k + p.p), 0) / norm;
}

const f = (/** @type {number} */ n) => Math.round(n * 10) / 10;

/** The outline of a leaf: the gutter (left) cut square, the other three edges as the knife left them. */
export function leafOutline({ inset = 7, amp = 3, radius = 9, seed = 11 } = {}) {
  const top = waver(seed, amp);
  const fore = waver(seed + 1, amp);
  const tail = waver(seed + 2, amp);
  /** @type {[number, number][]} */
  const pts = [];
  // The waver dies away before each rounded corner, inside the corner piece, so the pieces still meet.
  const fade = (/** @type {number} */ d) => Math.min(1, Math.max(0, d / 22));
  const STEP = 6;
  const far = SIZE - inset - radius;
  pts.push([0, inset]);
  for (let x = STEP; x <= far; x += STEP) pts.push([x, inset + top(x) * fade(far - x) * Math.min(1, x / 30)]);
  for (let a = -80; a <= -10; a += 14) pts.push([far + radius * Math.cos((a * Math.PI) / 180), inset + radius + radius * Math.sin((a * Math.PI) / 180)]);
  for (let y = inset + radius; y <= far; y += STEP) pts.push([SIZE - inset - fore(y) * fade(y - inset - radius) * fade(far - y), y]);
  for (let a = 10; a <= 80; a += 14) pts.push([far + radius * Math.cos((a * Math.PI) / 180), far + radius * Math.sin((a * Math.PI) / 180)]);
  for (let x = far; x >= STEP; x -= STEP) pts.push([x, SIZE - inset - tail(x) * fade(far - x) * Math.min(1, x / 30)]);
  pts.push([0, SIZE - inset]);
  return `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`;
}

/**
 * The outline of a sheet of papyrus between its two rolls. The head and the tail are cut straight, since the sheet
 * runs on into the rolls there; the sides are the edges of the strips it was laid from, and they fray. The fraying
 * repeats with the edge piece, so the same nine-slice mask fits a roll of any length.
 */
export function papyrusOutline({ inset = 4, amp = 2.6, seed = 41 } = {}) {
  const STEP = 3;
  const steps = TILE / STEP;
  /** One side's fraying: a slow wander, and on it the broken ends of single fibres. */
  const fray = (/** @type {number} */ sd) => {
    const r = rng(sd);
    const parts = [1, 2, 3, 5, 8, 13, 21, 34].map((k) => ({ k, a: (0.5 + r()) / Math.pow(k, 0.5), p: r() * Math.PI * 2 }));
    const norm = parts.reduce((n, p) => n + p.a, 0);
    const ends = Array.from({ length: steps }, () => (r() < 0.16 ? r() * 0.9 : r() * 0.22));
    return (/** @type {number} */ y) => {
      const wander = parts.reduce((n, p) => n + p.a * Math.sin((y / TILE) * Math.PI * 2 * p.k + p.p), 0) / norm;
      return amp * (1 + wander) + amp * ends[(((Math.round(y / STEP) % steps) + steps) % steps)];
    };
  };
  const left = fray(seed);
  const right = fray(seed + 1);
  /** @type {[number, number][]} */
  const pts = [];
  for (let y = 0; y <= SIZE; y += STEP) pts.push([SIZE - inset - right(y), y]);
  for (let y = SIZE; y >= 0; y -= STEP) pts.push([inset + left(y), y]);
  return `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`;
}

// A leaf that has been in a fire: its lower corner is gone, and the edge the fire left is charred. The burnt edge is
// drawn in a box BURN.w by BURN.h that sits in the leaf's lower right corner: `edge` runs from the foot of the box up
// to its right side, and `holes` are the small burns a spark makes a little way in from it.
// The scorch reaches further into the leaf than the box, so its drawing has `reach` more room above and to the left.
export const BURN = { w: 900, h: 500, reach: 170 };

/** @param {{ seed?: number }} [options] */
export function burnShape({ seed = 7 } = {}) {
  const r = rng(seed);
  const waves = [2, 3, 5, 8, 13, 21].map((k) => ({ k, a: (0.4 + r()) / Math.pow(k, 0.85), p: r() * Math.PI * 2 }));
  const norm = waves.reduce((n, w) => n + w.a, 0);
  const lick = (/** @type {number} */ t) => waves.reduce((n, w) => n + w.a * Math.sin(t * Math.PI * w.k + w.p), 0) / norm;
  const reach = (/** @type {number} */ t, /** @type {number} */ k = 1) => {
    // How far the fire came in from the corner, in the direction t (0 along the foot, 1 up the fore-edge).
    const a = (t * Math.PI) / 2;
    const far = k * (1 + 0.13 * lick(t));
    return [BURN.w - BURN.w * 0.8 * far * Math.cos(a), BURN.h - BURN.h * 0.8 * far * Math.sin(a)];
  };
  /** @type {number[][]} */
  const edge = [];
  const STEPS = 96;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const [x, y] = reach(t);
    // The broken, crumbling line of char: small bites out of the edge, none at its two ends where it meets the box.
    const bite = (r() - 0.5) * 7 * Math.min(1, i / 3, (STEPS - i) / 3);
    edge.push([x + bite, y + bite * 0.6]);
  }
  edge[0][1] = BURN.h;
  edge[STEPS][0] = BURN.w;
  const holes = [0.2, 0.47, 0.71].map((t, i) => {
    const [cx, cy] = reach(t + (r() - 0.5) * 0.06, 1.13 + r() * 0.13);
    const size = 7 + r() * 9 + (i === 1 ? 6 : 0);
    const phase = r() * 7;
    /** @type {number[][]} */
    const ring = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const rad = size * (0.72 + 0.28 * Math.sin(a * 3 + phase) + (r() - 0.5) * 0.3);
      ring.push([cx + rad * Math.cos(a) * 1.25, cy + rad * Math.sin(a)]);
    }
    return ring;
  });
  const line = (/** @type {number[][]} */ pts) => pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L');
  return {
    edge: `M${line(edge)}`,
    holes: holes.map((h) => `M${line(h)}Z`),
    /** What is left of the leaf inside the box: all of it but the burnt corner and the holes. */
    left: `M0 0H${BURN.w}L${line([...edge].reverse())}H0Z${holes.map((h) => `M${line(h)}Z`).join('')}`,
  };
}

/** An SVG as a CSS url(): only the characters a data URI cannot carry are escaped. */
/** @param {string} svg */
export function svgUrl(svg) {
  return `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\s+/g, ' ')}")`;
}

const mask = (/** @type {string} */ d) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${SIZE}' height='${SIZE}' viewBox='0 0 ${SIZE} ${SIZE}'><path d='${d}'/></svg>`);

const burn = burnShape();
const burnSvg = (/** @type {string} */ inner, pad = 0) =>
  svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${BURN.w + pad}' height='${BURN.h + pad}' viewBox='${-pad} ${-pad} ${BURN.w + pad} ${BURN.h + pad}'>${inner}</svg>`);
/** The scorch along the burnt edge: strokes of the edge itself, each blurred, the widest and faintest first. */
const scorch = (/** @type {[string, number, number][]} */ bands) =>
  burnSvg(
    `<defs><path id='e' d='${burn.edge}${burn.holes.join('')}'/></defs>` +
      bands
        .map(([colour, width, soft], i) => `<filter id='b${i}' x='-30%' y='-40%' width='160%' height='180%'><feGaussianBlur stdDeviation='${soft}'/></filter><use href='#e' fill='none' stroke='${colour}' stroke-width='${width}' stroke-linejoin='round' filter='url(#b${i})'/>`)
        .join(''),
    BURN.reach,
  );

// The textures. Each is one square of SVG noise that tiles without a seam: the browser draws it once and repeats it.
// `rgb` is the colour the noise is laid in; its strength at each point is `gain` times one channel of the noise plus
// `lift` (below zero the surface shows through untouched), and `band` keeps only one narrow band of the noise, which
// is how a vein runs through stone.
/**
 * @param {{ size: number, freq: number | [number, number], octaves: number, seed: number, rgb: [number, number, number],
 *   gain: number, lift: number, band?: [number, number] }} n  `band` is [how many steps the range is cut into,
 *   strength at the band].
 */
function noise({ size, freq, octaves, seed, rgb, gain, lift, band }) {
  const bf = Array.isArray(freq) ? freq.join(' ') : String(freq);
  const table = band ? Array.from({ length: band[0] }, (_, i) => (i === Math.floor(band[0] / 2) ? band[1] : 0)).join(' ') : '';
  return svgUrl(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><filter id='n' x='0' y='0' width='100%' height='100%'>` +
      `<feTurbulence type='fractalNoise' baseFrequency='${bf}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/>` +
      `<feColorMatrix values='0 0 0 0 ${rgb[0]} 0 0 0 0 ${rgb[1]} 0 0 0 0 ${rgb[2]} ${gain} 0 0 0 ${lift}'/>` +
      (band ? `<feComponentTransfer><feFuncA type='table' tableValues='${table}'/></feComponentTransfer>` : '') +
      `</filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
  );
}

const vars = (/** @type {Record<string, string>} */ o) => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(';');

const day = {
  // The tooth of a surface: fine grain, on stone and on skin alike.
  grain: noise({ size: 260, freq: 0.8, octaves: 3, seed: 1, rgb: [0.42, 0.3, 0.16], gain: 0.34, lift: -0.06 }),
  // Papyrus fibres, laid across: the tags and the catalogue are papyrus, as Alexandria's were.
  fibres: noise({ size: 600, freq: [0.006, 0.05], octaves: 2, seed: 7, rgb: [0.5, 0.36, 0.18], gain: 0.22, lift: -0.04 }),
  // Vellum is never one colour: the skin is thicker and yellower in some places, thinner and paler in others. Drawn
  // small and laid large, since a slow change of tone needs no detail.
  mottle: noise({ size: 360, freq: 0.011, octaves: 3, seed: 4, rgb: [0.5, 0.33, 0.13], gain: 0.52, lift: -0.2 }),
  // The hair side of the skin keeps its follicles: a sparse, fine speckle.
  follicles: noise({ size: 240, freq: 1.15, octaves: 2, seed: 12, rgb: [0.36, 0.24, 0.1], gain: 2.6, lift: -1.86 }),
  // Limestone: slow clouds of tone, and here and there a vein.
  stone: noise({ size: 420, freq: 0.009, octaves: 4, seed: 21, rgb: [0.3, 0.27, 0.22], gain: 0.5, lift: -0.2 }),
  veins: noise({ size: 700, freq: [0.003, 0.006], octaves: 5, seed: 33, rgb: [0.4, 0.35, 0.28], gain: 1, lift: 0, band: [45, 0.22] }),
};
// By lamplight the same surfaces, laid in shadow instead of in tone.
const night = {
  grain: noise({ size: 260, freq: 0.8, octaves: 3, seed: 1, rgb: [0.85, 0.66, 0.4], gain: 0.2, lift: -0.045 }),
  fibres: noise({ size: 600, freq: [0.006, 0.05], octaves: 2, seed: 7, rgb: [0, 0, 0], gain: 0.5, lift: -0.1 }),
  mottle: noise({ size: 360, freq: 0.011, octaves: 3, seed: 4, rgb: [0, 0, 0], gain: 0.9, lift: -0.32 }),
  follicles: noise({ size: 240, freq: 1.15, octaves: 2, seed: 12, rgb: [0, 0, 0], gain: 3.4, lift: -2.4 }),
  stone: noise({ size: 420, freq: 0.009, octaves: 4, seed: 21, rgb: [0.75, 0.6, 0.4], gain: 0.16, lift: -0.06 }),
  veins: noise({ size: 700, freq: [0.003, 0.006], octaves: 5, seed: 33, rgb: [0.8, 0.66, 0.46], gain: 1, lift: 0, band: [45, 0.045] }),
};

/** The custom properties, as a stylesheet: astro.config.mjs serves it to the layout as virtual:materials.css. */
export const materialsCss =
  `:root{--leaf-edge:${mask(leafOutline())};--leaf-edge-under:${mask(leafOutline({ seed: 29, amp: 3.4 }))};${vars(day)}}` +
  `:root[data-theme='lucerna']{${vars(night)}}`;

// The two materials only one page each uses are kept out of the stylesheet every page loads.

/** The catalogue's roll (virtual:volumen.css): the sheet's frayed outline, and the strips laid the other way beneath
 *  the ones written on, since a sheet of papyrus is two layers pressed crosswise. */
export const volumenCss =
  `:root{--volumen-edge:${mask(papyrusOutline())};` +
  `--fibres-v:${noise({ size: 600, freq: [0.045, 0.005], octaves: 2, seed: 9, rgb: [0.46, 0.32, 0.14], gain: 0.26, lift: -0.07 })}}` +
  `:root[data-theme='lucerna']{--fibres-v:${noise({ size: 600, freq: [0.045, 0.005], octaves: 2, seed: 9, rgb: [0, 0, 0], gain: 0.4, lift: -0.12 })}}`;

/** The burnt leaf of the page that is not there (virtual:burn.css): what is left of the leaf, the scorch and char
 *  along the edge the fire stopped at, and by lamplight the line of ember still alive in it. */
export const burnCss =
  `:root{--burn-reach:${((BURN.w + BURN.reach) / BURN.w).toFixed(4)};--burn-rise:${((BURN.h + BURN.reach) / BURN.h).toFixed(4)};` +
  `--burn-left:${burnSvg(`<path fill-rule='evenodd' d='${burn.left}'/>`)};` +
  `--burn-char:${scorch([
    ['rgb(126 78 26 / 0.5)', 150, 30],
    ['rgb(74 40 12 / 0.75)', 64, 13],
    ['rgb(24 13 6 / 0.96)', 20, 3.5],
  ])};--burn-ember:none}` +
  `:root[data-theme='lucerna']{--burn-char:${scorch([
    ['rgb(0 0 0 / 0.55)', 150, 30],
    ['rgb(0 0 0 / 0.85)', 64, 13],
    ['rgb(0 0 0 / 1)', 20, 3.5],
  ])};--burn-ember:${scorch([
    ['rgb(255 96 24 / 0.5)', 26, 8],
    ['rgb(255 150 50 / 0.95)', 3.2, 1.1],
  ])}}`;
