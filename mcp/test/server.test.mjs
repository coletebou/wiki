// End to end over stdio: start the real server against a local checkout and call every tool as a client would.
// The checks pick their pages from whatever the wiki holds, so editing content never breaks this test.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const WIKI_DIR = process.env.TEST_WIKI_DIR ?? path.resolve(here, '../..');
const TIMEOUT = { timeout: 60_000 };

/** A connected client; closed (and its server stopped) when the test ends, pass or fail. */
async function connect(t) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.resolve(here, '../server.mjs')],
    env: { ...process.env, WIKI_DIR, GITHUB_TOKEN: '', GH_TOKEN: '', WIKI_GITHUB_TOKEN: '' },
    stderr: 'pipe',
  });
  const client = new Client({ name: 'wiki-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(transport);
  return client;
}

const json = (r) => r.structuredContent ?? JSON.parse(r.content[0].text);
const call = async (c, name, args = {}) => c.callTool({ name, arguments: args });

/** A page to exercise and a line of its prose to edit, chosen from whatever the wiki holds. */
async function sample(c) {
  const { pages } = json(await call(c, 'list_pages'));
  for (const p of pages) {
    const page = json(await call(c, 'read_page', { page: p.slug }));
    const body = page.source.replace(/^---\n[\s\S]*?\n---\n/, '');
    const line = body.split('\n').find((l) => /^[A-Z][^<>{}|`[\]]{40,}\.$/.test(l));
    if (line) return { page, line };
  }
  throw new Error('no page has a plain prose line to edit');
}

test('lists the tools with the right hints', TIMEOUT, async (t) => {
  const c = await connect(t);
  const { tools } = await c.listTools();
  assert.deepEqual(tools.map((x) => x.name).sort(), ['backlinks', 'editing_guide', 'list_pages', 'propose_edit', 'read_page', 'search']);
  assert.equal(tools.find((x) => x.name === 'read_page').annotations.readOnlyHint, true);
  assert.equal(tools.find((x) => x.name === 'propose_edit').annotations.readOnlyHint, false);
});

test('list, search, read and backlinks agree with each other', TIMEOUT, async (t) => {
  const c = await connect(t);
  const list = json(await call(c, 'list_pages'));
  assert.ok(list.pages.length > 0);
  const folios = list.pages.map((p) => p.folio);
  assert.deepEqual(folios, [...folios].sort((a, b) => a - b));
  const first = list.pages[0];
  const found = json(await call(c, 'search', { query: first.title, limit: 5 }));
  assert.ok(found.results.some((r) => r.slug === first.slug), 'search finds a page by its title');
  const meta = json(await call(c, 'read_page', { page: first.title }));
  assert.equal(meta.slug, first.slug);
  assert.match(meta.sha, /^[0-9a-f]{40}$/);
  assert.match(meta.source, /^---\n/);
  const back = json(await call(c, 'backlinks', { page: first.slug }));
  assert.equal(back.page.slug, first.slug);
  for (const cited of back.cited_by) {
    const from = json(await call(c, 'read_page', { page: cited.slug }));
    assert.ok(from.links.includes(first.slug), `${cited.slug} links to ${first.slug}`);
  }
  const missing = await call(c, 'read_page', { page: 'no-such-page-anywhere' });
  assert.equal(missing.isError, true);
});

test('the editing guide carries the rules and the next free folio', TIMEOUT, async (t) => {
  const c = await connect(t);
  const r = await call(c, 'editing_guide');
  assert.match(r.content[0].text, /public-safety rules/i);
  assert.match(r.content[1].text, /Next free folio number: \d+/);
});

test('propose_edit refuses a private, broken or stale edit before anything is sent', TIMEOUT, async (t) => {
  const c = await connect(t);
  const { page, line } = await sample(c);
  const edit = (replace, extra = {}) => call(c, 'propose_edit', { summary: 'A test edit of one sentence.', dry_run: true, changes: [{ slug: page.slug, edits: [{ find: line, replace }], ...extra }] });

  const leak = await edit(`${line} Call ${['+1', '415', '867', '5309'].join(' ')}.`);
  assert.equal(leak.isError, true);
  assert.match(leak.content[0].text, /public-safety/);
  assert.doesNotMatch(leak.content[0].text, /867/);

  const broken = await edit(`${line} See [[no-such-folio]].`);
  assert.equal(broken.isError, true);
  assert.match(broken.content[0].text, /no page named "no-such-folio"/);

  const stale = await edit(`${line}!`, { base_sha: '0'.repeat(40) });
  assert.equal(stale.isError, true);
  assert.match(stale.content[0].text, /changed since you read it/);

  const twice = await call(c, 'propose_edit', { summary: 'Both content and edits.', dry_run: true, changes: [{ slug: page.slug, content: 'x', edits: [{ find: line, replace: 'y' }] }] });
  assert.equal(twice.isError, true);
});

test('propose_edit accepts a clean edit in a dry run', TIMEOUT, async (t) => {
  const c = await connect(t);
  const { page, line } = await sample(c);
  const ok = await call(c, 'propose_edit', {
    summary: 'Clarify one sentence.',
    dry_run: true,
    changes: [{ slug: page.slug, base_sha: page.sha, edits: [{ find: line, replace: `${line.slice(0, -1)}, as it stands today.` }] }],
  });
  if (ok.isError) {
    // The page itself must pass every rule for a clean edit of it to pass; say which rule it does not.
    assert.fail(ok.content[0].text);
  }
  const out = json(ok);
  assert.equal(out.dry_run, true);
  assert.match(out.title, new RegExp(`^docs\\(${page.slug}\\): `));
  assert.match(out.branch, new RegExp(`^agent-edit/${page.slug}-\\d{8}-\\d{6}$`));
});
