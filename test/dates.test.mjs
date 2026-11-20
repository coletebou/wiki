// The Roman date, held to the days everyone knows and to the calendar's own arithmetic.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roman, romanDate, romanDay } from '../lib/dates.mjs';

test('the fixed days are named outright', () => {
  assert.equal(romanDay(2026, 1, 1), 'Kal. Ian.');
  assert.equal(romanDay(2026, 3, 15), 'Id. Mart.'); // the Ides of March
  assert.equal(romanDay(2026, 3, 7), 'Non. Mart.');
  assert.equal(romanDay(2026, 1, 5), 'Non. Ian.');
  assert.equal(romanDay(2026, 1, 13), 'Id. Ian.');
  assert.equal(romanDay(2026, 10, 15), 'Id. Oct.');
  assert.equal(romanDay(2026, 9, 13), 'Id. Sept.');
});

test('the day before a fixed day is pridie', () => {
  assert.equal(romanDay(2026, 12, 31), 'prid. Kal. Ian.');
  assert.equal(romanDay(2026, 3, 14), 'prid. Id. Mart.');
  assert.equal(romanDay(2026, 1, 4), 'prid. Non. Ian.');
  assert.equal(romanDay(2026, 4, 30), 'prid. Kal. Mai.');
});

test('other days count back from the next fixed day, both ends included', () => {
  assert.equal(romanDay(2026, 11, 20), 'a.d. XII Kal. Dec.');
  assert.equal(romanDay(2026, 1, 2), 'a.d. IV Non. Ian.');
  assert.equal(romanDay(2026, 3, 2), 'a.d. VI Non. Mart.');
  assert.equal(romanDay(2026, 1, 6), 'a.d. VIII Id. Ian.');
  assert.equal(romanDay(2026, 1, 14), 'a.d. XIX Kal. Feb.');
  assert.equal(romanDay(2026, 12, 25), 'a.d. VIII Kal. Ian.'); // Christmas, as the calendars of the Church still have it
  assert.equal(romanDay(2026, 2, 14), 'a.d. XVI Kal. Mart.');
  assert.equal(romanDay(2026, 2, 28), 'prid. Kal. Mart.');
});

test('a leap year counts the sixth day before the Kalends of March twice', () => {
  assert.equal(romanDay(2028, 2, 14), 'a.d. XVI Kal. Mart.');
  assert.equal(romanDay(2028, 2, 23), 'a.d. VII Kal. Mart.');
  assert.equal(romanDay(2028, 2, 24), 'a.d. bis VI Kal. Mart.');
  assert.equal(romanDay(2028, 2, 25), 'a.d. VI Kal. Mart.');
  assert.equal(romanDay(2028, 2, 29), 'prid. Kal. Mart.');
  // A common year has one sixth day, the 24th.
  assert.equal(romanDay(2026, 2, 24), 'a.d. VI Kal. Mart.');
  assert.equal(romanDay(2100, 2, 24), 'a.d. VI Kal. Mart.'); // 2100 is not a leap year
});

test('every day of a year has a name, and within a month the counts only run down to each fixed day', () => {
  for (const year of [2026, 2028]) {
    const names = new Set();
    for (let m = 1; m <= 12; m++) {
      const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
      for (let d = 1; d <= days; d++) {
        const name = romanDay(year, m, d);
        assert.match(name, /^(Kal\.|Non\.|Id\.|prid\. (Kal|Non|Id)\.|a\.d\. (bis )?[IVXL]+ (Kal|Non|Id)\.) [A-Z][a-z]+\.$/, `${year}-${m}-${d} is "${name}"`);
        names.add(name);
      }
      assert.throws(() => romanDay(year, m, days + 1), RangeError);
    }
    // No two days of a year share a name.
    assert.equal(names.size, year === 2028 ? 366 : 365);
  }
  assert.throws(() => romanDay(2026, 13, 1), RangeError);
  assert.throws(() => romanDay(2026, 0, 1), RangeError);
});

test('Roman numerals', () => {
  assert.equal(roman(2026), 'MMXXVI');
  assert.equal(roman(1490), 'MCDXC');
  assert.equal(roman(4), 'IV');
  assert.equal(roman(3999), 'MMMCMXCIX');
  for (const n of [0, 4000, 1.5]) assert.throws(() => roman(n), RangeError);
});

test('a whole date is read in UTC', () => {
  assert.equal(romanDate(new Date('2026-11-20T00:00:00Z')), 'a.d. XII Kal. Dec. MMXXVI');
  assert.equal(romanDate(new Date('2026-11-20T23:59:59Z')), 'a.d. XII Kal. Dec. MMXXVI');
  assert.equal(romanDate(new Date('2027-01-01T00:00:00Z')), 'Kal. Ian. MMXXVII');
});
