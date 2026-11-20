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

/** An SVG as a CSS url(): only the characters a data URI cannot carry are escaped. */
/** @param {string} svg */
export function svgUrl(svg) {
  return `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\s+/g, ' ')}")`;
}

const mask = (/** @type {string} */ d) => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='${SIZE}' height='${SIZE}' viewBox='0 0 ${SIZE} ${SIZE}'><path d='${d}'/></svg>`);

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
