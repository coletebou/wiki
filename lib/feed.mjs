// The feed of emendations: an Atom document listing the folios most lately emended, so that a reader's feed reader
// can say when the library has changed. Pure: it is given the folios and returns the document.

const escape = (/** @type {string} */ s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {{ slug: string, title: string, summary: string, updated: Date, table: string, folio: string }[]} folios
 * @param {{ site: string, title: string, subtitle: string, author: string, limit?: number }} about
 *   `site` is the site's address, ending in a slash
 */
export function atomFeed(folios, { site, title, subtitle, author, limit = 30 }) {
  const latest = [...folios].sort((a, b) => b.updated.valueOf() - a.updated.valueOf() || a.slug.localeCompare(b.slug)).slice(0, limit);
  // A feed with nothing in it still has a date: the epoch says "never" without lying about today.
  const when = (latest[0]?.updated ?? new Date(0)).toISOString();
  const entries = latest
    .map(
      (f) => `  <entry>
    <title>${escape(f.title)}</title>
    <link href="${escape(`${site}${f.slug}/`)}"/>
    <id>${escape(`${site}${f.slug}/`)}</id>
    <updated>${f.updated.toISOString()}</updated>
    <summary>${escape(f.summary)}</summary>
    <category term="${escape(f.table)}"/>
  </entry>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escape(title)}</title>
  <subtitle>${escape(subtitle)}</subtitle>
  <link href="${escape(site)}"/>
  <link rel="self" href="${escape(`${site}emendations.xml`)}"/>
  <id>${escape(site)}</id>
  <updated>${when}</updated>
  <author><name>${escape(author)}</name></author>
${entries}
</feed>
`;
}
