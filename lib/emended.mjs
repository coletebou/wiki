// The folios most lately emended, told honestly. Folios emended on the same day have no order among themselves, so a
// day is taken whole or not at all: the newest days are listed while they fit, and a day with more folios than
// places left is named as one day ("80 folios set down together on 28 Oct") instead of a few of it picked by their
// folio numbers, which would claim an order the dates do not have. Pure.

/**
 * @template {{ data: { updated: Date, folio: number } }} P
 * @param {P[]} pages
 * @param {number} n the most folios to list
 * @returns {{ recent: P[], together: { date: Date, count: number } | null }}
 */
export function lately(pages, n = 8) {
  const days = new Map();
  for (const p of pages) {
    const key = p.data.updated.toISOString().slice(0, 10);
    if (!days.has(key)) days.set(key, []);
    days.get(key).push(p);
  }
  const recent = [];
  for (const key of [...days.keys()].sort().reverse()) {
    const day = days.get(key).sort((a, b) => a.data.folio - b.data.folio);
    if (recent.length + day.length > n) return { recent, together: { date: day[0].data.updated, count: day.length } };
    recent.push(...day);
    if (recent.length === n) break;
  }
  return { recent, together: null };
}
