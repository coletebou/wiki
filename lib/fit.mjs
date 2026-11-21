// How squarely a folio's title answers a query, for ordering the seeker's results. Pure.

/** Text folded for comparing: accents off, lower case, spaces collapsed. */
export const fold = (/** @type {string} */ s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * How squarely a title answers a query: 3 if it is the query, 2 if it begins with it, 1 if it holds every word of
 * it, else 0. Pagefind weighs a whole page, so a long folio named exactly what was asked for can come third behind
 * shorter ones that merely mention it; within a list the better-named folio goes first, and otherwise the index's
 * order stands.
 * @param {string} title
 * @param {string} query
 */
export function titleFit(title, query) {
  const t = fold(title);
  const q = fold(query);
  if (!q) return 0;
  if (t === q || t === `the ${q}`) return 3;
  if (t.startsWith(`${q} `) || t.startsWith(`the ${q} `) || t.startsWith(`${q},`)) return 2;
  const words = new Set(t.split(/[^a-z0-9.]+/));
  return q.split(/[^a-z0-9.]+/).filter(Boolean).every((w) => words.has(w)) ? 1 : 0;
}

