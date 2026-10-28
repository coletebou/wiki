// Where the MCP server reads the wiki from: the live site's /api/wiki.json (the default; nothing to clone or build)
// or a local checkout (WIKI_DIR), which is what tests and offline work use.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildGraph } from '../lib/graph.mjs';
import { loadPages } from '../lib/load-content.mjs';
import { bodyOf, headingsOf } from '../lib/wikilinks.mjs';

/** The git blob id of a file's bytes: what GitHub reports as a file's `sha`. */
export const blobSha = (text) => {
  const buf = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
};

/** Fill in what each record needs for validation and display from its source text. */
function complete(records, parse) {
  const graph = buildGraph(records);
  return records.map((r) => ({
    ...r,
    headings: r.headings ?? headingsOf(r.body).map(({ depth, text, id }) => ({ depth, text, id })),
    links: [...new Set((graph.outlinks.get(r.slug) ?? []).map((l) => l.to))],
    backlinks: graph.backlinks.get(r.slug) ?? [],
  }));
}

/**
 * @param {{ dir?: string, site?: string, ttlMs?: number, parse: (s: string) => { data: object }, fetchImpl?: typeof fetch }} o
 */
export function createSource({ dir, site = 'https://wiki.coletebou.com', ttlMs = 60_000, parse, fetchImpl = fetch }) {
  let cached = null;
  let at = 0;

  async function fromSite() {
    const res = await fetchImpl(new URL('/api/wiki.json', site), { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`could not read ${site}/api/wiki.json (HTTP ${res.status})`);
    const json = await res.json();
    const records = json.pages.map((p) => {
      let data = {};
      let error = null;
      try {
        data = parse(p.source).data ?? {};
      } catch (e) {
        error = e;
      }
      const { body, offset } = bodyOf(p.source);
      return { slug: p.slug, file: `${p.slug}.mdx`, source: p.source, sha: p.sha, data, body, offset, error };
    });
    return { pages: complete(records, parse), priceIds: new Set(json.priceIds ?? []), origin: `${site}/api/wiki.json`, generated: json.generated };
  }

  function fromDir() {
    const records = loadPages(path.join(dir, 'content'), parse).map((r) => ({ ...r, sha: blobSha(r.source) }));
    const priceFile = path.join(dir, 'src/data/prices.json');
    const priceIds = existsSync(priceFile) ? new Set(Object.keys(JSON.parse(readFileSync(priceFile, 'utf8')))) : null;
    return { pages: complete(records, parse), priceIds, origin: path.resolve(dir), generated: new Date().toISOString() };
  }

  return {
    describe: () => (dir ? `local checkout at ${path.resolve(dir)}` : `${site}/api/wiki.json`),
    async load({ fresh = false } = {}) {
      if (!fresh && cached && Date.now() - at < ttlMs) return cached;
      cached = dir ? fromDir() : await fromSite();
      at = Date.now();
      return cached;
    },
  };
}
