import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProcessor } from '@mdx-js/mdx';
import { buildIndex, search } from '../lib/search.mjs';
import { incipit, stichoi } from '../lib/text.mjs';
import { validatePages } from '../lib/validate.mjs';

const pages = [
  { slug: 'tmux', title: 'tmux', summary: 'The terminal multiplexer.', aliases: ['multiplexer'], headings: [{ text: 'Status line' }], body: 'Sessions, windows and panes. The status line shows agents.' },
  { slug: 'langfuse', title: 'Langfuse', summary: 'Traces and cost analysis.', headings: [], body: 'Every Claude Code session is a trace with its cost.' },
];

test('search ranks title matches first and completes the last word', () => {
  const idx = buildIndex(pages);
  assert.equal(search(idx, 'tmux')[0].page.slug, 'tmux');
  assert.equal(search(idx, 'cost')[0].page.slug, 'langfuse');
  assert.equal(search(idx, 'multiplex')[0].page.slug, 'tmux');
  assert.match(search(idx, 'status')[0].snippet, /status line/i);
  assert.deepEqual(search(idx, 'zzzz'), []);
});

test('incipit and stichoi', () => {
  assert.equal(incipit('First words of the lede, which go on and on for a while longer than eleven.\n\n## Next', 5), 'First words of the lede…');
  assert.equal(stichoi('x'.repeat(72)), 2);
});

test('validatePages enforces the rules CI enforces', async () => {
  const page = (slug, body, data = {}) => ({
    slug,
    source: `---\n---\n${body}`,
    body,
    offset: 2,
    data: { title: slug, summary: 'A summary that is long enough to pass.', table: 'shell', folio: slug.length, updated: '2026-10-28', ...data },
  });
  const problems = await validatePages({
    pages: [
      page('good', 'Fine text linking [[other]].'),
      page('other', 'Text.'),
      page('bad', '# A title\n<Foo />\n<Price id="nope" />\n<Diagram name="map" />\n[[missing]]\n\nimport x from "y"', { folio: 4 }),
    ],
    priceIds: new Set(['vercel-pro']),
    parseMdx: (body) => createProcessor({ format: 'mdx' }).parse(body),
  });
  assert.equal(problems.has('good'), false);
  const msgs = problems.get('bad').map((p) => p.msg).join('\n');
  for (const want of ['no H1', 'unknown component <Foo>', '<Price id="nope">', '<Diagram name="map">', 'no page named "missing"', 'no import or export', 'folio 4 is already used']) {
    assert.match(msgs, new RegExp(want.replace(/[()[\]<>"]/g, '.')), want);
  }
});

test('a [[ that opens no wiki link is reported: a wrapped label, one never closed', async () => {
  const page = (slug, body, folio) => ({
    slug,
    source: `---\n---\n${body}`,
    body,
    offset: 2,
    data: { title: slug, summary: 'A summary that is long enough to pass.', table: 'shell', folio, updated: '2026-10-28' },
  });
  const msgs = async (body) => {
    const problems = await validatePages({ pages: [page('here', body, 1), page('other', 'Text.', 2)], targets: ['here'] });
    return (problems.get('here') ?? []).map((p) => `${p.line} ${p.msg}`);
  };
  const stray = /opens no wiki link/;
  const wrapped = await msgs('One line.\nSee [[other|a label\nthat wraps]] here.');
  assert.equal(wrapped.length, 1);
  assert.match(wrapped[0], /^4 \[\[other\|a label: /);
  assert.match(wrapped[0], stray);
  assert.match((await msgs('Left [[other open.')).join(), stray);
  assert.match((await msgs('Three [[[other]] brackets.')).join(), stray);
  assert.deepEqual(await msgs('Fine: [[other]], [[other|label]], `[[ -f x ]]`, \\[\\[escaped]] and\n\n```sh\n[[ -n "$x" ]]\n```'), []);
});
