// Illumination: the initial that opens each folio, drawn at build time in the white-vine manner (bianchi girari) of
// the Florentine humanist books of Leonardo's own day. A capital of burnished gold stands on a panel of lapis; behind
// it a vine left the colour of the bare vellum scrolls out to the four corners and curls there, the hollow of each
// curl painted rose or green and sprinkled with dots in threes; and from the panel's foot a hairline spray with gold
// bezants runs down the margin. Every folio's vine grows its own way: the seed is the folio number.
//
// Colours are the page's own custom properties (src/styles/tokens.css), so the initial follows the theme. Imports only
// lib/materials.mjs's seeded generator; the output is a string of SVG.
import { rng } from './materials.mjs';

const f = (/** @type {number} */ n) => Math.round(n * 10) / 10;
const xy = (/** @type {number[]} */ p) => `${f(p[0])} ${f(p[1])}`;
const TAU = Math.PI * 2;

/** A smooth open curve through the points (Catmull-Rom as cubic Béziers). */
export function smooth(pts, k = 1 / 6) {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M${xy(pts[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += `C${xy([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${xy([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${xy(p2)}`;
  }
  return d;
}

/**
 * One arm of a scroll: from the middle of the panel out to a curl, which it meets at a tangent and winds into.
 * @param {number[]} from  where the arm starts (behind the letter)
 * @param {number[]} c     the curl's centre
 * @param {number} R       the curl's outer radius
 * @param {1 | -1} dir     which way it winds
 * @param {number} turns   how many times
 * @param {number} pitch   how far the vine moves inward in one turn
 */
export function arm(from, c, R, dir, turns, pitch) {
  const base = Math.atan2(from[1] - c[1], from[0] - c[0]);
  const dist = Math.hypot(from[0] - c[0], from[1] - c[1]);
  const phi = base + dir * Math.acos(Math.min(1, R / dist));
  const start = [c[0] + R * Math.cos(phi), c[1] + R * Math.sin(phi)];
  const pts = [from, [(from[0] * 2 + start[0]) / 3, (from[1] * 2 + start[1]) / 3], [(from[0] + start[0] * 2) / 3, (from[1] + start[1] * 2) / 3]];
  const steps = Math.ceil(turns * 14);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns;
    const r = R - pitch * t;
    const a = phi + dir * t * TAU;
    pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  return pts;
}

/** The least distance from a point to any of the sampled vines. */
function clearance(p, vines) {
  let least = Infinity;
  for (const v of vines) for (const q of v) least = Math.min(least, Math.hypot(p[0] - q[0], p[1] - q[1]));
  return least;
}

/** A vine: an ink line, then the bare vellum laid over it a little narrower, so it reads as a white band outlined. */
const vine = (d, w) =>
  `<path class="il-line" d="${d}" stroke-width="${f(w + 1.7)}"/><path class="il-vine" d="${d}" stroke-width="${f(w)}"/>`;

/** A bezant: a dot of gold with hairline rays, as the gilder left them in the margins. */
function bezant(c, r, turn) {
  const rays = [0, 1, 2, 3]
    .map((i) => {
      const a = turn + (i * TAU) / 4;
      return `M${xy([c[0] + (r + 0.7) * Math.cos(a), c[1] + (r + 0.7) * Math.sin(a)])}L${xy([c[0] + (r + 2.5) * Math.cos(a), c[1] + (r + 2.5) * Math.sin(a)])}`;
    })
    .join('');
  return `<path class="il-hair" d="${rays}"/><circle class="il-bezant" cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r)}"/>`;
}

/** A small leaf: a teardrop from `at`, pointing along `angle`. */
function leaf(at, angle, len, cls) {
  const tip = [at[0] + len * Math.cos(angle), at[1] + len * Math.sin(angle)];
  const side = (s) => [at[0] + len * 0.5 * Math.cos(angle + s * 0.62), at[1] + len * 0.5 * Math.sin(angle + s * 0.62)];
  return `<path class="${cls}" d="M${xy(at)}Q${xy(side(1))} ${xy(tip)}Q${xy(side(-1))} ${xy(at)}Z"/>`;
}

/**
 * The parts of an initial, as SVG markup in a 100-unit square (the spray runs outside it, to the left and below).
 * @param {{ seed: number, id: string, room?: number }} options  `id` keeps the gradient's name unique on the page;
 *   `room` is how far below the panel the margin stays clear, in the panel's units (the spray runs no further)
 */
export function whiteVine({ seed, id, room = 95 }) {
  const r = rng(seed * 2654435761);
  const j = (/** @type {number} */ n) => (r() - 0.5) * 2 * n;
  const O = [50 + j(2), 50 + j(2)];
  // Each scroll winds its own way: both alike and the panel turns like a wheel, unlike and the scrolls cross as a knot.
  const dirs = [r() < 0.5 ? 1 : -1, r() < 0.5 ? 1 : -1];
  // Four curls, one to a corner. Opposite corners belong to one scroll, which passes behind the letter.
  const corners = [
    [26, 26],
    [74, 26],
    [74, 74],
    [26, 74],
  ].map(([x, y]) => {
    const R = 17.5 + r() * 3;
    return { c: [x + j(2.2), y + j(2.2)], R, turns: 1.45 + r() * 0.5, pitch: 6.9 + r() * 0.6 };
  });
  const arms = corners.map((k, i) => arm(O, k.c, k.R, dirs[i % 2], k.turns, k.pitch));
  // Rose and green by turns round the panel; which corner starts is the seed's.
  const first = r() < 0.5 ? 0 : 1;
  const tint = (i) => ((i + first) % 2 ? 'il-rose' : 'il-green');

  const grounds = corners.map((k, i) => `<circle class="${tint(i)}" cx="${f(k.c[0])}" cy="${f(k.c[1])}" r="${f(k.R - 0.6)}"/>`).join('');

  // Nubs: the short side shoots a white vine throws off, each ending in a bud. Two or three to a curl, on its outside.
  const nubs = [];
  const nubLines = [];
  corners.forEach((k, i) => {
    const pts = arms[i];
    const dir = dirs[i % 2];
    const n = 2 + (r() < 0.5 ? 1 : 0);
    for (let m = 0; m < n; m++) {
      const at = pts[4 + Math.floor(((m + 0.5 + j(0.25)) / n) * 12)];
      const out = Math.atan2(at[1] - k.c[1], at[0] - k.c[0]) + dir * 0.5;
      const len = 4.6 + r() * 2.2;
      const tip = [at[0] + len * Math.cos(out), at[1] + len * Math.sin(out)];
      if (tip[0] < 5.5 || tip[0] > 94.5 || tip[1] < 5.5 || tip[1] > 94.5) continue;
      const bend = [at[0] + len * 0.6 * Math.cos(out - dir * 0.5), at[1] + len * 0.6 * Math.sin(out - dir * 0.5)];
      nubLines.push([at, bend, tip]);
      nubs.push(vine(`M${xy(at)}Q${xy(bend)} ${xy(tip)}`, 2.5) + `<circle class="il-line" cx="${f(tip[0])}" cy="${f(tip[1])}" r="2.5" stroke="none"/><circle class="il-bud" cx="${f(tip[0])}" cy="${f(tip[1])}" r="1.65"/>`);
    }
  });

  // The dots, in threes, wherever the ground shows clear of the vine.
  const all = [...arms, ...nubLines];
  let dots = '';
  let tries = 0;
  let placed = 0;
  while (placed < 15 && tries++ < 400) {
    const p = [7 + r() * 86, 7 + r() * 86];
    if (clearance(p, all) < 5.3) continue;
    const a = r() * TAU;
    dots += [0, 1, 2].map((i) => `<circle cx="${f(p[0] + 1.25 * Math.cos(a + (i * TAU) / 3))}" cy="${f(p[1] + 1.25 * Math.sin(a + (i * TAU) / 3))}" r="0.62"/>`).join('');
    all.push([p]);
    placed++;
  }

  const stems = arms.map((pts, i) => vine(smooth(pts), 4.5 - i * 0.12)).join('');
  // Each curl ends in a bud at its heart.
  const buds = arms
    .map((pts) => {
      const e = pts.at(-1);
      return `<circle class="il-line" cx="${f(e[0])}" cy="${f(e[1])}" r="3.5" stroke="none"/><circle class="il-bud" cx="${f(e[0])}" cy="${f(e[1])}" r="2.55"/>`;
    })
    .join('');

  // The spray: a hairline that leaves the panel's foot and wanders down the margin, throwing curls to either side,
  // each with a bezant or a leaf.
  const length = Math.max(16, Math.min(room - 14, 52 + r() * 46));
  const spine = [[7, 98], [-4, 104]];
  const steps = Math.max(1, Math.round(length / 13));
  for (let i = 1; i <= steps; i++) spine.push([-12 + (i % 2 ? -3 : 3) + j(1.1), 104 + (i / steps) * length]);
  let spray = `<path class="il-hair" d="${smooth(spine)}"/>`;
  for (let i = 1; i < spine.length - 1; i++) {
    const at = spine[i + 1];
    const side = i % 2 ? -1 : 1;
    const out = Math.PI / 2 - side * (1.15 + j(0.2));
    const reach = 5 + r() * 2.5;
    const tip = [Math.max(-23, Math.min(-6.5, at[0] + reach * Math.cos(out) * 0.9)), at[1] + reach * Math.sin(out) - 5];
    spray += `<path class="il-hair" d="M${xy([at[0], at[1] - 5.5])}Q${xy([at[0] + side * -4.5, at[1] - 3.5])} ${xy(tip)}"/>`;
    spray += i % 3 === 0 ? leaf(tip, out + side * 0.5, 5.2, i % 2 ? 'il-leaf-green' : 'il-leaf-lapis') : bezant(tip, 1.9 + r() * 0.5, r() * TAU);
  }
  const end = spine.at(-1);
  spray += leaf(end, Math.PI / 2 + j(0.3), 6.5, 'il-leaf-rose') + bezant([Math.max(-22, Math.min(-9.5, end[0] + (r() < 0.5 ? -5 : 5))), end[1] - 3], 1.7, r() * TAU);
  // And one shoot from the head of the panel, up into the margin.
  spray += `<path class="il-hair" d="M4 2Q-3 -3 -6.5 -9.5"/>` + bezant([-7.5, -11.5], 2, r() * TAU) + leaf([-2.6, -2.2], -2.2, 5, 'il-leaf-green');

  const gold = `il-gold-${id}`;
  const defs =
    `<linearGradient id="${gold}" gradientUnits="userSpaceOnUse" x1="18" y1="12" x2="84" y2="92">` +
    `<stop offset="0" class="il-stop-hi"/><stop offset="0.34" class="il-stop"/><stop offset="0.56" class="il-stop-hi"/><stop offset="0.74" class="il-stop"/><stop offset="1" class="il-stop-lo"/></linearGradient>` +
    `<clipPath id="il-clip-${id}"><rect x="3" y="3" width="94" height="94"/></clipPath>`;
  return {
    defs,
    gold,
    clip: `il-clip-${id}`,
    // Bottom to top: the ground, the hollows of the curls, the dots, the vine, its buds.
    panel: `<rect class="il-lapis" x="3" y="3" width="94" height="94"/>${grounds}<g class="il-dots">${dots}</g>${stems}${nubs.join('')}${buds}`,
    spray,
  };
}

/**
 * A headpiece: a band of ornament across the head of a book's first page, here in white vine. One stem runs the length
 * of the band, over one curl and under the next, and throws a spiral into each; the hollows are rose and green by
 * turns on a lapis ground. Drawn in a strip 100 units high and `count` curls long.
 * @param {{ seed: number, count?: number }} options
 */
export function headpiece({ seed, count = 20 }) {
  const r = rng(seed * 40503 + 17);
  const j = (/** @type {number} */ n) => (r() - 0.5) * 2 * n;
  const S = 74; // from one curl's centre to the next
  const R = 30; // the stem's radius round a curl
  const width = count * S;
  const alpha = Math.asin((2 * R) / S); // the angle at which the stem crosses from one curl to the next
  const centres = Array.from({ length: count }, (_, k) => [S / 2 + k * S, 50 + j(1.2)]);
  /** @type {number[][]} */
  const stem = [[-6, 50 - R * 0.2]];
  const curls = [];
  let grounds = '';
  centres.forEach((c, k) => {
    const top = k % 2 === 0;
    // Over the top the stem runs clockwise on the screen (angles rising), under the foot the other way.
    const from = top ? -Math.PI / 2 - alpha : Math.PI / 2 + alpha;
    const to = top ? -Math.PI / 2 + alpha : Math.PI / 2 - alpha;
    const dir = top ? 1 : -1;
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      stem.push([c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)]);
    }
    // The spiral leaves the stem where the stem leaves the curl, and winds on inward.
    const turns = 1.2 + r() * 0.25;
    const pitch = 11.5;
    const pts = [];
    const n = Math.ceil(turns * 14);
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * turns;
      const a = to + dir * t * TAU;
      const rad = R - pitch * t;
      pts.push([c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)]);
    }
    curls.push(pts);
    grounds += `<circle class="${k % 2 ? 'il-rose' : 'il-green'}" cx="${f(c[0])}" cy="${f(c[1])}" r="${f(R - 1.2)}"/>`;
  });
  stem.push([width + 6, 50 + (count % 2 ? R : -R) * 0.2]);

  // Dots in threes in the spandrels, the corners of ground the curls leave against the band's edges.
  let dots = '';
  for (let k = 0; k <= count; k++) {
    const x = k * S;
    for (const y of k % 2 === 1 ? [88] : [12]) {
      if (k > 0 && k < count && r() < 0.15) continue;
      const p = [x + j(3), y + j(2.5)];
      const a = r() * TAU;
      dots += [0, 1, 2].map((i) => `<circle cx="${f(p[0] + 2.3 * Math.cos(a + (i * TAU) / 3))}" cy="${f(p[1] + 2.3 * Math.sin(a + (i * TAU) / 3))}" r="1.15"/>`).join('');
    }
  }
  const buds = curls
    .map((pts) => {
      const e = pts.at(-1);
      return `<circle class="il-line" cx="${f(e[0])}" cy="${f(e[1])}" r="6" stroke="none"/><circle class="il-bud" cx="${f(e[0])}" cy="${f(e[1])}" r="4.3"/>`;
    })
    .join('');
  // Where the stem crosses between two curls it throws a short shoot into the spandrel, up and down by turns.
  let shoots = '';
  for (let k = 1; k < count; k++) {
    const up = k % 2 === 1;
    const x = k * S;
    const tip = [x + j(2.5), up ? 13.5 + j(1.5) : 86.5 + j(1.5)];
    const bend = [x + (up ? 5 : -5), up ? 30 : 70];
    shoots +=
      vine(`M${xy([x, 50])}Q${xy(bend)} ${xy(tip)}`, 4.6) +
      `<circle class="il-line" cx="${f(tip[0])}" cy="${f(tip[1])}" r="5" stroke="none"/><circle class="il-bud" cx="${f(tip[0])}" cy="${f(tip[1])}" r="3.5"/>`;
  }
  const markup =
    `<rect class="il-lapis" x="-10" y="0" width="${width + 20}" height="100"/>${grounds}<g class="il-dots">${dots}</g>` +
    shoots +
    curls.map((pts) => vine(smooth(pts), 7.4)).join('') +
    vine(smooth(stem), 8.2) +
    buds;
  return { width, markup };
}

