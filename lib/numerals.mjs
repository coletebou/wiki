// Attic numerals: the acrophonic numbers of classical Athens, in which the total of a work's lines (its stichoi) went
// on being written at the end of a roll long after the Greeks had taken up alphabetic numerals for everything else.
// The catalogue signs off with its own total in them.
//
// The system is additive and decimal. Each power of ten has a sign for one of it and a sign for five of it:
//   Ι 1   Π 5   Δ 10   Η 100   Χ 1,000   Μ 10,000
// and five of a power above the units is a Π with a small sign of that power written inside it (fifty is a Π holding
// a Δ). Nothing is subtracted: four is ΙΙΙΙ and nine is ΠΙΙΙΙ.

const POWERS = [
  [10000, 'Μ'],
  [1000, 'Χ'],
  [100, 'Η'],
  [10, 'Δ'],
  [1, 'Ι'],
];
/** The single characters Unicode gives the compound fives (Ancient Greek Numbers); few fonts carry them. */
const FIVES = { Μ: '\u{10147}', Χ: '\u{10146}', Η: '\u{10145}', Δ: '\u{10144}', Ι: 'Π' };

/**
 * A whole number from 1 to 99,999 as Attic signs, largest first. Each sign is `{ sign, five }`: `sign` is the power of
 * ten's own letter, and `five` says whether it stands for five of that power (drawn as a Π holding the letter; five
 * units is the bare Π).
 * @param {number} n
 * @returns {{ sign: string, five: boolean }[]}
 */
export function attic(n) {
  if (!Number.isInteger(n) || n < 1 || n > 99999) throw new RangeError(`Attic numerals are written here for 1 to 99,999, not ${n}`);
  const out = [];
  let rest = n;
  for (const [value, sign] of POWERS) {
    const count = Math.floor(rest / value);
    rest -= count * value;
    if (count >= 5) out.push({ sign, five: true });
    for (let i = 0; i < count % 5; i++) out.push({ sign, five: false });
  }
  return out;
}

/** The same number as a string, with Unicode's compound fives. For a label or a test; the page draws its own. */
export function atticText(n) {
  return attic(n)
    .map(({ sign, five }) => (five ? FIVES[sign] : sign))
    .join('');
}
