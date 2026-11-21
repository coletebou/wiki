// The initial: which folios get one, and which letter.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialOf } from '../lib/illumination.mjs';

test('a folio that opens on a letter gets that letter, as a capital', () => {
  assert.equal(initialOf('tmux is a terminal multiplexer'), 'T');
  assert.equal(initialOf('\n\n  Being a beast'), 'B');
  assert.equal(initialOf('**Bold** opening'), 'B');
  assert.equal(initialOf('[Astro](https://astro.build) builds it'), 'A');
  // A word that only begins like a line of MDX is a word.
  assert.equal(initialOf('Importing a key takes one command'), 'I');
});

test('a folio that opens on code, a wiki link, a component or a mark opens plain', () => {
  for (const body of ['`tm` is the way back', '[[tmux]] keeps sessions', '<Diagram name="x" />', '“Quoted” words', '1Password holds', "import X from './x'\n\nImportant words", 'export const a = 1', '']) {
    assert.equal(initialOf(body), null, JSON.stringify(body));
  }
});
