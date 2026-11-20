// The leaf's outline is a nine-slice mask: corners that keep their size and an edge piece that repeats. These hold it
// to what that needs: a closed outline inside its square, a gutter cut straight, and an edge piece that joins itself.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CORNER, SIZE, TILE, leafOutline, materialsCss, rng } from '../lib/materials.mjs';

const points = (d) => d.slice(1, -1).split('L').map((p) => p.split(' ').map(Number));

test('the outline is one closed path inside its square', () => {
  const d = leafOutline();
  assert.match(d, /^M[\d. L-]+Z$/);
  for (const [x, y] of points(d)) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
    assert.ok(x >= 0 && x <= SIZE && y >= 0 && y <= SIZE, `(${x}, ${y}) lies outside the square`);
  }
});

test('the gutter is cut straight: the outline starts and ends on the left edge', () => {
  const pts = points(leafOutline());
  assert.equal(pts[0][0], 0);
  assert.equal(pts.at(-1)[0], 0);
});

test('the repeating piece of each edge joins itself', () => {
  const pts = points(leafOutline());
  const byKey = new Map(pts.map((p) => [p.join(','), p]));
  let checked = 0;
  for (const [x, y] of pts) {
    // Head and tail: the same height one piece further along. Fore-edge: the same reach one piece further down.
    const along = pts.find((q) => q[0] === x + TILE && Math.abs(q[1] - y) < 40 && x >= CORNER - 6 && x <= CORNER);
    if (along) {
      assert.equal(along[1], y, `head or tail does not join at x=${x}`);
      checked++;
    }
    const down = pts.find((q) => q[1] === y + TILE && q[0] > SIZE - 30 && x > SIZE - 30 && y >= CORNER - 6 && y <= CORNER);
    if (down) {
      assert.equal(down[0], x, `fore-edge does not join at y=${y}`);
      checked++;
    }
  }
  assert.ok(checked >= 3, `only ${checked} joins were found to check`);
  assert.ok(byKey.size > 100);
});

test('the same seed draws the same leaf, another seed another', () => {
  assert.equal(leafOutline({ seed: 5 }), leafOutline({ seed: 5 }));
  assert.notEqual(leafOutline({ seed: 5 }), leafOutline({ seed: 6 }));
  const a = rng(1);
  const b = rng(1);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('the stylesheet sets every texture in both themes', () => {
  const [day, night] = materialsCss.split(":root[data-theme='lucerna']");
  for (const name of ['grain', 'fibres', 'mottle', 'follicles', 'stone', 'veins']) {
    assert.ok(day.includes(`--${name}:url("data:image/svg+xml,`), `daylight has no --${name}`);
    assert.ok(night.includes(`--${name}:url("data:image/svg+xml,`), `lamplight has no --${name}`);
  }
  assert.ok(day.includes('--leaf-edge:url(') && day.includes('--leaf-edge-under:url('));
  assert.ok(!/[<>#]/.test(materialsCss.replace(/data:image\/svg\+xml,/g, '')), 'an unescaped <, > or # would break a data URI');
});
