#!/usr/bin/env node
// Maintain safety/denylist.json, the salted hashes of phrases that must never be published.
//
//   node scripts/denylist.mjs build <terms.txt>      rebuild from "kind: phrase" lines (keep that file OUT of the repo)
//   node scripts/denylist.mjs add <kind> "<phrase>"  hash one more phrase in (the plaintext never touches the repo)
//   node scripts/denylist.mjs test "<text>"          which kinds a text would trip, by line
//
// A phrase is matched as normalized words (lowercase ASCII, any punctuation as a break), so "Acme-Host", "acme host"
// and "ACME_HOST" are one phrase; "acmehost" is another, so add the run-together spelling too when it matters.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAX_WORDS, SALT, hashPhrase, loadDenyList, normalize, scanText } from '../lib/safety.mjs';

const FILE = fileURLToPath(new URL('../safety/denylist.json', import.meta.url));
const COMMENT =
  'Salted SHA-256 hashes of normalized phrases that must never appear on the wiki (scripts/denylist.mjs). ' +
  'They keep the phrases out of the tree and out of search; they are not secrets.';

const fail = (msg) => {
  console.error(`denylist: ${msg}`);
  process.exit(1);
};

function read() {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8'));
  } catch {
    return { $comment: COMMENT, salt: SALT, minimum: 1, hashes: {} };
  }
}

function write(file) {
  const total = Object.values(file.hashes).reduce((n, list) => n + list.length, 0);
  for (const kind of Object.keys(file.hashes)) file.hashes[kind] = [...new Set(file.hashes[kind])].sort();
  // Fewer hashes than this means the file was truncated or swapped: the lint then fails closed.
  file.minimum = Math.max(1, Math.floor(total * 0.9));
  writeFileSync(FILE, `${JSON.stringify({ $comment: COMMENT, salt: SALT, minimum: file.minimum, hashes: file.hashes }, null, 2)}\n`);
  console.log(`denylist: ${total} hashes in ${Object.keys(file.hashes).length} kinds -> safety/denylist.json`);
}

function check(kind, phrase) {
  if (!/^[a-z][a-z-]*$/.test(kind)) fail(`kind "${kind}" must be lowercase letters`);
  const words = normalize(phrase).split(' ').filter(Boolean);
  if (!words.length) fail('empty phrase');
  if (words.length > MAX_WORDS) fail(`a phrase is at most ${MAX_WORDS} words`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'build') {
  if (!args[0]) fail('usage: build <terms.txt>');
  const hashes = {};
  for (const [i, raw] of readFileSync(args[0], 'utf8').split('\n').entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([a-z][a-z-]*):\s*(.+)$/);
    if (!m) fail(`line ${i + 1}: expected "kind: phrase"`);
    check(m[1], m[2]);
    (hashes[m[1]] ??= []).push(hashPhrase(m[2]));
  }
  write({ hashes });
} else if (command === 'add') {
  const [kind, ...rest] = args;
  const phrase = rest.join(' ');
  check(kind ?? '', phrase);
  const file = read();
  (file.hashes[kind] ??= []).push(hashPhrase(phrase));
  write(file);
} else if (command === 'test') {
  const table = loadDenyList(FILE);
  const hits = scanText(args.join(' '), { table });
  if (!hits.length) console.log('clean');
  for (const h of hits) console.log(`line ${h.line}: ${h.rule}: ${h.shown}`);
  process.exit(hits.length ? 1 : 0);
} else {
  fail('usage: build <terms.txt> | add <kind> "<phrase>" | test "<text>"');
}
