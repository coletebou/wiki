// The front page's "Lately emended" never claims an order the dates do not have.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lately } from '../lib/emended.mjs';

const page = (folio, day) => ({ id: `f${folio}`, data: { folio, updated: new Date(`2026-${day}T00:00:00Z`) } });
const ids = (r) => r.recent.map((p) => p.id);

test('distinct days are listed newest first, up to the places there are', () => {
  const pages = [page(1, '10-01'), page(2, '10-03'), page(3, '10-02'), page(4, '10-05'), page(5, '10-04')];
  assert.deepEqual(ids(lately(pages, 3)), ['f4', 'f5', 'f2']);
  assert.equal(lately(pages, 3).together, null);
});

test('a day with more folios than the places left is named as one day, not cut by folio number', () => {
  const pages = [page(2, '11-21'), ...Array.from({ length: 80 }, (_, i) => page(i + 3, '10-28'))];
  const r = lately(pages, 8);
  assert.deepEqual(ids(r), ['f2']);
  assert.equal(r.together?.count, 80);
  assert.equal(r.together?.date.toISOString().slice(0, 10), '2026-10-28');
});

test('a day that fits is taken whole, in folio order', () => {
  const pages = [page(9, '11-02'), page(4, '11-02'), page(7, '11-01'), page(1, '10-01'), page(2, '10-01'), page(3, '10-01')];
  const r = lately(pages, 3);
  assert.deepEqual(ids(r), ['f4', 'f9', 'f7']);
  assert.equal(r.together, null);
});

test('when every folio shares one day, none is listed and the day is named', () => {
  const r = lately([page(1, '10-28'), page(2, '10-28'), page(3, '10-28')], 2);
  assert.deepEqual(ids(r), []);
  assert.equal(r.together?.count, 3);
});
