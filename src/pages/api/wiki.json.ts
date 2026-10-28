// The whole wiki as JSON, for the MCP server and any other reader: each page's frontmatter, its full source file,
// the git blob sha of that file (to detect a stale base when proposing an edit), headings, links and backlinks.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DIAGRAMS, TABLES } from '../../../lib/schema.mjs';
import { headingsOf } from '../../../lib/wikilinks.mjs';
import { wiki } from '../../lib/wiki';

const blobSha = (buf: Buffer) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

export async function GET() {
  const { pages, graph } = await wiki();
  const out = pages.map((p) => {
    const file = `content/${p.id}.mdx`;
    const buf = readFileSync(path.join(process.cwd(), file));
    return {
      slug: p.id,
      path: file,
      url: `https://wiki.coletebou.com/${p.id}/`,
      title: p.data.title,
      summary: p.data.summary,
      table: p.data.table,
      folio: p.data.folio,
      aliases: p.data.aliases,
      updated: p.data.updated.toISOString().slice(0, 10),
      sources: p.data.sources,
      sha: blobSha(buf),
      headings: headingsOf(p.body ?? '').map(({ depth, text, id }) => ({ depth, text, id })),
      links: [...new Set((graph.outlinks.get(p.id) ?? []).map((l: { to: string }) => l.to))],
      backlinks: graph.backlinks.get(p.id) ?? [],
      source: buf.toString('utf8'),
    };
  });
  const prices = JSON.parse(readFileSync(path.join(process.cwd(), 'src/data/prices.json'), 'utf8'));
  const body = {
    repo: { owner: 'coletebou', name: 'wiki', branch: 'master', contentDir: 'content' },
    generated: new Date().toISOString(),
    tables: TABLES,
    diagrams: DIAGRAMS,
    components: ['ColesTake', 'Price', 'Diagram'],
    priceIds: Object.keys(prices),
    pages: out,
  };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
