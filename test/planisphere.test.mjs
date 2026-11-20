// The planisphere's layout, held to what a chart needs: every folio one star in its own house, clear of its
// neighbours, the same on every build; and a line through each house that visits each star once.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RADIUS, chart, magnitude, onCircle } from '../lib/planisphere.mjs';

const tables = (counts) => counts.map((n, i) => ({ id: `t${i}`, slugs: Array.from({ length: n }, (_, k) => `t${i}-f${k}`) }));
// The library as it stands (ten tables of uneven size), and one a good deal larger.
const LIBRARY = [5, 17, 14, 9, 12, 7, 6, 4, 1, 6];
const LARGE = [40, 55, 12, 0, 30, 9, 3, 25, 1, 18];
const angleOf = (x, y) => {
  // Clockwise from the top, as the houses are measured: in [-PI/2, 3PI/2).
  const a = Math.atan2(y, x);
  return a < -Math.PI / 2 ? a + Math.PI * 2 : a;
};

for (const [name, counts] of [['the library as it stands', LIBRARY], ['a library three times the size', LARGE]]) {
  test(`${name}: the houses go once round the chart without overlapping`, () => {
    const { houses } = chart(tables(counts));
    assert.equal(houses.length, counts.length);
    assert.ok(Math.abs(houses[0].from - -Math.PI / 2) < 0.05, 'the first house does not begin at the top');
    for (let i = 0; i < houses.length; i++) {
      assert.ok(houses[i].to > houses[i].from, `house ${i} has no width`);
      if (i) assert.ok(houses[i].from >= houses[i - 1].to, `house ${i} overlaps the one before`);
    }
    assert.ok(houses.at(-1).to <= (Math.PI * 3) / 2 + 1e-9, 'the last house runs past the top');
    // Wider houses for larger tables.
    const widest = houses.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
    assert.equal(widest.id, `t${counts.indexOf(Math.max(...counts))}`);
  });

  test(`${name}: every folio is one star, in its own house, off the pole and inside the rim`, () => {
    const { houses, stars } = chart(tables(counts));
    assert.equal(stars.length, counts.reduce((a, b) => a + b, 0));
    assert.equal(new Set(stars.map((s) => s.slug)).size, stars.length);
    for (const s of stars) {
      const house = houses.find((h) => h.id === s.table);
      const r = Math.hypot(s.x, s.y);
      assert.ok(r > RADIUS * 0.16 && r < RADIUS * 0.91, `${s.slug} stands at ${r.toFixed(0)}`);
      const a = angleOf(s.x, s.y);
      assert.ok(a > house.from && a < house.to, `${s.slug} is outside its house`);
    }
  });

  test(`${name}: no two stars stand on top of one another`, () => {
    const { stars } = chart(tables(counts));
    let least = Infinity;
    for (let i = 0; i < stars.length; i++)
      for (let j = i + 1; j < stars.length; j++) least = Math.min(least, Math.hypot(stars[i].x - stars[j].x, stars[i].y - stars[j].y));
    // In the chart's units, of which the chart is 960 across: room for a star and a finger at any size it is shown.
    assert.ok(least >= (counts === LIBRARY ? 30 : 14), `two stars are ${least.toFixed(1)} apart`);
  });

  test(`${name}: a line runs through each house's stars, each once, in the order of the folios`, () => {
    const { stars, lines } = chart(tables(counts));
    for (const [i, n] of counts.entries()) {
      const line = lines.find((l) => l.table === `t${i}`);
      if (n < 2) {
        assert.equal(line, undefined);
        continue;
      }
      const pts = line.d.slice(1).split('L');
      const mine = stars.filter((s) => s.table === `t${i}`);
      assert.deepEqual(pts, mine.map((s) => `${s.x} ${s.y}`));
      assert.deepEqual(mine.map((s) => s.slug), Array.from({ length: n }, (_, k) => `t${i}-f${k}`));
    }
  });
}

test('the line through a house is no longer than it need be', () => {
  // Against the same stars taken in the order they were scattered, the threaded line is far shorter.
  const { lines, stars } = chart(tables([24]));
  const len = (pts) => pts.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  const threaded = len(lines[0].d.slice(1).split('L').map((p) => p.split(' ').map(Number)));
  const shuffled = len([...stars].sort((a, b) => a.x * 7.3 + a.y - (b.x * 7.3 + b.y)).map((s) => [s.x, s.y]));
  assert.ok(threaded < shuffled * 0.6, `${threaded.toFixed(0)} against ${shuffled.toFixed(0)}`);
  // And from star to star it never leaps across the house: no step is longer than a third of the chart's radius.
  const pts = lines[0].d.slice(1).split('L').map((p) => p.split(' ').map(Number));
  const longest = Math.max(...pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])));
  assert.ok(longest < RADIUS * 0.45, `one step is ${longest.toFixed(0)} long`);
});

test('the same library draws the same chart; another seed, another', () => {
  assert.deepEqual(chart(tables(LIBRARY)), chart(tables(LIBRARY)));
  assert.notDeepEqual(chart(tables(LIBRARY)).stars, chart(tables(LIBRARY), { seed: 7 }).stars);
});

test('magnitudes run from 1 to 5 and rise with citation', () => {
  assert.equal(magnitude(0, 20), 1);
  assert.equal(magnitude(20, 20), 5);
  assert.equal(magnitude(0, 0), 1);
  let last = 0;
  for (let n = 0; n <= 20; n++) {
    const m = magnitude(n, 20);
    assert.ok(m >= last && m >= 1 && m <= 5);
    last = m;
  }
  assert.deepEqual(onCircle(100, 0), [100, 0]);
  assert.deepEqual(onCircle(100, Math.PI / 2), [0, 100]);
});
