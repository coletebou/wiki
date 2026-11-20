// The leaf's outline is a nine-slice mask: corners that keep their size and an edge piece that repeats. These hold it
// to what that needs: a closed outline inside its square, a gutter cut straight, and an edge piece that joins itself.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BURN, CORNER, SIZE, TILE, burnCss, burnShape, leafOutline, materialsCss, papyrusOutline, rng, volumenCss } from '../lib/materials.mjs';

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

test('the papyrus sheet is cut straight at head and tail, and its frayed sides join themselves', () => {
  const pts = points(papyrusOutline());
  for (const [x, y] of pts) assert.ok(x >= 0 && x <= SIZE && y >= 0 && y <= SIZE, `(${x}, ${y}) lies outside the square`);
  // The right side runs down the first half of the outline, the left side back up the second.
  const half = pts.length / 2;
  const [right, left] = [pts.slice(0, half), pts.slice(half)];
  assert.equal(right[0][1], 0);
  assert.equal(right.at(-1)[1], SIZE);
  assert.equal(left[0][1], SIZE);
  assert.equal(left.at(-1)[1], 0);
  for (const side of [right, left]) {
    const at = new Map(side.map(([x, y]) => [y, x]));
    // The edge piece repeats every TILE: where it starts and where it ends the edge stands at the same place.
    for (let y = 0; y <= CORNER; y += 3) assert.equal(at.get(y), at.get(y + TILE), `the side does not join at y=${y}`);
  }
  // Frayed, but only a little: nothing reaches further in than a text margin could spare.
  assert.ok(Math.max(...left.map((p) => p[0])) < 14 && Math.min(...right.map((p) => p[0])) > SIZE - 14);
  assert.ok(new Set(left.map((p) => p[0])).size > 40, 'the left side is not frayed');
});

test('the burnt edge runs from the foot of its box to the right side, and the holes lie on the leaf', () => {
  const shape = burnShape();
  const edge = points(`${shape.edge}Z`);
  assert.equal(edge[0][1], BURN.h);
  assert.equal(edge.at(-1)[0], BURN.w);
  for (const [x, y] of edge) assert.ok(x > 0 && x <= BURN.w + 8 && y > 0 && y <= BURN.h + 8, `(${x}, ${y}) leaves the box`);
  // The fire took the corner and no more: the edge keeps clear of the box's top and left, where the leaf goes on.
  assert.ok(Math.min(...edge.map((p) => p[0])) > BURN.w * 0.1);
  assert.ok(Math.min(...edge.map((p) => p[1])) > BURN.h * 0.05);
  assert.equal(shape.holes.length, 3);
  assert.ok(shape.left.startsWith(`M0 0H${BURN.w}L`) && shape.left.includes('H0Z'));
  assert.equal(burnShape({ seed: 2 }).edge, burnShape({ seed: 2 }).edge);
  assert.notEqual(burnShape({ seed: 2 }).edge, burnShape({ seed: 3 }).edge);
});

test('the page-only stylesheets set what their pages use, in both themes where the theme changes it', () => {
  const [vDay, vNight] = volumenCss.split(":root[data-theme='lucerna']");
  assert.ok(vDay.includes('--volumen-edge:url(') && vDay.includes('--fibres-v:url(') && vNight.includes('--fibres-v:url('));
  const [bDay, bNight] = burnCss.split(":root[data-theme='lucerna']");
  assert.ok(bDay.includes('--burn-left:url(') && bDay.includes('--burn-char:url(') && bDay.includes('--burn-ember:none'));
  assert.ok(bNight.includes('--burn-char:url(') && bNight.includes('--burn-ember:url('));
  for (const css of [volumenCss, burnCss]) assert.ok(!/[<>#]/.test(css.replace(/data:image\/svg\+xml,/g, '')), 'an unescaped <, > or # would break a data URI');
  // Neither is paid for by every page.
  assert.ok(!materialsCss.includes('--burn-') && !materialsCss.includes('--volumen-edge'));
});