/** The first letter of a folio's text, if the folio opens on a letter (not on code, a key or a mark). */
export function initialOf(body) {
  const text = String(body).replace(/^\s+/, '');
  // A wiki link prints its page's title, which is not the letter typed here: such a folio opens plain. So does one
  // that opens on a line of MDX, which prints nothing.
  if (text.startsWith('[[') || /^(import|export)\s/.test(text)) return null;
  const m = /^(?:\*\*|__|\*|_|\[)?([A-Za-z])/.exec(text);
  return m ? m[1].toUpperCase() : null;
}

/** How large a capital is cut, and where its foot stands, so that wide letters and Q's tail stay inside the panel. */
export function letterFit(letter) {
  const size = 'MW'.includes(letter) ? 61 : letter === 'Q' ? 60 : 74;
  return { size, y: f(50 + size * 0.35 - (letter === 'Q' ? 3.5 : 0)) };
}

/** The first paragraph of a folio's source, as the letters a reader sees. */
function firstParagraph(body) {
  const para = String(body).replace(/^\s+/, '').split(/\n\s*\n/)[0] ?? '';
  return para
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>|[*_`]/g, '');
}

/**
 * How far the margin below the initial stays clear, in the panel's units: the lines of the opening paragraph that run
 * on beneath the initial, in the column's measure. The spray stops short of whatever follows the paragraph.
 */
export function sprayRoom(body, { perLine = 76, beside = 60, depth = 4, lineUnits = 26.6 } = {}) {
  const letters = firstParagraph(body).length;
  const under = Math.max(0, Math.ceil((letters - beside * depth) / perLine));
  return under * lineUnits + 4;
}
