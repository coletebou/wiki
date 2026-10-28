#!/usr/bin/env node
// The wiki's MCP server (stdio): agents search, list, read and follow backlinks across every folio, and propose
// edits, which become pull requests labelled agent-edit. Setup: README.md, "Agents".
//
// Environment:
//   WIKI_SITE       where to read the wiki (default https://wiki.coletebou.com, via /api/wiki.json)
//   WIKI_DIR        read a local checkout instead (the repository root)
//   WIKI_REPO       owner/name to propose edits to (default coletebou/wiki); WIKI_BRANCH (default master)
//   GITHUB_TOKEN, GH_TOKEN or WIKI_GITHUB_TOKEN, else `gh auth token`: the caller's own GitHub credentials
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProcessor } from '@mdx-js/mdx';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { parseFrontmatter } from './frontmatter.mjs';
import { loadDenyList } from '../lib/safety.mjs';
import { buildIndex, search } from '../lib/search.mjs';
import { TABLES } from '../lib/schema.mjs';
import { createGitHub, resolveToken } from './github.mjs';
import { ProposalError, proposeEdit } from './propose.mjs';
import { createSource } from './wiki-source.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const SITE = (process.env.WIKI_SITE || 'https://wiki.coletebou.com').replace(/\/+$/, '');
const [owner, name] = (process.env.WIKI_REPO || 'coletebou/wiki').split('/');
const repo = { owner, name, branch: process.env.WIKI_BRANCH || 'master' };
const source = createSource({ dir: process.env.WIKI_DIR || undefined, site: SITE, parse: parseFrontmatter });
const table = loadDenyList(path.join(ROOT, 'safety/denylist.json'));
const guide = readFileSync(path.join(ROOT, 'docs/EDITING.md'), 'utf8');
const tableIds = TABLES.map((t) => t.id);
const mdx = createProcessor({ format: 'mdx' });

let indexFor = null;
async function index() {
  const wiki = await source.load();
  if (indexFor?.wiki !== wiki) {
    const docs = wiki.pages.map((p) => ({ slug: p.slug, title: p.data.title ?? p.slug, summary: p.data.summary ?? '', aliases: p.data.aliases ?? [], headings: p.headings, body: p.body, page: p }));
    indexFor = { wiki, index: buildIndex(docs) };
  }
  return indexFor;
}

const url = (slug) => `${SITE}/${slug}/`;
const brief = (p) => ({ slug: p.slug, title: p.data.title, summary: p.data.summary, table: p.data.table, folio: p.data.folio, url: url(p.slug) });
const result = (data, text) => ({ content: [{ type: 'text', text: text ?? JSON.stringify(data, null, 2) }], structuredContent: data });
const failure = (message, details) => ({ content: [{ type: 'text', text: [message, ...(details ?? []).map((d) => `- ${d}`)].join('\n') }], isError: true });

async function find(slugOrName) {
  const { wiki } = await index();
  const key = String(slugOrName).trim().toLowerCase();
  return (
    wiki.pages.find((p) => p.slug === key) ??
    wiki.pages.find((p) => String(p.data.title ?? '').toLowerCase() === key) ??
    wiki.pages.find((p) => (p.data.aliases ?? []).some((a) => a.toLowerCase() === key)) ??
    null
  );
}

const server = new McpServer(
  { name: 'coletebou-wiki', version: pkg.version },
  {
    instructions:
      `Cole Tebou's wiki "How to Be a Beast" (${SITE}): the whole working setup, from tmux and agents to Cloudflare, ` +
      'apps and costs. Use search, list_pages and read_page to answer from it, backlinks to follow references. To change ' +
      'it, read editing_guide first, then propose_edit (try dry_run first): it opens a pull request labelled agent-edit. ' +
      'The site is public: never put secrets, private names, host names, addresses or anything personal in an edit.',
  },
);

server.registerTool(
  'search',
  {
    title: 'Search the wiki',
    description: 'Full-text search over every page (titles, aliases, summaries, headings, text). Returns ranked pages with a snippet.',
    inputSchema: {
      query: z.string().min(1).describe('Words to search for, e.g. "tmux bindings" or "langfuse cost"'),
      limit: z.number().int().min(1).max(25).default(8).describe('How many results'),
      table: z.enum(tableIds).optional().describe('Only pages in this table'),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ query, limit, table: only }) => {
    const { index: idx } = await index();
    const hits = search(idx, query, 50)
      .map((h) => ({ ...h, page: h.page.page }))
      .filter((h) => !only || h.page.data.table === only)
      .slice(0, limit);
    return result({ query, results: hits.map((h) => ({ ...brief(h.page), score: Number(h.score.toFixed(3)), snippet: h.snippet })) });
  },
);

