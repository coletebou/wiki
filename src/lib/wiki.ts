// Everything the pages need about the wiki as a whole, computed once per build from the content collection.
import { getCollection, type CollectionEntry } from 'astro:content';
import { buildGraph } from '../../lib/graph.mjs';
import { TABLES } from '../../lib/schema.mjs';
import { headingsOf } from '../../lib/wikilinks.mjs';

export type Page = CollectionEntry<'pages'>;
export type Table = (typeof TABLES)[number];

export interface Wiki {
  pages: Page[];
  bySlug: Map<string, Page>;
  graph: ReturnType<typeof buildGraph>;
  tables: (Table & { pages: Page[] })[];
}

let cached: Promise<Wiki> | null = null;

export function wiki(): Promise<Wiki> {
  cached ??= (async () => {
    const pages = (await getCollection('pages')).sort((a, b) => a.data.folio - b.data.folio);
    const bySlug = new Map(pages.map((p) => [p.id, p]));
    const graph = buildGraph(pages.map((p) => ({ slug: p.id, data: p.data, body: p.body ?? '' })));
    const tables = TABLES.map((t) => ({ ...t, pages: pages.filter((p) => p.data.table === t.id) }));
    return { pages, bySlug, graph, tables };
  })();
  return cached;
}

export const tableOf = (id: string) => TABLES.find((t) => t.id === id)!;
export const href = (slug: string) => `/${slug}/`;

export { incipit, plainText, stichoi, wordCount } from '../../lib/text.mjs';

export function headings(page: Page) {
  return headingsOf(page.body ?? '').filter((h) => h.depth === 2 || h.depth === 3);
}

/** The data a hover preview shows for each page, keyed by slug. */
export async function previews() {
  const { pages } = await wiki();
  return Object.fromEntries(
    pages.map((p) => {
      const t = tableOf(p.data.table);
      return [
        p.id,
        {
          t: p.data.title,
          s: p.data.summary,
          f: p.data.folio,
          n: t.numeral,
          tb: t.title,
          h: Object.fromEntries(headingsOf(p.body ?? '').map((h) => [h.id, h.text])),
        },
      ];
    }),
  );
}

/** Roman numerals for folio ornaments. */
export function roman(n: number): string {
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}
