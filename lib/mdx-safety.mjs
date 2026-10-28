// The part of MDX a page may use. MDX can carry code: `{expressions}` and `export`s run when the site builds, and a
// raw `<script>` or an `onclick` would ship to readers. Pages merge automatically, so a page is data, never code: only
// MDX comments, the wiki's three components with plain-string attributes, a short list of inline HTML elements, links
// to the web or within the site, and images served by the site itself.
// Checked by lib/validate.mjs (CI and the MCP server) and by the build's own Markdown plugin. Pure.

export const COMPONENT_ATTRS = { ColesTake: [], Price: ['id', 'format'], Diagram: ['name', 'scene'] };
export const HTML_ATTRS = {
  kbd: [], abbr: ['title'], sub: [], sup: [], small: [], br: [], mark: [], s: [], del: [], ins: [], u: [], b: [], i: [],
  em: [], strong: [], code: [], span: [], details: ['open'], summary: [], dl: [], dt: [], dd: [],
};
/** True only when an expression is nothing but block comments: remove each one, nothing may be left. */
const onlyComments = (value) => String(value ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim() === '' && /\/\*/.test(String(value ?? ''));
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

const urlProblem = (url, image) => {
  const u = String(url ?? '').trim();
  const scheme = u.match(SCHEME)?.[1]?.toLowerCase();
  if (image) {
    if (scheme || u.startsWith('//')) return 'images must be files this site serves (a path starting with /), not from another site';
    return null;
  }
  if (scheme && !['http', 'https', 'mailto'].includes(scheme)) return `links may not use the ${scheme}: scheme`;
  return null;
};

/** What is wrong with one MDX node, or null. Works on mdast from @mdx-js/mdx and from Sätteri alike. */
export function nodeProblem(node) {
  switch (node.type) {
    case 'mdxjsEsm':
      return 'no import or export in a page: components are provided by the layout';
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
      return onlyComments(node.value) ? null : 'no JavaScript expressions in a page; only {/* comments */}';
    case 'mdxJsxFlowElement':
    case 'mdxJsxTextElement': {
      const name = node.name;
      if (!name) return 'no JSX fragments (<>...</>) in a page';
      const allowed = COMPONENT_ATTRS[name] ?? HTML_ATTRS[name];
      if (!allowed) return /^[A-Z]/.test(name) ? `unknown component <${name}> (available: ${Object.keys(COMPONENT_ATTRS).join(', ')})` : `the <${name}> element is not allowed in a page`;
      for (const attr of node.attributes ?? []) {
        if (attr.type !== 'mdxJsxAttribute') return `<${name}> may not spread attributes`;
        if (!allowed.includes(attr.name)) return `<${name}> may not have a ${attr.name} attribute`;
        if (attr.value !== null && attr.value !== undefined && typeof attr.value !== 'string') return `<${name} ${attr.name}> must be a plain string, not an expression`;
      }
      return null;
    }
    case 'html':
      return 'no raw HTML in a page';
    case 'link':
    case 'definition':
      return urlProblem(node.url, false);
    case 'image':
      return urlProblem(node.url, true);
    case 'imageReference':
      return 'write images inline, ![alt](/path), not as references';
    default:
      return null;
  }
}

/** Every problem in an MDX tree: [{ line, msg }], line 1-based within the text parsed. */
export function mdxProblems(tree) {
  const out = [];
  const walk = (node) => {
    const msg = nodeProblem(node);
    if (msg) out.push({ line: node.position?.start?.line ?? 1, msg });
    for (const child of node.children ?? []) walk(child);
  };
  walk(tree);
  return out;
}
