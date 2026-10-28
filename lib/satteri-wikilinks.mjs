// Sätteri mdast plugin (Astro 7's Markdown processor): turn [[wiki links]] into links to the page they name, and
// refuse any page that carries code (lib/mdx-safety.mjs), so not even a preview build of an unchecked pull request
// runs it: the build fails while compiling, before anything in the page is evaluated.
// A link to a page that does not exist fails the build. A missing heading only warns here, because heading ids
// are only final in the rendered HTML; scripts/check-links.mjs checks every anchor against the built site.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './frontmatter.mjs';
import { buildGraph } from './graph.mjs';
import { loadPages, signature } from './load-content.mjs';
import { nodeProblem } from './mdx-safety.mjs';
import { WIKILINK, isLink } from './wikilinks.mjs';

let cache = { key: '', graph: null };

/** The link graph of the content directory, re-read only when a page file changed. */
function graphOf(dir) {
  const key = signature(dir);
  if (cache.key !== key) cache = { key, graph: buildGraph(loadPages(dir, parseFrontmatter)) };
  return cache.graph;
}

/** @param {{ contentDir: string }} options */
export function wikiLinks({ contentDir }) {
  return (factory) => {
    const graph = graphOf(contentDir);
    const file = factory.fileURL ? fileURLToPath(factory.fileURL) : '(unknown file)';
    const here = path.dirname(file) === path.resolve(contentDir) ? path.basename(file, '.mdx') : null;
    const guard = (node) => {
      if (!here) return;
      const msg = nodeProblem(node);
      if (msg) {
        const line = node.position?.start?.line;
        throw new Error(`${path.relative(process.cwd(), file)}${line ? `:${line}` : ''}: ${msg}`);
      }
    };
    return {
      name: 'wiki-links',
      options: { position: true },
      mdxjsEsm: guard,
      mdxFlowExpression: guard,
      mdxTextExpression: guard,
      mdxJsxFlowElement: guard,
      mdxJsxTextElement: guard,
      html: guard,
      link: guard,
      definition: guard,
      image: guard,
      text(node, ctx) {
        if (!node.value.includes('[[')) return;
        // Whatever is left of a text node once its links are taken out must hold no [[: it would print as raw
        // brackets. lib/validate.mjs refuses each known cause first; this fails the build on any it does not know.
        const stray = (s) => {
          if (!here || !s.includes('[[')) return;
          const line = node.position?.start?.line;
          throw new Error(
            `${path.relative(process.cwd(), file)}${line ? `:${line}` : ''}: "${s.trim().slice(0, 60)}" holds a [[ that is no whole wiki link ` +
              '(a link is one line, its label plain words); it would print as raw brackets',
          );
        };
        const parent = ctx.parent(node);
        if (parent?.type === 'link' || parent?.type === 'linkReference') return stray(node.value);
        const parts = [];
        let last = 0;
        for (const m of node.value.matchAll(WIKILINK)) {
          if (!isLink(m)) continue;
          const [raw, rawTarget, rawAnchor, rawLabel] = m;
          const target = rawTarget.trim();
          const anchor = rawAnchor?.trim() || null;
          const slug = target ? graph.resolve(target) : here;
          if (!slug) {
            throw new Error(`${path.relative(process.cwd(), file)}: broken wiki link ${raw}: no page named "${target}"`);
          }
          if (anchor && !(graph.headings.get(slug) ?? []).some((h) => h.id === anchor)) {
            console.warn(`[wiki-links] ${path.basename(file)}: ${raw}: "${slug}" may have no heading #${anchor}`);
          }
          const page = graph.pages.get(slug);
          const heading = anchor ? (graph.headings.get(slug) ?? []).find((h) => h.id === anchor)?.text : null;
          const label = rawLabel?.trim() || (!target ? heading ?? anchor : target === slug ? page?.data?.title ?? slug : target);
          if (m.index > last) {
            stray(node.value.slice(last, m.index));
            parts.push({ type: 'text', value: node.value.slice(last, m.index) });
          }
          const url = slug === here && anchor ? `#${anchor}` : `/${slug}/${anchor ? `#${anchor}` : ''}`;
          parts.push({
            type: 'link',
            url,
            children: [{ type: 'text', value: label }],
            data: { hProperties: { className: ['wikilink'], 'data-slug': slug } },
          });
          last = m.index + raw.length;
        }
        stray(node.value.slice(last));
        if (!parts.length) return;
        if (last < node.value.length) parts.push({ type: 'text', value: node.value.slice(last) });
        ctx.replaceNode(node, parts);
      },
    };
  };
}
