// A date as a Roman, or a humanist scribe signing off a book in Leonardo's Florence, would write it: counted back
// from the next of the month's three fixed days, with the year in Roman numerals.
//
// The three days are the Kalends (the 1st), the Nones (the 5th, or the 7th in March, May, July and October) and the
// Ides (the 13th, or the 15th in those same four months). A fixed day is named outright ("Id. Mart.", the Ides of
// March). The day before one is "prid." (pridie). Any other day is "a.d." (ante diem) and a count to the next fixed
// day that includes both ends, so the 20th of November, with twelve days to the Kalends of December counting itself
// and the Kalends, is "a.d. XII Kal. Dec.". Days after the Ides are counted to the Kalends of the month after.
//
// A leap year adds its day to February by counting the sixth day before the Kalends of March twice: the 24th is
// "a.d. bis VI Kal. Mart." and the 25th "a.d. VI Kal. Mart." (which is why a leap year is a bissextile one). Up to the
// 23rd the days are counted as in any February.

const MONTHS = ['Ian.', 'Feb.', 'Mart.', 'Apr.', 'Mai.', 'Iun.', 'Iul.', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
const LONG = new Set([2, 4, 6, 9]); // March, May, July, October (counting January as 0): Nones on the 7th, Ides on the 15th

/** A whole number from 1 to 3,999 in Roman numerals. */
export function roman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new RangeError(`Roman numerals are written here for 1 to 3,999, not ${n}`);
  const signs = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [value, sign] of signs) {
    while (rest >= value) {
      out += sign;
      rest -= value;
    }
  }
  return out;
}

const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * The day and month of a date, the Roman way. `month` counts January as 1.
 * @param {number} year
 * @param {number} month
 * @param {number} day
 */
export function romanDay(year, month, day) {
  const m = month - 1;
  const length = [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
  if (!Number.isInteger(day) || !(m >= 0 && m < 12) || day < 1 || day > length) throw new RangeError(`there is no ${year}-${month}-${day}`);
  const nones = LONG.has(m) ? 7 : 5;
  const ides = nones + 8;
  const before = (/** @type {number} */ count, /** @type {string} */ what) => (count === 2 ? `prid. ${what}` : `a.d. ${roman(count)} ${what}`);
  if (day === 1) return `Kal. ${MONTHS[m]}`;
  if (day < nones) return before(nones - day + 1, `Non. ${MONTHS[m]}`);
  if (day === nones) return `Non. ${MONTHS[m]}`;
  if (day < ides) return before(ides - day + 1, `Id. ${MONTHS[m]}`);
  if (day === ides) return `Id. ${MONTHS[m]}`;
  const kalends = `Kal. ${MONTHS[(m + 1) % 12]}`;
  if (m === 1 && leap(year)) {
    // The doubled sixth: the 24th is the extra day, and the days before it keep the count of a common February.
    if (day === 24) return `a.d. bis VI ${kalends}`;
    if (day < 24) return before(28 - day + 2, kalends);
  }
  return before(length - day + 2, kalends);
}

/**
 * A whole date, the Roman way, with the year in Roman numerals: "a.d. XII Kal. Dec. MMXXVI". The date is read in UTC,
 * as every date on the site is.
 * @param {Date} date
 */
export function romanDate(date) {
  return `${romanDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())} ${roman(date.getUTCFullYear())}`;
}
