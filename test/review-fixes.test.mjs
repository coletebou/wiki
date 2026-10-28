// Regression tests for the issues the independent reviews found, round by round.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createProcessor } from '@mdx-js/mdx';
import { mdxToJs } from 'satteri';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { mdxProblems } from '../lib/mdx-safety.mjs';
import { SALT, hashPhrase, scanText } from '../lib/safety.mjs';
import { wikiLinks } from '../lib/satteri-wikilinks.mjs';
import { headingText, slugify } from '../lib/wikilinks.mjs';

const j = (...parts) => parts.join('');
const rules = (text, opts) => scanText(text, opts).map((h) => h.rule);
const mdx = (body) => mdxProblems(createProcessor({ format: 'mdx' }).parse(body)).map((p) => p.msg);

test('frontmatter in another language is never evaluated', () => {
  globalThis.__ran = false;
  const r = parseFrontmatter('---js\n{ title: (globalThis.__ran = true, "x") }\n---\nbody');
  assert.equal(globalThis.__ran, false);
  assert.deepEqual(r.data, {});
  assert.throws(() => parseFrontmatter('---\n- a\n- b\n---\n'), /mapping/);
  assert.equal(parseFrontmatter('---\ntitle: "A: b"\n---\n').data.title, 'A: b');
});

test('a page cannot carry code', () => {
  assert.match(mdx('Hi {1 + 1} there').join(), /no JavaScript expressions/);
  assert.match(mdx('export const x = 1\n\nHi').join(), /no import or export/);
  assert.match(mdx('<script>alert(1)</script>').join(), /<script> element is not allowed/);
  assert.match(mdx('<kbd onClick="x()">a</kbd>').join(), /may not have a onClick attribute/);
  assert.match(mdx('<Price id={"vercel-pro"} />').join(), /must be a plain string/);
  assert.match(mdx('[x](javascript:alert(1))').join(), /javascript: scheme/);
  assert.match(mdx('![x](https://example.com/p.png)').join(), /images must be files this site serves/);
  assert.match(mdx('<>frag</>').join(), /fragments/);
  assert.deepEqual(mdx('{/* a comment */}\n\n<kbd>Ctrl</kbd> <Price id="vercel-pro" /> [ok](https://example.com) ![a](/og.png)\n\n<Diagram name="tmux-keymap" />'), []);
});

test('addresses and phone numbers at the end of a sentence are caught', () => {
  assert.deepEqual(rules(j('Reach it at 100.', '101.2.3.')), ['ip:tailscale']);
  assert.deepEqual(rules(j('Origin: 52.', '14.1.9.')), ['ip:public']);
  assert.deepEqual(rules(j('Call 415-', '867-5309.')), ['phone:nanp']);
  assert.deepEqual(rules('Version 1.2.3.4.5 and 1,234.56 are not addresses.'), []);
});

test('a host route is an address; a network range is not', () => {
  assert.deepEqual(rules(j('route 100.', '101.2.3/32')), ['ip:tailscale']);
  assert.deepEqual(rules(j('allow 52.', '14.1.9/32')), ['ip:public']);
  assert.deepEqual(rules('Tailscale uses 100.64.0.0/10; LANs use 10.0.0.0/8 and 192.168.1.0/24.'), []);
});

test('markup cannot split a phrase or a number past the lint', () => {
  const table = new Map([[hashPhrase(j('zork', 'mid'), SALT), 'host']]);
  assert.deepEqual(rules(j('on zork<span>', 'mid</span> today'), { table }), ['denylist:host']);
  assert.deepEqual(rules(j('on zork**', 'mid** today'), { table }), ['denylist:host']);
  assert.deepEqual(rules(j('mail jane<b>@', '</b>gmail.com')), ['email']);
});

test('heading ids keep inline code exactly', () => {
  assert.equal(slugify(headingText('`GITHUB_TOKEN` and `GH_TOKEN`')), 'github_token-and-gh_token');
  assert.equal(slugify(headingText('The *tm* picker')), 'the-tm-picker');
  assert.equal(slugify(headingText('**Bold** _it_ snake_case')), 'bold-it-snake_case');
});

test('round 2: code between two comments is still code', () => {
  assert.match(mdx('{/* a */ globalThis.process.version /* b */}').join(), /no JavaScript expressions/);
  assert.match(mdx('{/* a */}{1}').join(), /no JavaScript expressions/);
  assert.deepEqual(mdx('{/* one */ /* two */}'), []);
});

test('round 2: reference-style images are refused', () => {
  assert.match(mdx('![x][pic]\n\n[pic]: https://example.com/p.png').join(), /write images inline/);
});

test('round 2: public IPv6 and legacy Bitcoin addresses are caught', () => {
  assert.deepEqual(rules(j('host 2606:4700:', '4700::1111 here')), ['ip:public6']);
  assert.deepEqual(rules('docs 2001:db8::1, loopback ::1, link fe80::1, ULA fd12:3456::1, time 12:30:45, a 2001:db8::/32'), []);
  assert.deepEqual(rules(j('pay 1A1zP1eP5QGefi2', 'DMPTfTL5SLmv7DivfNa')), ['wallet:btc-legacy']);
  assert.deepEqual(rules('id 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb is not a valid address'), []);
});

test('round 3: an IPv6 host stays a host with a prefix length after it, and a trailing :: is an address', () => {
  assert.deepEqual(rules(j('dns 2606:4700:', '4700::1111/48')), ['ip:public6']);
  assert.deepEqual(rules(j('host 2606:4700:', '4700:1:2:3:4::')), ['ip:public6']);
  assert.deepEqual(rules('ranges 2606:4700::/32 and 2001:db8::/32, the time 12:30:45, std::vector::iterator'), []);
});

test('round 3: the build fails on a [[ that would print as raw brackets', (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'wiki-build-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const content = path.join(dir, 'content');
  mkdirSync(content);
  for (const slug of ['other', 'here']) writeFileSync(path.join(content, `${slug}.mdx`), `---\ntitle: ${slug}\n---\nText.\n`);
  // As Astro compiles a page of the content collection: Sätteri's MDX pipeline with the wiki-link plugin.
  const compile = (body) => mdxToJs(body, { mdastPlugins: [wikiLinks({ contentDir: content })], fileURL: pathToFileURL(path.join(content, 'here.mdx')) });
  assert.match(compile('See [[other|plain words]], [[other]] and [[#a-heading|this page]].').code, /wikilink/);
  for (const body of ['See [[other|_split_]] here.', 'See [[other|~~gone~~]] here.', 'See [[other|at https://example.com]] here.', 'See [[other|a\nwrapped label]].', '[see [[other]]](https://example.com)', 'Left [[open here.', '| a | b |\n|---|---|\n| [[other|label]] | x |']) {
    assert.throws(() => compile(body), /would print as raw brackets/, body);
  }
});
