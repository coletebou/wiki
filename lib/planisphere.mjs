// The planisphere: the library laid out as a chart of the heavens. Every folio is a star; the ten tables are ten
// houses round the pole, each as wide as it has folios; and a line runs through the stars of a house in the order of
// their folios, which makes of each table a constellation. How bright a star is drawn (how often its folio is cited)
// and which stars it is joined to when pointed at (what it cites, what cites it) are the page's business; this file
// only says where everything stands, and says the same thing on every build.
import { rng } from './materials.mjs';

/** The chart's radius, in its own units; everything is drawn about the pole at (0, 0). */
export const RADIUS = 480;
const INNER = 0.17; // no star stands nearer the pole than this share of the radius
const OUTER = 0.9; // nor nearer the rim than this

const TAU = Math.PI * 2;
const f = (/** @type {number} */ n) => Math.round(n * 10) / 10;
const dist = (/** @type {number[]} */ a, /** @type {number[]} */ b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The length of a path through points, in their order. */
const length = (/** @type {number[][]} */ pts) => pts.slice(1).reduce((n, p, i) => n + dist(pts[i], p), 0);

/**
 * Stars for one house: `count` points inside the wedge from angle `from` to angle `to`, as far apart as they will go.
 * They are scattered, not ruled: each new star is tried at random and kept if it stands clear of the rest, and the
 * clearance asked for comes down until all of them fit.
 */
function scatter(count, from, to, random) {
  const span = to - from;
  for (let clear = 150; clear > 6; clear *= 0.93) {
    /** @type {number[][]} */
    const pts = [];
    for (let tries = 0; tries < 2600 && pts.length < count; tries++) {
      // Even over the wedge's area, so the stars do not crowd the pole.
      const r = RADIUS * Math.sqrt(INNER * INNER + random() * (OUTER * OUTER - INNER * INNER));
      // Clear of the lines between houses by a fixed distance, whatever the radius.
      const edge = Math.min(span * 0.42, 15 / r);
      const a = from + edge + random() * (span - 2 * edge);
      const p = [r * Math.cos(a), r * Math.sin(a)];
      if (pts.every((q) => dist(p, q) >= clear)) pts.push(p);
    }
    if (pts.length === count) return pts;
  }
  throw new Error(`a house of ${count} stars does not fit between ${from} and ${to}`);
}

/**
 * The order to visit points in so that the line through them is short and does not cross itself more than it must:
 * from the star nearest the rim, always on to the nearest star not yet visited, and then any stretch of the line is
 * turned end for end wherever that shortens it (2-opt), until nothing more is gained.
 */
function thread(pts) {
  if (pts.length < 3) return [...pts].sort((a, b) => Math.hypot(...b) - Math.hypot(...a));
  const rest = [...pts];
  let at = rest.reduce((best, p) => (Math.hypot(...p) > Math.hypot(...best) ? p : best));
  const path = [at];
  rest.splice(rest.indexOf(at), 1);
  while (rest.length) {
    const next = rest.reduce((best, p) => (dist(at, p) < dist(at, best) ? p : best));
    rest.splice(rest.indexOf(next), 1);
    path.push(next);
    at = next;
  }
  for (let improved = true, rounds = 0; improved && rounds < 60; rounds++) {
    improved = false;
    for (let i = 1; i < path.length - 1; i++) {
      for (let j = i + 1; j < path.length; j++) {
        const turned = [...path.slice(0, i), ...path.slice(i, j + 1).reverse(), ...path.slice(j + 1)];
        if (length(turned) < length(path) - 0.01) {
          path.splice(0, path.length, ...turned);
          improved = true;
        }
      }
    }
  }
  return path;
}

/**
 * Where everything on the chart stands.
 * @param {{ id: string, slugs: string[] }[]} tables  the tables in their order, each with its folios' slugs in theirs
 * @param {{ seed?: number, gap?: number }} [options]  `gap` is the share of the circle left between two houses
 * @returns {{
 *   houses: { id: string, from: number, to: number, mid: number }[],
 *   stars: { slug: string, table: string, x: number, y: number }[],
 *   lines: { table: string, d: string }[],
 * }}  angles in radians, measured clockwise from the top of the chart
 */
export function chart(tables, { seed = 1490, gap = 0.006 } = {}) {
  // A house is as wide as it has folios, and an empty one still has a door.
  const weight = (/** @type {{ slugs: string[] }} */ t) => t.slugs.length + 1.5;
  const total = tables.reduce((n, t) => n + weight(t), 0);
  const room = TAU * (1 - gap * tables.length);
  const houses = [];
  const stars = [];
  const lines = [];
  let at = -Math.PI / 2;
  tables.forEach((t, i) => {
    const from = at + (gap * TAU) / 2;
    const to = from + (weight(t) / total) * room;
    at = to + (gap * TAU) / 2;
    houses.push({ id: t.id, from, to, mid: (from + to) / 2 });
    if (!t.slugs.length) return;
    const path = thread(scatter(t.slugs.length, from, to, rng(seed * 31 + i * 977)));
    path.forEach((p, k) => stars.push({ slug: t.slugs[k], table: t.id, x: f(p[0]), y: f(p[1]) }));
    if (path.length > 1) lines.push({ table: t.id, d: `M${path.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}` });
  });
  return { houses, stars, lines };
}

/** A point on a circle about the pole: for the rim, its ticks and its lettering. */
export const onCircle = (/** @type {number} */ r, /** @type {number} */ a) => [f(r * Math.cos(a)), f(r * Math.sin(a))];

/**
 * How bright a star is drawn, from 1 (faint) to 5 (the brightest), by how many folios cite it against the most that
 * cite any one: the scale an astronomer's magnitudes run on, turned the right way up.
 */
export function magnitude(cited, most) {
  if (most <= 0 || cited <= 0) return 1;
  return 1 + Math.min(4, Math.round(4 * Math.sqrt(cited / most)));
}
