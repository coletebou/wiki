// The white-vine initial: which folios get one, that each folio's is its own and the same on every build, and that
// the spray in the margin stops where the opening paragraph does.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arm, initialOf, letterFit, smooth, sprayRoom, whiteVine } from '../lib/illumination.mjs';

test('a folio that opens on a letter gets that letter, as a capital', () => {
  assert.equal(initialOf('tmux is a terminal multiplexer'), 'T');
  assert.equal(initialOf('\n\n  Being a beast'), 'B');
  assert.equal(initialOf('**Bold** opening'), 'B');
  assert.equal(initialOf('[Astro](https://astro.build) builds it'), 'A');
});

test('a folio that opens on code, a wiki link, a component or a mark opens plain', () => {
  for (const body of ['`tm` is the way back', '[[tmux]] keeps sessions', '<Diagram name="x" />', '“Quoted” words', '1Password holds', '']) {
    assert.equal(initialOf(body), null, JSON.stringify(body));
  }
});

test('wide capitals and the Q are cut smaller, to stay inside the panel', () => {
  assert.ok(letterFit('M').size < letterFit('T').size);
  assert.ok(letterFit('W').size < letterFit('T').size);
  assert.ok(letterFit('Q').y < 50 + letterFit('Q').size * 0.35);
});

test('the same folio draws the same initial on every build, and no two folios the same', () => {
  const a = whiteVine({ seed: 11, id: 'a' });
  assert.deepEqual(a, whiteVine({ seed: 11, id: 'a' }));
  assert.notEqual(a.panel, whiteVine({ seed: 12, id: 'a' }).panel);
});

test('an initial is whole: four curls, their grounds, no number that is not a number', () => {
  for (let seed = 1; seed <= 90; seed++) {
    const v = whiteVine({ seed, id: `f${seed}` });
    const all = v.defs + v.panel + v.spray;
    assert.ok(!/NaN|undefined|Infinity/.test(all), `folio ${seed} drew a number that is not a number`);
    assert.equal((v.panel.match(/class="il-(rose|green)"/g) ?? []).length, 4);
    assert.equal((v.panel.match(/class="il-rose"/g) ?? []).length, 2);
    assert.ok(v.defs.includes(`id="${v.gold}"`) && v.defs.includes(`id="${v.clip}"`));
  }
});

test('the spray runs no further down the margin than the room it is given', () => {
  const lowest = (markup) => Math.max(...[...markup.matchAll(/[ML ,]\s*(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2])));
  for (let seed = 1; seed <= 60; seed++) {
    for (const room of [4, 30, 57, 95]) {
      const v = whiteVine({ seed, id: 'x', room });
      assert.ok(lowest(v.spray) <= 104 + Math.max(16, room - 14) + 8, `folio ${seed} overruns a room of ${room}`);
    }
  }
});

test('a longer opening paragraph leaves more room beneath the initial', () => {
  const short = 'a'.repeat(240);
  const long = 'a'.repeat(700);
  assert.ok(sprayRoom(long) > sprayRoom(short));
  assert.equal(sprayRoom(short), 4);
  // Link syntax is not letters on the page.
  assert.equal(sprayRoom(`${'a'.repeat(200)} [[some-long-slug-name-here|x]] and [y](https://example.com/a/very/long/address/that/is/not/shown)`), 4);
});

test('an arm meets its curl at a tangent and ends inside it', () => {
  const pts = arm([50, 50], [26, 26], 19, 1, 1.6, 7);
  const end = pts.at(-1);
  assert.ok(Math.hypot(end[0] - 26, end[1] - 26) < 19 - 7);
  assert.match(smooth(pts), /^M[\d. -]+(C[\d. -]+)+$/);
});
