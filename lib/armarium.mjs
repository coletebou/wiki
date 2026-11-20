// The armarium: how the rolls of one pigeonhole are piled. Pure.

/** The rolls in a triangle whose foot is `k` wide. */
const triangle = (k) => (k * (k + 1)) / 2;

/**
 * How wide the foot of a pile may be: six rolls fill a pigeonhole at their usual size, and a table with more folios
 * than a triangle of six holds gets a wider foot of smaller rolls, up to nine.
 * @param {number} count
 */
export function footOf(count) {
  let k = 6;
  while (k < 9 && triangle(k) < count) k++;
  return k;
}

/**
 * Rows for a pile of `count` rolls, top row first. Piled as logs are: each row lies in the hollows of the row beneath,
 * so it is one shorter; a pile too large for a triangle fills the pigeonhole from wall to wall first (rows of the
 * widest and one fewer, by turns) and narrows to its top with what is left.
 * @param {number} count
 * @param {number} widest  the most rolls the foot of the pile may hold
 * @returns {number[]}
 */
export function pileRows(count, widest = 6) {
  const rows = [];
  let left = Math.max(0, Math.floor(count));
  // The foot: as wide as a triangle of this many rolls needs, and no wider than the pigeonhole.
  let row = widest;
  for (let k = 1; k <= widest; k++) {
    if (triangle(k) >= left) {
      row = k;
      break;
    }
  }
  while (left > 0) {
    const take = Math.min(row, left);
    rows.unshift(take);
    left -= take;
    // From a row one short of the widest, go back out to the wall only if what is left will not fit above as a triangle.
    row = take === widest - 1 && left > triangle(widest - 2) ? widest : Math.max(1, take - 1);
  }
  return rows;
}

/** A list cut into the rows of its pile, in order: the first items in the top row. */
export function pile(items, widest = 6) {
  const out = [];
  let i = 0;
  for (const n of pileRows(items.length, widest)) out.push(items.slice(i, (i += n)));
  return out;
}
