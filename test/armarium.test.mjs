// The cabinet on the frontispiece: every roll is in its pile once, and a pile narrows upward.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { footOf, pile, pileRows } from '../lib/armarium.mjs';
import { headpiece } from '../lib/illumination.mjs';

test('a pile holds every roll once, in order', () => {
  for (let n = 0; n <= 60; n++) {
    const items = Array.from({ length: n }, (_, i) => i);
    assert.deepEqual(pile(items).flat(), items);
    assert.equal(pileRows(n).reduce((a, b) => a + b, 0), n);
  }
});

test('a pile that fits a triangle narrows by one roll a row', () => {
  for (let n = 1; n <= 21; n++) {
    const rows = pileRows(n);
    assert.ok(Math.max(...rows) <= 6, `${n} rolls: a row of ${Math.max(...rows)}`);
    // Below the top row, which takes what is left over, each row is one longer than the row above it.
    for (let i = 2; i < rows.length; i++) assert.equal(rows[i], rows[i - 1] + 1, `${n} rolls: ${rows}`);
    if (rows.length > 1) assert.ok(rows[0] <= rows[1], `${n} rolls: ${rows}`);
  }
  assert.deepEqual(pileRows(16), [1, 4, 5, 6]);
  assert.deepEqual(pileRows(3), [1, 2]);
  assert.deepEqual(pileRows(1), [1]);
  assert.deepEqual(pileRows(0), []);
});

test('a larger pile fills the pigeonhole from wall to wall and never becomes a tower', () => {
  assert.deepEqual(pileRows(22), [5, 6, 5, 6]);
  assert.deepEqual(pileRows(30), [1, 3, 4, 5, 6, 5, 6]);
  for (let n = 22; n <= 400; n++) {
    for (const widest of [6, 7, 8, 9]) {
      const rows = pileRows(n, widest);
      assert.ok(Math.max(...rows) <= widest);
      // Every row sits in the hollows of the one beneath: their lengths differ by exactly one, but for the top row.
      for (let i = 2; i < rows.length; i++) assert.equal(Math.abs(rows[i] - rows[i - 1]), 1, `${n} rolls, ${widest} wide: ${rows}`);
      // No taller than the rolls need at nearly full rows, plus the narrowing top.
      assert.ok(rows.length <= Math.ceil(n / (widest - 0.5)) + widest, `${n} rolls, ${widest} wide: ${rows.length} rows`);
    }
  }
});

test('a table with more folios gets a wider foot of smaller rolls, up to nine', () => {
  assert.equal(footOf(1), 6);
  assert.equal(footOf(21), 6);
  assert.equal(footOf(22), 7);
  assert.equal(footOf(28), 7);
  assert.equal(footOf(29), 8);
  assert.equal(footOf(45), 9);
  assert.equal(footOf(500), 9);
  // With the foot it is given, a pile of up to forty-five rolls is still a triangle.
  for (let n = 1; n <= 45; n++) assert.ok(pileRows(n, footOf(n)).length <= footOf(n), `${n} rolls`);
});

test('a headpiece is whole and as long as its curls', () => {
  const band = headpiece({ seed: 1, count: 22 });
  assert.equal(band.width, 22 * 74);
  assert.ok(!/NaN|undefined|Infinity/.test(band.markup));
  assert.equal((band.markup.match(/class="il-(rose|green)"/g) ?? []).length, 22);
  assert.equal(headpiece({ seed: 1, count: 22 }).markup, band.markup);
});
