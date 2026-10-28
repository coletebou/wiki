#!/usr/bin/env node
// Check every internal link in the built site: each href and src must point at a file the build produced, and each
// #fragment at an element id on that page. This is where wiki-link anchors meet the real heading ids. External links
// are checked on a schedule instead (.github/workflows/external-links.yml), so a slow vendor site never blocks a PR.
//
//   node scripts/check-links.mjs dist
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SITE = 'https://wiki.coletebou.com';
const dist = path.resolve(process.argv[2] ?? 'dist');
if (!existsSync(dist)) {
  console.error(`check-links: ${dist} does not exist; build the site first`);
  process.exit(2);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const ATTR = /<(a|link|script|img|source|iframe|use)\b[^>]*?\s(href|src|xlink:href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const ID = /\s(?:id|name)\s*=\s*"([^"]+)"/g;

const files = walk(dist);
const html = files.filter((f) => f.endsWith('.html'));
const ids = new Map();
const idsOf = (file) => {
  if (!ids.has(file)) {
    const set = new Set();
    for (const m of readFileSync(file, 'utf8').matchAll(ID)) set.add(decode(m[1]));
    ids.set(file, set);
  }
  return ids.get(file);
};

/** The built file a site path is served from, or null. */
function fileFor(urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const rel = p.replace(/^\/+/, '');
  const candidates = p.endsWith('/') ? [path.join(dist, rel, 'index.html')] : [path.join(dist, rel), path.join(dist, rel, 'index.html'), path.join(dist, `${rel}.html`)];
  return candidates.find((c) => c.startsWith(dist) && existsSync(c) && statSync(c).isFile()) ?? null;
}

const broken = [];
let checked = 0;
for (const file of html) {
  const source = readFileSync(file, 'utf8');
  const pageUrl = new URL(`/${path.relative(dist, file).replace(/index\.html$/, '').replace(/\\/g, '/')}`, SITE);
  for (const m of source.matchAll(ATTR)) {
    const raw = decode(m[3] ?? m[4] ?? '').trim();
    if (!raw || /^(mailto:|tel:|javascript:|data:|blob:)/i.test(raw)) continue;
    let url;
    try {
      url = new URL(raw, pageUrl);
    } catch {
      broken.push({ file, raw, reason: 'not a valid URL' });
      continue;
    }
    if (url.origin !== SITE) continue;
    checked++;
    const target = fileFor(url.pathname);
    if (!target) {
      broken.push({ file, raw, reason: `no built file for ${url.pathname}` });
      continue;
    }
    if (url.hash && url.hash !== '#' && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!idsOf(target).has(id)) broken.push({ file, raw, reason: `no element with id "${id}" on ${url.pathname}` });
    }
  }
}

for (const b of broken) console.log(`${path.relative(dist, b.file)}: ${b.raw}: ${b.reason}`);
if (broken.length) {
  console.log(`\ncheck-links: ${broken.length} broken of ${checked} internal links in ${html.length} pages`);
  process.exit(1);
}
console.log(`check-links: ok, ${checked} internal links in ${html.length} pages`);
