// Read every page in content/ into { slug, file, source, data, body, offset } records. Node only. The frontmatter
// parser is passed in (lib/frontmatter.mjs or the MCP's copy), so each caller resolves `yaml` from its own dependencies.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { bodyOf } from './wikilinks.mjs';

export const PAGE_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.mdx$/;

/** Page files in a content directory, sorted. */
export const pageFiles = (dir) => readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort();

/** A cheap signature of the directory (names, sizes and modification times), to know when to re-read it. */
export function signature(dir) {
  return pageFiles(dir)
    .map((f) => {
      const s = statSync(path.join(dir, f));
      return `${f}:${s.size}:${s.mtimeMs}`;
    })
    .join('|');
}

/**
 * @param {string} dir
 * @param {(source: string) => { data: Record<string, any> }} parse  frontmatter parser (parseFrontmatter)
 */
export function loadPages(dir, parse) {
  return pageFiles(dir).map((file) => {
    const source = readFileSync(path.join(dir, file), 'utf8');
    let data = {};
    let error = null;
    try {
      data = parse(source).data ?? {};
    } catch (e) {
      error = e;
    }
    const { body, offset } = bodyOf(source);
    return { slug: file.replace(/\.mdx$/, ''), file, source, data, body, offset, error };
  });
}
