import assert from 'node:assert/strict';
import { test } from 'node:test';
import GithubSlugger from 'github-slugger';
import { buildGraph } from '../lib/graph.mjs';
import { extractLinks, headingsOf, maskCode, slugger } from '../lib/wikilinks.mjs';

test('extracts wiki links with anchors, labels and escaped pipes', () => {
  const links = extractLinks('See [[tmux]], [[tmux-keymap#prefix|the prefix]] and | [[git\\|Git]] |.');
  assert.deepEqual(
    links.map(({ target, anchor, label }) => ({ target, anchor, label })),
    [
      { target: 'tmux', anchor: null, label: null },
      { target: 'tmux-keymap', anchor: 'prefix', label: 'the prefix' },
      { target: 'git', anchor: null, label: 'Git' },
    ],
  );
});

test('skips code fences, inline code and MDX comments, keeping line numbers', () => {
  const body = ['a [[one]]', '```md', '[[not-a-link]]', '```', 'b `[[nor-this]]` c', '{/* [[nor-that]] */}', '[[two]]'].join('\n');
  const links = extractLinks(body);
  assert.deepEqual(links.map((l) => [l.target, l.line]), [['one', 1], ['two', 7]]);
  assert.equal(maskCode(body).length, body.length);
});

test('heading ids match github-slugger, repeats included', () => {
  const headings = ['The `tm` picker', 'Cole’s take', 'Prefix (Ctrl-b) bindings', 'What it costs: $20/mo?', 'Résumé & naïve café', 'Overview', 'Overview', 'Overview-1'];
  const ref = new GithubSlugger();
  const mine = slugger();
  for (const h of headings) {
    const plain = h.replace(/`/g, '');
    assert.equal(mine(plain), ref.slug(plain), h);
  }
  assert.deepEqual(
    headingsOf('## The `tm` picker\n\n```\n## not a heading\n```\n### Deeper [[tmux|link]]').map((h) => h.id),
    ['the-tm-picker', 'deeper-link'],
  );
});

test('the graph resolves slugs, titles and aliases, and reports what is broken', () => {
  const page = (slug, title, body, aliases = []) => ({ slug, data: { title, aliases, folio: slug.length }, body });
  const g = buildGraph([
    page('tmux', 'tmux', '## Status line\nText.', ['terminal multiplexer']),
    page('yu', 'yu and the Claude Launchers', 'Uses [[Terminal Multiplexer]] and [[tmux#status-line|its status]] and [[tmux#nope]] and [[ghost]].'),
    page('tm', 'tm', 'Goes [back](/yu/) and to [[yu and the claude launchers]].'),
  ]);
  assert.equal(g.resolve('TMUX'), 'tmux');
  assert.deepEqual(g.backlinks.get('tmux'), ['yu']);
  assert.deepEqual(g.backlinks.get('yu'), ['tm']);
  assert.deepEqual(g.broken.map((b) => b.target + (b.anchor ? `#${b.anchor}` : '')), ['tmux#nope', 'ghost']);
});

test('same-page links [[#heading]] parse and resolve to their own page', () => {
  const links = extractLinks('See [[#the-rules|the rules]] and [[#later]]. Not a link: [[]].');
  assert.deepEqual(links.map((l) => [l.target, l.anchor, l.label]), [['', 'the-rules', 'the rules'], ['', 'later', null]]);
  const g = buildGraph([{ slug: 'p', data: { title: 'P' }, body: '## The rules\n\nSee [[#the-rules]] and [[#nope]].' }]);
  assert.deepEqual(g.broken.map((b) => b.anchor), ['nope']);
});
