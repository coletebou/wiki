// The folios nearest an address that holds none, for the lost scroll (the 404 page) to offer: a slug mistyped, a
// word left off or added, a folio asked for by its title. Pure.
import { fold } from './fit.mjs';

/** The words of a slug, a path or a title: lower case, accents off, split on anything not a letter or a digit. */
export const words = (/** @type {string} */ s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/** How many single letters must change to turn one string into the other. */
export function distance(/** @type {string} */ a, /** @type {string} */ b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/**
 * How near a folio is to what was asked for, from 0 to 1: the nearer of how little the slug must change to become
 * it, and how many of the words asked for its slug and title hold (a word counts if it is one of theirs or a letter
 * or two from one).
 * @param {string} asked the path that was asked for
 * @param {string} slug the folio's slug
 * @param {string} title the folio's title
 */
export function nearness(asked, slug, title) {
  return score(asked, slug, title).near;
}

/** The nearness, and how near the spelling alone is, which decides between folios equally near. */
function score(/** @type {string} */ asked, /** @type {string} */ slug, /** @type {string} */ title) {
  let plain = asked;
  try {
    plain = decodeURIComponent(asked);
  } catch {}
  const q = words(plain).join('-');
  if (!q) return { near: 0, spelled: 0 };
  const spelled = 1 - distance(q, slug) / Math.max(q.length, slug.length);
  const theirs = [...new Set([...words(slug), ...words(title)])];
  const mine = words(plain);
  const close = (w) => theirs.some((t) => t === w || (w.length > 3 && t.length > 3 && distance(w, t) <= (w.length > 6 ? 2 : 1)));
  const held = mine.filter(close).length / mine.length;
  return { near: Math.max(spelled, held), spelled };
}

/**
 * The folios nearest what was asked for, nearest first, at most `n` of them, none of them a poor match.
 * @param {string} asked
 * @param {Record<string, { t: string }>} folios slug to title, as /previews.json gives them
 */
export function nearest(asked, folios, n = 3, floor = 0.5) {
  return Object.entries(folios)
    .map(([slug, f]) => ({ slug, title: f.t, ...score(asked, slug, f.t) }))
    .filter((f) => f.near >= floor)
    .sort((a, b) => b.near - a.near || b.spelled - a.spelled || a.slug.localeCompare(b.slug))
    .slice(0, n)
    .map(({ slug, title, near }) => ({ slug, title, near }));
}
