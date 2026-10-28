// propose_edit's checks, without GitHub: a change is judged by what it does to the whole wiki.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProcessor } from '@mdx-js/mdx';
import { bodyOf } from '../../lib/wikilinks.mjs';
import { parseFrontmatter } from '../frontmatter.mjs';
import { ProposalError, applyEdits, proposeEdit } from '../propose.mjs';

const page = (slug, folio, body) => {
  const source = `---\ntitle: ${slug}\nsummary: A page used by the propose_edit tests, long enough.\ntable: library\nfolio: ${folio}\nupdated: 2026-10-28\n---\n${body}`;
  const { body: b, offset } = bodyOf(source);
  return { slug, file: `${slug}.mdx`, source, data: parseFrontmatter(source).data, body: b, offset, sha: 'x'.repeat(40) };
};
const wiki = () => [page('alpha', 1, 'See [[beta#keep-me|the section]].\n'), page('beta', 2, 'Intro line for beta.\n\n## Keep me\n\nText.\n')];
const run = (pages, input) =>
  proposeEdit({
    input: { summary: 'A test change to a page.', dry_run: true, ...input },
    source: { load: async () => ({ pages, priceIds: null }) },
    github: null,
    parse: parseFrontmatter,
    table: new Map(),
    parseMdx: (b) => createProcessor({ format: 'mdx' }).parse(b),
    repo: { owner: 'o', name: 'n', branch: 'master' },
    now: () => new Date('2026-10-28T12:00:00Z'),
  });

test('a clean edit passes', async () => {
  const out = await run(wiki(), { changes: [{ slug: 'beta', edits: [{ find: 'Intro line for beta.', replace: 'A better intro for beta.' }] }] });
  assert.equal(out.dry_run, true);
  assert.equal(out.branch, 'agent-edit/beta-20261028-120000');
});

test('removing a heading another page links to is refused', async () => {
  await assert.rejects(
    run(wiki(), { changes: [{ slug: 'beta', edits: [{ find: '## Keep me', replace: '## Renamed' }] }] }),
    (e) => e instanceof ProposalError && e.details.some((d) => d.startsWith('content/alpha.mdx') && d.includes('#keep-me')),
  );
});

test('a problem an untouched page already had does not block an unrelated edit', async () => {
  const pages = [...wiki(), page('gamma', 3, 'Links to [[nowhere]].\n')];
  const out = await run(pages, { changes: [{ slug: 'beta', edits: [{ find: 'Text.', replace: 'More text.' }] }] });
  assert.equal(out.dry_run, true);
});

test('a page with code in it is refused', async () => {
  await assert.rejects(run(wiki(), { changes: [{ slug: 'beta', edits: [{ find: 'Text.', replace: 'Text {process.env.X}.' }] }] }), /does not pass/);
});

test('find must match exactly once', () => {
  assert.throws(() => applyEdits('a a', [{ find: 'a', replace: 'b' }]), /more than once/);
  assert.throws(() => applyEdits('a', [{ find: 'z', replace: 'b' }]), /not found/);
});
