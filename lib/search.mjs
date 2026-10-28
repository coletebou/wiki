// Ranked full-text search over pages (BM25 across weighted fields), for the MCP server's `search` tool. Pure.
// The site itself searches with Pagefind in the browser; this gives agents the same library without one.
import { plainText } from './text.mjs';

const tokens = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]+(?:[.'][a-z0-9]+)*/g) ?? [];

const FIELDS = [
  ['title', 4],
  ['aliases', 3],
  ['summary', 2],
  ['headings', 1.6],
  ['text', 1],
];

/** @param {{ slug: string, title: string, summary: string, aliases?: string[], headings?: { text: string }[], body: string }[]} pages */
export function buildIndex(pages) {
  const docs = pages.map((p) => {
    const text = plainText(p.body);
    const fields = {
      title: tokens(p.title),
      aliases: tokens((p.aliases ?? []).join(' ')),
      summary: tokens(p.summary),
      headings: tokens((p.headings ?? []).map((h) => h.text).join(' ')),
      text: tokens(text),
    };
    const tf = Object.fromEntries(FIELDS.map(([f]) => [f, counts(fields[f])]));
    const len = Object.fromEntries(FIELDS.map(([f]) => [f, fields[f].length]));
    return { page: p, text, tf, len };
  });
  const avg = Object.fromEntries(FIELDS.map(([f]) => [f, docs.reduce((n, d) => n + d.len[f], 0) / Math.max(1, docs.length) || 1]));
  const df = new Map();
  for (const d of docs) {
    const seen = new Set(FIELDS.flatMap(([f]) => [...d.tf[f].keys()]));
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return { docs, avg, df, n: docs.length };
}

function counts(list) {
  const m = new Map();
  for (const t of list) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** Ranked results: [{ page, score, snippet }]. Prefix matching on the last term, so "worktr" finds worktrees. */
export function search(index, query, limit = 8) {
  const q = tokens(query);
  if (!q.length) return [];
  const k1 = 1.2;
  const b = 0.75;
  const vocab = [...index.df.keys()];
  const expand = (t, last) => (last && t.length >= 3 ? vocab.filter((v) => v.startsWith(t)) : [t]);
  const terms = q.flatMap((t, i) => expand(t, i === q.length - 1).map((v) => ({ v, exact: v === t })));
  const scored = [];
  for (const d of index.docs) {
    let score = 0;
    for (const { v, exact } of terms) {
      const df = index.df.get(v);
      if (!df) continue;
      const idf = Math.log(1 + (index.n - df + 0.5) / (df + 0.5));
      for (const [f, w] of FIELDS) {
        const tf = d.tf[f].get(v);
        if (!tf) continue;
        score += (exact ? 1 : 0.6) * w * idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * d.len[f]) / index.avg[f])));
      }
    }
    // Every query word present somewhere beats a page that only matches some of them.
    const all = q.every((t, i) => terms.some(({ v }) => (i === q.length - 1 ? v.startsWith(t) : v === t) && FIELDS.some(([f]) => d.tf[f].has(v))));
    if (score > 0) scored.push({ page: d.page, score: score * (all ? 1.5 : 1), snippet: snippet(d.text, q) });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, limit);
}

function snippet(text, q) {
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of q) {
    const i = lower.search(new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return text.slice(0, 200) + (text.length > 200 ? '…' : '');
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, at - 90)) + 1);
  const end = Math.min(text.length, text.indexOf(' ', at + 140) === -1 ? text.length : text.indexOf(' ', at + 140));
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
