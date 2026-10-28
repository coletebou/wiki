// Every rule a page must pass before it is built or proposed, in one place. Used by scripts/check-content.mjs (and
// so by CI) and by the MCP server before it opens a pull request. Pure, apart from the MDX parser passed in.
import { buildGraph } from './graph.mjs';
import { mdxProblems } from './mdx-safety.mjs';
import { scanText } from './safety.mjs';
import { DIAGRAMS, SCENES, validateFrontmatter } from './schema.mjs';
import { extractLinks, maskCode } from './wikilinks.mjs';

export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_PAGE_BYTES = 200_000;

/**
 * Problems that belong to the wiki as a whole: links that point nowhere (or at a missing heading), folio numbers used
 * twice, and titles or aliases claimed by two pages. [{ slug, line, msg }]
 */
export function globalProblems(pages) {
  const out = [];
  const folios = new Map();
  for (const p of pages) {
    const f = p.data?.folio;
    if (!Number.isInteger(f)) continue;
    if (folios.has(f)) out.push({ slug: p.slug, line: 1, msg: `folio ${f} is already used by ${folios.get(f)}` });
    else folios.set(f, p.slug);
  }
  const graph = buildGraph(pages);
  for (const c of graph.collisions) out.push({ slug: c.slugs[1], line: 1, msg: `${c.what} "${c.key}" is already taken by ${c.slugs[0]}` });
  for (const b of graph.broken) {
    const page = pages.find((p) => p.slug === b.from);
    out.push({ slug: b.from, line: (page?.offset ?? 0) + b.line, msg: `${b.raw}: ${b.reason}` });
  }
  return out;
}

/** Component attribute values the tree walk cannot judge alone: price ids and diagram names. */
function componentProblems(tree, priceIds) {
  const out = [];
  const attr = (node, name) => node.attributes?.find((a) => a.name === name)?.value;
  const walk = (node) => {
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const line = node.position?.start?.line ?? 1;
      if (node.name === 'Price') {
        const id = attr(node, 'id');
        if (typeof id !== 'string' || !id) out.push({ line, msg: '<Price> needs id="..."' });
        else if (priceIds && !priceIds.has(id)) out.push({ line, msg: `<Price id="${id}"> is not in src/data/prices.json` });
      }
      if (node.name === 'Diagram') {
        const name = attr(node, 'name');
        const scene = attr(node, 'scene');
        if (!DIAGRAMS.includes(name)) out.push({ line, msg: `<Diagram name="${name}"> is not one of ${DIAGRAMS.join(', ')}` });
        if (scene !== undefined && !(SCENES[name] ?? []).includes(scene)) out.push({ line, msg: `scene="${scene}" is not a scene of ${name}` });
      }
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return out;
}

/**
 * @param {object} o
 * @param {{ slug: string, data: object, body: string, offset: number, source: string, error?: Error | null }[]} o.pages
 *   every page of the wiki as it would be after the change
 * @param {string[]} [o.targets]  slugs to check page by page (default: all)
 * @param {Set<string> | null} [o.priceIds]  known price ids, or null to skip that check
 * @param {Map<string, string>} [o.table]  the deny-list table, for the public-safety scan
 * @param {(body: string) => object} [o.parseMdx]  MDX parser returning an mdast tree; throws on a syntax error
 * @param {'targets' | 'all'} [o.global]  whose wiki-wide problems to report (default: the targets')
 * @returns {Promise<Map<string, { line: number, msg: string }[]>>}
 */
export async function validatePages({ pages, targets, priceIds = null, table, parseMdx, global = 'targets' }) {
  const problems = new Map();
  const report = (slug, line, msg) => {
    if (!problems.has(slug)) problems.set(slug, []);
    problems.get(slug).push({ line, msg });
  };
  const want = new Set(targets ?? pages.map((p) => p.slug));

  for (const g of globalProblems(pages)) if (global === 'all' || want.has(g.slug)) report(g.slug, g.line, g.msg);

  for (const p of pages.filter((x) => want.has(x.slug))) {
    const { slug, body, offset = 0, source } = p;
    if (!SLUG.test(slug)) report(slug, 1, 'the slug (file name) must be lowercase words joined by hyphens');
    if (Buffer.byteLength(source, 'utf8') > MAX_PAGE_BYTES) report(slug, 1, `the page is over ${MAX_PAGE_BYTES / 1000} kB; split it`);
    if (p.error) report(slug, 1, `frontmatter is not valid: ${String(p.error.message).split('\n')[0]}`);
    else for (const msg of validateFrontmatter(p.data)) report(slug, 1, msg);

    const masked = maskCode(body);
    masked.split('\n').forEach((line, i) => {
      if (/^ {0,3}#(?!#)\s/.test(line)) report(slug, offset + i + 1, 'no H1 in the body: the title comes from frontmatter');
      if (/<!--/.test(line)) report(slug, offset + i + 1, 'HTML comments are invalid in MDX: use {/* ... */}');
    });

    // A label with code or formatting in it is split across Markdown nodes and would print as raw brackets.
    const links = extractLinks(body);
    for (const l of links) {
      const raw = body.slice(l.index, l.index + l.raw.length);
      if (/[`*<]/.test(raw)) report(slug, offset + l.line, `${raw}: a wiki link's label cannot hold code or formatting; write it as plain words`);
    }

    // Every [[ outside code must open a link the site can read. One never closed, or whose label wraps onto the next
    // line, would also print as raw brackets, with nothing failing.
    const starts = new Set(links.map((l) => l.index));
    for (const m of masked.matchAll(/\[\[/g)) {
      if (starts.has(m.index)) continue;
      const rest = body.slice(m.index).split('\n')[0];
      const shown = rest.length > 40 ? `${rest.slice(0, 40)}…` : rest;
      const line = masked.slice(0, m.index).split('\n').length;
      report(slug, offset + line, `${shown}: this [[ opens no wiki link; a link must close on the line it starts, and literal brackets belong in \`code\``);
    }

    if (table) for (const hit of scanText(`${slug}\n${source}`, { table })) report(slug, Math.max(1, hit.line - 1), `public-safety: ${hit.shown}${hit.line === 1 ? ' (in the slug)' : ''}`);

    if (parseMdx) {
      let tree = null;
      try {
        tree = parseMdx(body);
      } catch (error) {
        const line = error.line ?? error.place?.line ?? error.place?.start?.line;
        report(slug, line ? offset + line : 1, `MDX does not compile: ${error.reason ?? error.message}`);
      }
      if (tree) {
        for (const m of mdxProblems(tree)) report(slug, offset + m.line, m.msg);
        for (const m of componentProblems(tree, priceIds)) report(slug, offset + m.line, m.msg);
      }
    }
  }
  return problems;
}
