#!/usr/bin/env node
// Check pages before they are built: frontmatter schema, MDX syntax, components and their props, price ids, wiki
// links (against every page) and the public-safety lint. The rules live in lib/validate.mjs, shared with the MCP
// server, so a proposed edit is held to exactly what CI holds it to.
//
//   node scripts/check-content.mjs                    every page in content/
//   node scripts/check-content.mjs content/tmux.mdx   just these pages (links still resolve against every page)
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProcessor } from '@mdx-js/mdx';
import { parseFrontmatter } from '../lib/frontmatter.mjs';
import { loadPages } from '../lib/load-content.mjs';
import { loadDenyList } from '../lib/safety.mjs';
import { TABLES } from '../lib/schema.mjs';
import { validatePages } from '../lib/validate.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const pages = loadPages(path.join(ROOT, 'content'), parseFrontmatter);
const priceFile = path.join(ROOT, 'src/data/prices.json');
const priceIds = existsSync(priceFile) ? new Set(Object.keys(JSON.parse(readFileSync(priceFile, 'utf8')))) : null;
const table = loadDenyList(path.join(ROOT, 'safety/denylist.json'));
const mdx = createProcessor({ format: 'mdx' });

const wanted = process.argv.slice(2).map((p) => path.basename(p).replace(/\.mdx$/, ''));
for (const w of wanted) if (!pages.some((p) => p.slug === w)) console.error(`${w}.mdx: not found in content/`);
const targets = wanted.length ? wanted.filter((w) => pages.some((p) => p.slug === w)) : pages.map((p) => p.slug);

const problems = await validatePages({
  pages,
  targets,
  priceIds,
  table,
  parseMdx: (body) => mdx.parse(body),
  global: wanted.length ? 'targets' : 'all',
});

let count = 0;
for (const [slug, list] of [...problems].sort(([a], [b]) => a.localeCompare(b))) {
  for (const p of list.sort((a, b) => a.line - b.line)) {
    console.log(`content/${slug}.mdx:${p.line}: ${p.msg}`);
    count++;
  }
}
if (count) {
  console.log(`\n${count} problem${count === 1 ? '' : 's'} in ${problems.size} of ${targets.length} page${targets.length === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`ok: ${targets.length} page${targets.length === 1 ? '' : 's'} checked (${pages.length} in the wiki; tables ${TABLES.map((t) => t.id).join(' ')})`);
