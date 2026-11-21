// The feed of emendations (Atom): the thirty folios most lately emended, for a feed reader.
import { atomFeed } from '../../lib/feed.mjs';
import { folioLabel } from '../../lib/schema.mjs';
import { tableOf, wiki } from '../lib/wiki';

export async function GET({ site }: { site: URL }) {
  const { pages } = await wiki();
  const body = atomFeed(
    pages.map((p) => ({ slug: p.id, title: p.data.title, summary: p.data.summary, updated: p.data.updated, table: tableOf(p.data.table).title, folio: folioLabel(p.data.folio) })),
    { site: site.href, title: 'Codex Tebou: emendations', subtitle: 'The folios of Cole Tebou’s wiki most lately emended.', author: 'Cole Tebou' },
  );
  return new Response(body, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