server.registerTool(
  'list_pages',
  {
    title: 'List pages',
    description: 'Every page in folio order, optionally only one table of the catalogue, with slug, title, summary and URL.',
    inputSchema: { table: z.enum(tableIds).optional().describe('Only pages in this table') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ table: only }) => {
    const { wiki } = await index();
    const pages = wiki.pages.filter((p) => !only || p.data.table === only).sort((a, b) => a.data.folio - b.data.folio);
    return result({ tables: TABLES.map(({ id, numeral, title, subtitle }) => ({ id, numeral, title, subtitle })), pages: pages.map(brief) });
  },
);

server.registerTool(
  'read_page',
  {
    title: 'Read a page',
    description:
      'One page: its metadata, headings, links, backlinks, the git blob sha of its file (pass it to propose_edit as base_sha) and its full MDX source.',
    inputSchema: { page: z.string().min(1).describe('Slug, title or alias, e.g. "tmux" or "The tmux Keymap"') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ page }) => {
    const p = await find(page);
    if (!p) return failure(`No page named "${page}". Use search or list_pages to find one.`);
    const meta = { ...brief(p), path: `content/${p.slug}.mdx`, sha: p.sha, aliases: p.data.aliases ?? [], updated: p.data.updated, headings: p.headings, links: p.links, backlinks: p.backlinks };
    return { content: [{ type: 'text', text: JSON.stringify(meta, null, 2) }, { type: 'text', text: p.source }], structuredContent: { ...meta, source: p.source } };
  },
);

server.registerTool(
  'backlinks',
  {
    title: 'Backlinks of a page',
    description: 'The pages that link to a page (its backlinks) and the pages it links to.',
    inputSchema: { page: z.string().min(1).describe('Slug, title or alias') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async ({ page }) => {
    const p = await find(page);
    if (!p) return failure(`No page named "${page}".`);
    const { wiki } = await index();
    const by = new Map(wiki.pages.map((x) => [x.slug, x]));
    return result({ page: brief(p), cited_by: p.backlinks.map((s) => brief(by.get(s))), cites: p.links.filter((s) => s !== p.slug).map((s) => brief(by.get(s))) });
  },
);

server.registerTool(
  'editing_guide',
  {
    title: 'How to edit the wiki',
    description: 'The page format, components, wiki-link syntax, catalogue tables and the public-safety rules. Read before propose_edit.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const { wiki } = await index();
    const nextFolio = Math.max(0, ...wiki.pages.map((p) => p.data.folio ?? 0)) + 1;
    return {
      content: [
        { type: 'text', text: guide },
        { type: 'text', text: `Next free folio number: ${nextFolio}. Price ids: ${[...(wiki.priceIds ?? [])].join(', ') || '(none)'}.` },
      ],
    };
  },
);

server.registerTool(
  'propose_edit',
  {
    title: 'Propose an edit',
    description:
      'Change one or more pages (or add new ones) as a pull request labelled agent-edit, opened with your own GitHub token. ' +
      'Each change gives the whole new file ("content") or exact find/replace "edits". The change is checked first with the ' +
      'same rules CI uses; set dry_run to only check it. Pass base_sha from read_page so a stale edit is refused.',
    inputSchema: {
      summary: z.string().min(10).describe('What the change does and why; becomes the pull request description'),
      title: z.string().optional().describe('Pull request title in Conventional Commits form, e.g. "docs(tmux): explain prefix C-c"'),
      changes: z
        .array(
          z.object({
            slug: z.string().describe('Page slug (file name without .mdx)'),
            content: z.string().optional().describe('The whole new file, frontmatter included'),
            edits: z.array(z.object({ find: z.string(), replace: z.string() })).optional().describe('Exact find/replace pairs; each find must occur once'),
            create: z.boolean().optional().describe('True to add a new page'),
            base_sha: z.string().optional().describe('The sha read_page returned; the edit is refused if the page changed since'),
          }),
        )
        .min(1)
        .max(10),
      dry_run: z.boolean().default(false).describe('Only validate; open nothing'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async (input) => {
    try {
      let github = null;
      if (!input.dry_run) {
        const token = await resolveToken();
        if (!token) return failure('No GitHub token: set GITHUB_TOKEN (or GH_TOKEN) for the MCP server, or log in with `gh auth login`.');
        github = createGitHub({ token });
      }
      const out = await proposeEdit({ input, source, github, parse: parseFrontmatter, table, parseMdx: (b) => mdx.parse(b), repo });
      return result(out);
    } catch (error) {
      if (error instanceof ProposalError) return failure(error.message, error.details);
      return failure(`propose_edit failed: ${error.message}`);
    }
  },
);

await server.connect(new StdioServerTransport());
console.error(`coletebou-wiki MCP ${pkg.version}: reading ${source.describe()}, proposing to ${repo.owner}/${repo.name}@${repo.branch}`);
