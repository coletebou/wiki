// The link graph of the whole wiki: who links to whom, which links are broken, every page's headings.
// Pure: callers parse the files (each with its own frontmatter parser) and pass { slug, data, body } records.
import { extractLinks, headingsOf, keyOf, maskCode, slugify } from './wikilinks.mjs';

/** Plain Markdown links to another page of this wiki: [text](/slug/) or [text](/slug/#heading). */
const INTERNAL_HREF = /\]\(\/([a-z0-9][a-z0-9-]*)\/?(?:#([^)\s]+))?\)/g;

/**
 * @typedef {{ slug: string, data: Record<string, any>, body: string }} PageRecord
 * @typedef {{ from: string, raw: string, line: number, target: string, anchor: string | null, reason: string }} Broken
 */

/** @param {PageRecord[]} records */
export function buildGraph(records) {
  const pages = new Map();
  const byKey = new Map();
  const collisions = [];
  const claim = (key, slug, what) => {
    const k = keyOf(key);
    if (!k) return;
    const owner = byKey.get(k);
    if (owner && owner !== slug) collisions.push({ key: k, slugs: [owner, slug], what });
    else byKey.set(k, slug);
  };
  for (const r of records) pages.set(r.slug, r);
  // Slugs first, so a title or alias can never take over another page's slug.
  for (const r of records) byKey.set(keyOf(r.slug), r.slug);
  for (const r of records) {
    if (r.data?.title) claim(r.data.title, r.slug, 'title');
    for (const a of r.data?.aliases ?? []) claim(a, r.slug, 'alias');
  }

  /** The slug a link target names (a slug, a title or an alias, in any case), or null. */
  const resolve = (target) => byKey.get(keyOf(target)) ?? byKey.get(slugify(String(target).trim())) ?? null;

  const headings = new Map(records.map((r) => [r.slug, headingsOf(r.body)]));
  const outlinks = new Map();
  const backlinks = new Map(records.map((r) => [r.slug, new Set()]));
  /** @type {Broken[]} */
  const broken = [];

  for (const r of records) {
    const out = [];
    const add = (link) => {
      const to = link.target ? resolve(link.target) : r.slug;
      if (!to) {
        broken.push({ from: r.slug, ...pick(link), reason: `no page named "${link.target}"` });
        return;
      }
      if (link.anchor && !(headings.get(to) ?? []).some((h) => h.id === link.anchor)) {
        broken.push({ from: r.slug, ...pick(link), reason: `"${to}" has no heading #${link.anchor}` });
      }
      out.push({ to, anchor: link.anchor, label: link.label, line: link.line, kind: link.kind });
      if (to !== r.slug) backlinks.get(to).add(r.slug);
    };
    for (const link of extractLinks(r.body)) add({ ...link, kind: 'wiki' });
    const masked = maskCode(r.body);
    for (const m of masked.matchAll(INTERNAL_HREF)) {
      // Site routes that are not pages (the catalogue, search) are checked against the built site instead.
      if (!pages.has(m[1])) continue;
      add({ target: m[1], anchor: m[2] ?? null, label: null, raw: m[0], line: masked.slice(0, m.index).split('\n').length, kind: 'href' });
    }
    outlinks.set(r.slug, out);
  }

  const folio = (slug) => pages.get(slug)?.data?.folio ?? Infinity;
  const sorted = new Map([...backlinks].map(([slug, set]) => [slug, [...set].sort((a, b) => folio(a) - folio(b))]));
  return { pages, resolve, headings, outlinks, backlinks: sorted, broken, collisions };
}

const pick = (link) => ({ raw: link.raw, line: link.line, target: link.target, anchor: link.anchor });
