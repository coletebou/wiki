// Frontmatter as Astro reads it, from the MCP package's own dependencies (identical to lib/frontmatter.mjs, which the
// site and the checks use): a block between two `---` lines, parsed by the `yaml` package, nothing else. No
// `---js` or other language after the opening fence, which some frontmatter libraries evaluate as code.
import YAML from 'yaml';

const FENCE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** @param {string} source  @returns {{ data: Record<string, any>, content: string }} */
export function parseFrontmatter(source) {
  const text = String(source).replace(/^\uFEFF/, '');
  const m = text.match(FENCE);
  if (!m) return { data: {}, content: text };
  const data = m[1].trim() ? YAML.parse(m[1]) : {};
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('frontmatter must be a mapping of keys to values');
  return { data, content: text.slice(m[0].length) };
}
