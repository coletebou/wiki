#!/usr/bin/env node
// Public-safety lint (rules in lib/safety.mjs). Fails when anything that must stay private would be published.
//
//   node scripts/safety-lint.mjs                 every tracked text file
//   node scripts/safety-lint.mjs a.mdx b.md      just these files
//   node scripts/safety-lint.mjs --dist dist     also every text file of the built site
//   node scripts/safety-lint.mjs --pr            also the pull request's title, body and commit messages (in CI)
//
// Findings are masked and deny-listed phrases are never printed: a public repository's CI logs are public too.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDenyList, scanText } from '../lib/safety.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const table = loadDenyList(path.join(ROOT, 'safety/denylist.json'));
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf|zip|gz|wasm|mp4|mp3|pf_[a-z]+)$/i;
// Hash lists and lockfiles: machine-written, never rendered, and full of strings that only look like findings.
const SKIP = new Set(['safety/denylist.json', 'package-lock.json', 'mcp/package-lock.json']);
const inCI = Boolean(process.env.GITHUB_ACTIONS);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const value = args[i + 1];
  args.splice(i, value && !value.startsWith('--') ? 2 : 1);
  return value && !value.startsWith('--') ? value : true;
};
const distDir = flag('--dist');
const pr = flag('--pr');

function tracked() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch {
    const out = [];
    const walk = (dir) => {
      for (const name of readdirSync(path.join(ROOT, dir))) {
        if (['node_modules', 'dist', '.git', '.astro', '.vercel'].includes(name)) continue;
        const rel = dir ? `${dir}/${name}` : name;
        if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel);
        else out.push(rel);
      }
    };
    walk('');
    return out;
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const findings = [];
const check = (label, text, file) => {
  for (const hit of scanText(text, { table })) findings.push({ label, file, ...hit });
};

const files = args.length ? args : tracked();
// File names are published too: a page's slug is its path, its URL and its branch.
if (!args.length) check('file paths', files.join('\n'), null);
for (const rel of files) {
  const norm = rel.replace(/\\/g, '/').replace(/^\.\//, '');
  if (SKIP.has(norm) || BINARY.test(norm)) continue;
  const abs = path.resolve(ROOT, norm);
  if (!existsSync(abs) || !statSync(abs).isFile()) continue;
  check(norm, readFileSync(abs, 'utf8'), norm);
}

if (distDir) {
  const dist = path.resolve(ROOT, distDir === true ? 'dist' : distDir);
  if (!existsSync(dist)) {
    console.error(`safety-lint: ${dist} does not exist; build the site first`);
    process.exit(2);
  }
  for (const f of walk(dist)) {
    if (BINARY.test(f)) continue;
    check(`dist/${path.relative(dist, f)}`, readFileSync(f, 'utf8'), null);
  }
}

if (pr) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const event = eventPath && existsSync(eventPath) ? JSON.parse(readFileSync(eventPath, 'utf8')) : null;
  const p = event?.pull_request;
  if (p) {
    check('pull request title', p.title ?? '', null);
    check('pull request body', p.body ?? '', null);
    check('pull request branch', p.head?.ref ?? '', null);
    try {
      const log = execFileSync('git', ['log', '--format=%H%n%an <%ae>%n%B%n', `${p.base.sha}..${p.head.sha}`], { cwd: ROOT, encoding: 'utf8' });
      // Commit identities are checked against the rules too, except the noreply addresses GitHub itself assigns.
      check('commit messages', log, null);
    } catch (error) {
      console.error(`safety-lint: could not read the pull request's commits (${error.message.split('\n')[0]}); fetch-depth 0 is needed`);
      process.exit(2);
    }
  } else if (inCI) {
    console.log('safety-lint: not a pull request event; skipping title, body and commit checks');
  }
}

for (const f of findings) {
  const where = f.file ? `${f.file}:${f.line}` : `${f.label}, line ${f.line}`;
  console.log(`${where}: ${f.rule}: ${f.shown}`);
  if (inCI) {
    const loc = f.file ? `file=${f.file},line=${f.line},` : '';
    console.log(`::error ${loc}title=public-safety (${f.rule})::${f.shown} in ${f.label}`);
  }
}
if (findings.length) {
  console.log(`\npublic-safety: ${findings.length} finding${findings.length === 1 ? '' : 's'}. Nothing private may be published: see lib/safety.mjs and the wiki's "public-safety rules".`);
  process.exit(1);
}
console.log('public-safety: ok');
