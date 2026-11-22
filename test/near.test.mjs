// The lost scroll offers the folios nearest an address that holds none.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { distance, nearest, nearness } from '../lib/near.mjs';

const FOLIOS = {
  tmux: { t: 'tmux' },
  'tmux-keymap': { t: 'The tmux Keymap' },
  ssh: { t: 'SSH' },
  'claude-code': { t: 'Claude Code' },
  'parallel-worktrees': { t: 'Parallel Worktrees' },
  bitcoin: { t: 'Bitcoin' },
};
const slugs = (asked) => nearest(asked, FOLIOS).map((f) => f.slug);

test('distance counts the letters that must change', () => {
  assert.equal(distance('tmux', 'tmux'), 0);
  assert.equal(distance('tmxu', 'tmux'), 2);
  assert.equal(distance('', 'ssh'), 3);
  assert.equal(distance('kitten', 'sitting'), 3);
});

test('a mistyped slug finds its folio first', () => {
  assert.equal(slugs('/tmux-kemap/')[0], 'tmux-keymap');
  assert.equal(slugs('/claud-code/')[0], 'claude-code');
  assert.equal(slugs('/paralel-worktree')[0], 'parallel-worktrees');
});

test('a word added or left off still finds it, and so does a title', () => {
  assert.equal(slugs('/ssh-config/')[0], 'ssh');
  assert.equal(slugs('/worktrees/')[0], 'parallel-worktrees');
  assert.equal(slugs('/The%20tmux%20Keymap/')[0], 'tmux-keymap');
});

test('nothing near is offered when nothing is near, and never more than three', () => {
  assert.deepEqual(slugs('/kubernetes-operators/'), []);
  assert.deepEqual(slugs('/'), []);
  assert.ok(slugs('/tmux/').length <= 3);
  assert.equal(nearness('/tmux/', 'tmux', 'tmux'), 1);
});
