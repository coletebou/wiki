// Wiki links: [[target]], [[target|label]], [[target#heading]], [[target#heading|label]] and [[#heading|label]].
// Shared by the site (remark plugin, backlinks), the content checks and the MCP server, so it imports nothing.
// Inside a Markdown table cell write the pipe escaped, [[target\|label]], as Markdown itself requires.

/** One wiki link anywhere in a source: target, optional heading anchor, optional label. */
export const WIKILINK = /\[\[([^\[\]\n|#\\]*?)(?:#([^\[\]\n|\\]+?))?(?:\\?\|([^\[\]\n]+?))?\]\]/g;
/** [[#heading]] links to a section of the same page: an empty target, an anchor. [[]] is not a link. */
export const isLink = (m) => Boolean(m[1].trim() || m[2]);

/**
 * GitHub-style heading slug, the way Astro makes heading ids (github-slugger): lowercase, drop everything that is not a
 * letter, mark, number, connector, space or hyphen, then each space becomes a hyphen.
 */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

/** A slugger that numbers repeats in one document (-1, -2, ...) exactly as github-slugger does. */
export function slugger() {
  const occurrences = new Map();
  return (text) => {
    const original = slugify(text);
    let result = original;
    while (occurrences.has(result)) {
      const n = occurrences.get(original) + 1;
      occurrences.set(original, n);
      result = `${original}-${n}`;
    }
    occurrences.set(result, 0);
    return result;
  };
}

const blank = (s) => s.replace(/[^\n]/g, ' ');

/** The text with fenced code blocks blanked out (same length, newlines kept). */
export function maskFences(text) {
  const lines = String(text).split('\n');
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      lines[i] = blank(line);
      continue;
    }
    const open = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (open) {
      fence = open[1];
      lines[i] = blank(line);
    }
  }
  return lines.join('\n');
}

/**
 * The text with fenced code blocks, inline code spans and MDX comments blanked out (same length, newlines kept), so
 * link scans skip code while offsets and line numbers still match the original.
 */
export function maskCode(text) {
  return maskFences(text)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
    .replace(/(`+)((?:(?!\n[ \t]*\n)[\s\S])*?[^`])\1(?!`)/g, blank);
}

/** The body after the frontmatter block, and how many lines the frontmatter took (to report file line numbers). */
export function bodyOf(source) {
  const text = String(source);
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { body: text, offset: 0 };
  return { body: text.slice(m[0].length), offset: m[0].split('\n').length - 1 };
}

/** Every wiki link in a body: { target, anchor, label, raw, index, line } (line is 1-based within the body). */
export function extractLinks(body) {
  const masked = maskCode(body);
  const links = [];
  for (const m of masked.matchAll(WIKILINK)) {
    if (!isLink(m)) continue;
    links.push({
      target: m[1].trim(),
      anchor: m[2]?.trim() || null,
      label: m[3]?.trim() || null,
      raw: m[0],
      index: m.index,
      line: masked.slice(0, m.index).split('\n').length,
    });
  }
  return links;
}

/**
 * Plain text of a Markdown heading, as the rendered heading reads (the text its id is made from). Inline code keeps its
 * text exactly, underscores and all; outside code, link syntax, tags and emphasis markers go.
 */
export function headingText(markdown) {
  const codes = [];
  const protectedText = String(markdown).replace(/(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g, (_, ticks, code) => {
    codes.push(/^ [\s\S]* $/.test(code) && code.trim() ? code.slice(1, -1) : code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  return protectedText
    .replace(WIKILINK, (_, target, anchor, label) => (label ?? target).trim())
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*|__|~~/g, '')
    .replace(/(^|[^\p{L}\p{N}])[*_]+(?=\S)|(?<=\S)[*_]+(?=[^\p{L}\p{N}]|$)/gu, '$1')
    .replace(/\\(.)/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)])
    .trim();
}

/** Headings of a body, in order: [{ depth, text, id }]. Inline code stays: its text is part of the heading's id. */
export function headingsOf(body) {
  const masked = maskFences(body).replace(/\{\/\*[\s\S]*?\*\/\}/g, blank);
  const slug = slugger();
  const out = [];
  for (const line of masked.split('\n')) {
    const m = line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/);
    if (!m) continue;
    const text = headingText(m[2]);
    out.push({ depth: m[1].length, text, id: slug(text) });
  }
  return out;
}

/** The key a link target is matched by, against slugs, titles and aliases alike. */
export const keyOf = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s_]+/g, ' ').trim();
