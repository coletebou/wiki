// propose_edit: turn an agent's change to one or more pages into a branch, one commit and a pull request labelled
// agent-edit, through the GitHub API with the caller's own token. Everything is validated here first, with the same
// rules CI applies (lib/validate.mjs), and nothing that fails the public-safety lint is ever sent to GitHub.
import { bodyOf } from '../lib/wikilinks.mjs';
import { scanText } from '../lib/safety.mjs';
import { SLUG, globalProblems, validatePages } from '../lib/validate.mjs';
import { blobSha } from './wiki-source.mjs';

export const LABEL = 'agent-edit';
const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w./-]+\))?!?: \S/;

export class ProposalError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

/** Apply find/replace edits to a text. Each `find` must occur exactly once, so an edit never lands in the wrong place. */
export function applyEdits(text, edits) {
  let out = text;
  edits.forEach(({ find, replace }, i) => {
    if (!find) throw new ProposalError(`edit ${i + 1}: "find" is empty`);
    const first = out.indexOf(find);
    if (first === -1) throw new ProposalError(`edit ${i + 1}: "find" text was not found in the page (read it again; it may have changed)`);
    if (out.indexOf(find, first + 1) !== -1) throw new ProposalError(`edit ${i + 1}: "find" text occurs more than once; include more context so it is unique`);
    out = out.slice(0, first) + replace + out.slice(first + find.length);
  });
  return out;
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

/**
 * @param {object} o
 * @param {{ title?: string, summary: string, changes: { slug: string, content?: string, edits?: { find: string, replace: string }[], create?: boolean, base_sha?: string }[], dry_run?: boolean }} o.input
 * @param {{ load: (o?: object) => Promise<{ pages: any[], priceIds: Set<string> | null }> }} o.source
 * @param {{ request: (method: string, route: string, body?: object) => Promise<any> } | null} o.github
 * @param {(s: string) => { data: object }} o.parse
 * @param {Map<string, string>} o.table
 * @param {(body: string) => object} [o.parseMdx]  MDX parser; throws on a syntax error
 * @param {{ owner: string, name: string, branch: string }} o.repo
 * @param {() => Date} [o.now]
 */
export async function proposeEdit({ input, source, github, parse, table, parseMdx, repo, now = () => new Date() }) {
  const changes = input.changes ?? [];
  if (!changes.length) throw new ProposalError('nothing to propose: give at least one change');
  if (changes.length > 10) throw new ProposalError('at most 10 pages per proposal; split it');
  const seen = new Set();
  for (const c of changes) {
    if (!SLUG.test(c.slug ?? '')) throw new ProposalError(`"${c.slug}" is not a page slug (lowercase words joined by hyphens)`);
    if (seen.has(c.slug)) throw new ProposalError(`"${c.slug}" appears twice; combine its edits into one change`);
    seen.add(c.slug);
    if ((c.content === undefined) === !c.edits?.length) throw new ProposalError(`${c.slug}: give either "content" (the whole new file) or "edits", not both or neither`);
    if (c.create && c.content === undefined) throw new ProposalError(`${c.slug}: a new page needs "content"`);
  }
  // A slug becomes a file path, a branch name and a line of the pull request: it is published before CI runs.
  const slugHits = scanText(changes.map((c) => c.slug).join('\n'), { table });
  if (slugHits.length) throw new ProposalError('a page slug would publish something private', slugHits.map((h) => `${h.rule}: ${h.shown}`));
  const summary = String(input.summary ?? '').trim();
  if (summary.length < 10) throw new ProposalError('"summary" must say what the change does and why (it becomes the pull request description)');

  const { pages, priceIds } = await source.load({ fresh: true });
  const bySlug = new Map(pages.map((p) => [p.slug, p]));

  // The base each change applies to: the page on the default branch as it is right now.
  const base = { commit: null, tree: null };
  if (github) {
    const ref = await github.request('GET', `/repos/${repo.owner}/${repo.name}/git/ref/heads/${repo.branch}`);
    base.commit = ref.object.sha;
    base.tree = (await github.request('GET', `/repos/${repo.owner}/${repo.name}/git/commits/${base.commit}`)).tree.sha;
  }
  const current = new Map();
  for (const c of changes) {
    const file = `content/${c.slug}.mdx`;
    let text = null;
    let sha = null;
    if (github) {
      try {
        const got = await github.request('GET', `/repos/${repo.owner}/${repo.name}/contents/${encodePath(file)}?ref=${base.commit}`);
        text = Buffer.from(got.content, 'base64').toString('utf8');
        sha = got.sha;
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    } else if (bySlug.has(c.slug)) {
      text = bySlug.get(c.slug).source;
      sha = blobSha(text);
    }
    if (c.create && text !== null) throw new ProposalError(`${c.slug}: that page already exists; edit it instead of creating it`);
    if (!c.create && text === null) throw new ProposalError(`${c.slug}: no such page; set "create": true to add a new one`);
    if (c.base_sha && sha && c.base_sha !== sha) {
      throw new ProposalError(`${c.slug}: the page changed since you read it (you read ${c.base_sha.slice(0, 7)}, it is now ${sha.slice(0, 7)}); read it again and redo the edit`);
    }
    current.set(c.slug, { file, text, sha });
  }

  // The wiki as it would be after the change, validated as CI will validate it.
  const next = new Map(pages.map((p) => [p.slug, p]));
  const files = [];
  for (const c of changes) {
    const { file, text } = current.get(c.slug);
    let updated = c.content !== undefined ? String(c.content) : applyEdits(text, c.edits);
    if (!updated.endsWith('\n')) updated += '\n';
    if (updated === text) throw new ProposalError(`${c.slug}: the change leaves the page exactly as it is`);
    let data = {};
    let error = null;
    try {
      data = parse(updated).data ?? {};
    } catch (e) {
      error = e;
    }
    const { body, offset } = bodyOf(updated);
    next.set(c.slug, { slug: c.slug, file: `${c.slug}.mdx`, source: updated, data, body, offset, error });
    files.push({ slug: c.slug, path: file, content: updated, created: Boolean(c.create) });
  }
  // Every rule on the changed pages, and wiki-wide rules on every page: removing a heading another page links to, or
  // reusing a folio, breaks that other page. Problems an unchanged page already had are not this change's to fix.
  const changed = changes.map((c) => c.slug);
  const problems = await validatePages({ pages: [...next.values()], targets: changed, priceIds, table, parseMdx, global: 'all' });
  const before = new Set(globalProblems(pages).map((g) => `${g.slug}\u0000${g.msg}`));
  for (const [slug, list] of problems) {
    const kept = changed.includes(slug) ? list : list.filter((p) => !before.has(`${slug}\u0000${p.msg}`));
    if (kept.length) problems.set(slug, kept);
    else problems.delete(slug);
  }
  if (problems.size) {
    const list = [...problems].flatMap(([slug, ps]) => ps.map((p) => `content/${slug}.mdx:${p.line}: ${p.msg}`));
    throw new ProposalError(`the change does not pass the wiki's checks (${list.length} problem${list.length === 1 ? '' : 's'}); fix them and propose again`, list);
  }

  const scope = changes.length === 1 ? changes[0].slug : 'content';
  const firstLine = summary.split('\n')[0].replace(/\.$/, '');
  let title = String(input.title ?? '').trim() || `docs(${scope}): ${firstLine.charAt(0).toLowerCase()}${firstLine.slice(1)}`;
  if (!CONVENTIONAL.test(title)) title = `docs(${scope}): ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
  if (title.length > 100) title = `${title.slice(0, 97)}...`;
  const body = [summary, '', ...files.map((f) => `- \`${f.path}\` ${f.created ? '(new page)' : `(base ${current.get(f.slug).sha.slice(0, 7)})`}`)].join('\n');
  const meta = [...scanText(title, { table }), ...scanText(body, { table })];
  if (meta.length) throw new ProposalError('the pull request title or summary would publish something private', meta.map((h) => `${h.rule}: ${h.shown}`));

  const stamp = now().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
  const branch = `agent-edit/${changes.map((c) => c.slug).join('+').slice(0, 48)}-${stamp}`;
  if (input.dry_run || !github) {
    return { dry_run: true, title, body, branch, files: files.map(({ path, created }) => ({ path, created })) };
  }

  const me = await github.request('GET', '/user');
  const identity = { name: me.name || me.login, email: `${me.id}+${me.login}@users.noreply.github.com` };
  const blobs = await Promise.all(
    files.map((f) => github.request('POST', `/repos/${repo.owner}/${repo.name}/git/blobs`, { content: f.content, encoding: 'utf-8' })),
  );
  const tree = await github.request('POST', `/repos/${repo.owner}/${repo.name}/git/trees`, {
    base_tree: base.tree,
    tree: files.map((f, i) => ({ path: f.path, mode: '100644', type: 'blob', sha: blobs[i].sha })),
  });
  const when = now().toISOString();
  const commit = await github.request('POST', `/repos/${repo.owner}/${repo.name}/git/commits`, {
    message: `${title}\n\n${summary}\n`,
    tree: tree.sha,
    parents: [base.commit],
    author: { ...identity, date: when },
    committer: { ...identity, date: when },
  });
  await github.request('POST', `/repos/${repo.owner}/${repo.name}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
  const pr = await github.request('POST', `/repos/${repo.owner}/${repo.name}/pulls`, { title, head: branch, base: repo.branch, body, maintainer_can_modify: true });
  await github.request('POST', `/repos/${repo.owner}/${repo.name}/issues/${pr.number}/labels`, { labels: [LABEL] });
  return {
    pull_request: pr.html_url,
    number: pr.number,
    branch,
    commit: commit.sha,
    author: identity.name,
    files: files.map(({ path, created }) => ({ path, created })),
    next: `Checks run now (build, links, gitleaks, public-safety). An ${LABEL} pull request opened by the repository owner from a branch of the repository is squash-merged automatically when they pass, and the site redeploys; any other waits for review.`,
  };
}
