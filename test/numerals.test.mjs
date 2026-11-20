// Attic numerals, held to the worked examples in the article the About page cites and to their own arithmetic.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attic, atticText } from '../lib/numerals.mjs';

const VALUE = { Ι: 1, Δ: 10, Η: 100, Χ: 1000, Μ: 10000 };
const worth = (n) => attic(n).reduce((sum, { sign, five }) => sum + VALUE[sign] * (five ? 5 : 1), 0);

test('the worked examples', () => {
  assert.equal(atticText(49), 'ΔΔΔΔΠΙΙΙΙ');
  assert.equal(atticText(2001), 'ΧΧΙ');
  assert.equal(atticText(1982), 'Χ\u{10145}ΗΗΗΗ\u{10144}ΔΔΔΙΙ');
  assert.equal(atticText(62708), '\u{10147}ΜΧΧ\u{10145}ΗΗΠΙΙΙ');
});

test('nothing is subtracted: four is four strokes, nine is five and four', () => {
  assert.equal(atticText(4), 'ΙΙΙΙ');
  assert.equal(atticText(9), 'ΠΙΙΙΙ');
  assert.equal(atticText(5), 'Π');
  assert.equal(atticText(50), '\u{10144}');
});

test('every number adds back up to itself, largest signs first', () => {
  for (const n of [1, 7, 10, 99, 100, 555, 4999, 5000, 13105, 50000, 99999]) {
    assert.equal(worth(n), n, `${n} is written as ${atticText(n)}`);
    const values = attic(n).map(({ sign, five }) => VALUE[sign] * (five ? 5 : 1));
    assert.deepEqual(values, [...values].sort((a, b) => b - a), `${n} is not written largest first`);
  }
  for (let n = 1; n <= 3000; n++) assert.equal(worth(n), n);
});

test('no sign is written more than four times running', () => {
  for (let n = 1; n <= 99999; n += 37) {
    const signs = attic(n);
    for (let i = 4; i < signs.length; i++) {
      const run = signs.slice(i - 4, i + 1);
      assert.ok(!run.every((s) => s.sign === run[0].sign && s.five === run[0].five), `${n} repeats a sign five times`);
    }
  }
});

test('numbers the system is not written for here are refused', () => {
  for (const n of [0, -3, 100000, 2.5, Number.NaN]) assert.throws(() => attic(n), RangeError);
});
