// The seeker puts the folio named what was asked for first.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fold, titleFit } from '../lib/fit.mjs';

test('a title that is the query fits best, then one that begins with it, then one that holds its words', () => {
  assert.equal(titleFit('tmux', 'tmux'), 3);
  assert.equal(titleFit('The Mac mini', 'mac mini'), 3); // a leading "the" is no difference
  assert.equal(titleFit('Claude Code', '  CLAUDE   code '), 3);
  assert.equal(titleFit('The tmux Keymap', 'tmux'), 2);
  assert.equal(titleFit('tm, the Session Picker', 'tm'), 2);
  assert.equal(titleFit('Mice: MX Master and Magic Mouse', 'magic mouse'), 1);
  assert.equal(titleFit('The Claude Code Status Line', 'status claude'), 1);
  assert.equal(titleFit('Dotfiles', 'tmux'), 0);
  assert.equal(titleFit('tmux', 'tmu'), 0); // a word still being typed is left to the index
  assert.equal(titleFit('tmux', ''), 0);
});

test('a query and a title are compared folded', () => {
  assert.equal(fold('  Café\tCRÈME '), 'cafe creme');
  assert.equal(titleFit('Café', 'cafe'), 3);
});

test('ordering by fit keeps the index order among equals', () => {
  const found = ['The tmux Status Line', 'The tmux Keymap', 'tmux', 'Starship'];
  const order = found
    .map((t, i) => ({ t, i, fit: titleFit(t, 'tmux') }))
    .sort((a, b) => b.fit - a.fit || a.i - b.i)
    .map((x) => x.t);
  assert.deepEqual(order, ['tmux', 'The tmux Status Line', 'The tmux Keymap', 'Starship']);
});
