// Public-safety lint: what must never be published on this wiki, checked in every pull request, in the built site and
// by the MCP server before it opens a pull request. Imports only node built-ins.
//
// Two kinds of rule:
// - A deny-list of phrases (host names and the like), committed only as salted SHA-256 hashes in
//   safety/denylist.json, so the check can prove a phrase is absent without the phrase itself being committed. The
//   hashes keep the phrases out of the tree and out of search; they are not secrets.
// - Generic shapes (tailnet addresses, Tailscale IPs, phone numbers, emails, secrets, home directories, wallet
//   addresses), as regular expressions.
// Findings never echo a deny-listed phrase and only show masked matches, because CI logs of a public repo are public.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isIPv6 } from 'node:net';

export const SALT = 'coletebou/wiki:denylist:v1';
/** Longest phrase, in words, the deny-list scanner compares. */
export const MAX_WORDS = 4;

/** Lowercase ASCII words: "Acme-Host", "acme host" and "ACME_HOST" all normalize to "acme host". */
export const normalize = (text) =>
  String(text)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const hashPhrase = (phrase, salt = SALT) =>
  createHash('sha256').update(`${salt}\n${normalize(phrase)}`).digest('hex');

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '\u00ad', hyphen: '-', dash: '-', period: '.', commat: '@', sol: '/', lowbar: '_', colon: ':', ndash: '\u2013', mdash: '\u2014', zwsp: '\u200b', zwj: '\u200d', zwnj: '\u200c' };
const fromCode = (code) => (code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd');
const UTF8 = new TextDecoder('utf-8');
const decodeUrlRun = (run) => UTF8.decode(Uint8Array.from(run.match(/%[0-9a-f]{2}/gi) ?? [], (p) => Number.parseInt(p.slice(1), 16)));

/**
 * Undo the encodings a page can wrap text in, so an encoded phrase is caught as surely as a plain one: HTML character
 * references, JavaScript escapes and URL escapes, then invisible format characters (soft hyphens, zero-width spaces and
 * joiners, direction marks) dropped, or with `breaks`, a zero-width space read as the word break it allows.
 */
export function decode(text, breaks = false) {
  return String(text)
    .replace(/&(?:#x([0-9a-f]+);?|#(\d+);?|([a-z][a-z0-9]*);)/gi, (m, hex, dec, name) =>
      hex !== undefined ? fromCode(Number.parseInt(hex, 16)) : dec !== undefined ? fromCode(Number(dec)) : (NAMED[name.toLowerCase()] ?? m),
    )
    .replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi, (_, braced, four, two) => fromCode(Number.parseInt(braced ?? four ?? two, 16)))
    .replace(/(?:%[0-9a-f]{2})+/gi, decodeUrlRun)
    .replace(/\u200b/g, breaks ? ' ' : '')
    .replace(/\p{Cf}/gu, '');
}

/** Load safety/denylist.json into a hash -> kind table. Fails closed on anything malformed or truncated. */
export function loadDenyList(path) {
  let file;
  try {
    file = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`deny-list unreadable at ${path}: ${error.message}`);
  }
  if (file?.salt !== SALT) throw new Error(`deny-list salt is ${JSON.stringify(file?.salt)}, expected ${JSON.stringify(SALT)}`);
  if (!Number.isInteger(file.minimum) || file.minimum < 1) throw new Error('deny-list minimum must be a positive whole number');
  const table = new Map();
  for (const [kind, hashes] of Object.entries(file.hashes ?? {})) {
    if (!Array.isArray(hashes)) throw new Error(`deny-list ${kind} is not a list`);
    for (const h of hashes) {
      if (!/^[0-9a-f]{64}$/.test(h)) throw new Error(`deny-list has a malformed ${kind} hash`);
      table.set(h, kind);
    }
  }
  if (table.size < file.minimum) throw new Error(`deny-list holds ${table.size} hashes, below its minimum of ${file.minimum}`);
  return table;
}

/** Words with the line each starts on; words carry across line breaks so a phrase split over two lines is caught. */
function words(text) {
  const out = [];
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const w of normalize(lines[i]).split(' ')) if (w) out.push({ w, line: i + 1 });
  }
  return out;
}

function scanDeny(text, table, salt) {
  const hits = [];
  const ws = words(text);
  for (let i = 0; i < ws.length; i++) {
    let phrase = '';
    for (let n = 1; n <= MAX_WORDS && i + n <= ws.length; n++) {
      phrase = n === 1 ? ws[i].w : `${phrase} ${ws[i + n - 1].w}`;
      const kind = table.get(createHash('sha256').update(`${salt}\n${phrase}`).digest('hex'));
      if (kind) hits.push({ rule: `denylist:${kind}`, line: ws[i].line, shown: `${n}-word ${kind} phrase (hashed deny-list)` });
    }
  }
  return hits;
}

// ── Shapes ────────────────────────────────────────────────────────────────────────────────────────────────────────

const octets = (s) => s.split('.').map(Number);
const ipAllowed = (ip) => {
  const [a, b, c, d] = octets(ip);
  if ([a, b, c, d].some((o) => o > 255)) return true; // not an address (a version string or the like)
  if (a === 0 || a === 127 || a === 10 || a >= 224) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return true; // RFC 5737
  // Well-known public service addresses that identify nobody: public DNS resolvers, Vercel's documented apex record,
  // Tailscale's MagicDNS resolver.
  return ['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4', '9.9.9.9', '76.76.21.21', '100.100.100.100'].includes(ip);
};
/** True when ip/bits names a network (host bits all zero, fewer than 32 bits): a documented range, not a machine. */
const isNetwork = (ip, bits) => {
  if (bits === undefined || bits >= 32 || bits < 0) return false;
  const n = octets(ip).reduce((acc, o) => acc * 256 + o, 0);
  const host = 2 ** (32 - bits);
  return n % host === 0;
};
const isCgnat = (ip) => {
  const [a, b] = octets(ip);
  return a === 100 && b >= 64 && b <= 127;
};
const EMAIL_OK = [/@example\.(com|org|net)$/i, /@[a-z0-9.-]+\.example$/i, /^git@(github|gitlab)\.com$/i, /@users\.noreply\.github\.com$/i, /^noreply@github\.com$/i];
// A retina asset (logo@2x.png) or a versioned file looks like an address but is not one.
const FILE_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|js|mjs|cjs|ts|tsx|jsx|css|json|md|mdx|html?|woff2?|ttf|otf)$/i;
const TAILNET_OK = /^(example|your-tailnet|tailnet-name|yourtailnet|tail0000)\.ts\.net$/i;
const HOME_OK = /^(you|user|username|me|example|runner|shared|name|yourname|your-user|\$\{?user\}?|\$\{?home\}?)$/i;
const digits = (s) => s.replace(/\D/g, '');

// An IPv4 address, not part of a longer dotted number, optionally with /bits. A sentence may end right after it.
const IPV4 = /(?<!\d|\d\.)((?:\d{1,3}\.){3}\d{1,3})(?!\d|\.\d)(?:\/(\d{1,2})(?!\d))?/g;
function ipHits(line) {
  const out = [];
  for (const m of line.matchAll(IPV4)) {
    const [whole, ip, bits] = m;
    if (octets(ip).some((o) => o > 255) || isNetwork(ip, bits === undefined ? undefined : Number(bits))) continue;
    if (isCgnat(ip) && ip !== '100.100.100.100') out.push(['ip:tailscale', 'a Tailscale (100.64.0.0/10) address', whole]);
    else if (!isCgnat(ip) && !ipAllowed(ip)) out.push(['ip:public', 'a public IP address', whole]);
  }
  return out;
}

// IPv6: a candidate is checked by node's own parser, then only global unicast (2000::/3) counts, outside the
// documentation range (2001:db8::/32). Loopback, link-local, unique-local and multicast identify no public machine;
// Tailscale's unique-local range is its own rule. Up to eight colons: a:b:c:d:e:f:g:: is a valid address.
const IPV6 = /(?<![\w:.])(?:[0-9a-f]{0,4}:){2,8}[0-9a-f]{0,4}(?:\/\d{1,3})?(?![\w:])/gi;
/** A valid IPv6 address (no zone, no dotted tail: the candidate pattern has neither) as a 128-bit number. */
function ipv6Value(addr) {
  const [head, tail] = addr.split('::');
  const groups = (s) => (s ? s.split(':') : []);
  const all = tail === undefined ? groups(head) : [...groups(head), ...Array(8 - groups(head).length - groups(tail).length).fill('0'), ...groups(tail)];
  return all.reduce((n, g) => (n << 16n) | BigInt(Number.parseInt(g || '0', 16)), 0n);
}
function ipv6Hits(line) {
  const out = [];
  for (const m of line.matchAll(IPV6)) {
    const [addr, bits] = m[0].split('/');
    if (!isIPv6(addr)) continue;
    const first = Number.parseInt(addr.split(':')[0] || '0', 16);
    const global = first >= 0x2000 && first <= 0x3fff;
    if (!global || /^2001:0?db8:/i.test(addr)) continue;
    // A network written with its prefix length (shorter than /64, host bits all zero) is a range, not a machine. A host
    // address followed by its prefix length (2001:db8::1/48, were it not documentation) still names the host.
    const b = bits === undefined ? null : Number(bits);
    if (b !== null && b < 64 && (ipv6Value(addr) & ((1n << BigInt(128 - b)) - 1n)) === 0n) continue;
    out.push(['ip:public6', 'a public IPv6 address', m[0]]);
  }
  return out;
}

// Base58Check (legacy Bitcoin addresses, 1... and 3...): only strings whose checksum holds count, so random
// identifiers that merely look the part are left alone.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58check(s) {
  let n = 0n;
  for (const ch of s) {
    const v = B58.indexOf(ch);
    if (v < 0) return false;
    n = n * 58n + BigInt(v);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const lead = s.match(/^1*/)[0].length;
  const bytes = Buffer.concat([Buffer.alloc(lead), Buffer.from(hex === '00' ? '' : hex, 'hex')]);
  if (bytes.length !== 25) return false;
  const sum = createHash('sha256').update(createHash('sha256').update(bytes.subarray(0, 21)).digest()).digest();
  return sum.subarray(0, 4).equals(bytes.subarray(21));
}

/** [rule, regex, message, keep(match) -> boolean] */
const SHAPES = [
  ['tailnet', /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:ts\.net|beta\.tailscale\.net)\b/gi, 'a tailnet address', (m) => !TAILNET_OK.test(m)],
  ['ip:tailscale6', /\bfd7a:115c:a1e0(?::[0-9a-f]{0,4}){1,5}/gi, 'a Tailscale IPv6 address', () => true],
  ['phone:e164', /(?<![\w+])\+[1-9][\d\s().-]{8,18}\d(?!\d)/g, 'a phone number', (m) => digits(m).length >= 10 && digits(m).length <= 15 && !/55501\d\d$/.test(digits(m))],
  ['phone:nanp', /(?<!\d|\d[.-])[2-9]\d{2}([.-])[2-9]\d{2}\1\d{4}(?!\d|[.-]\d)/g, 'a phone number', (m) => !/555[.-]01\d\d$/.test(m)],
  ['phone:nanp', /\(\s?[2-9]\d{2}\s?\)\s?[2-9]\d{2}[\s.-]\d{4}(?!\d)/g, 'a phone number', (m) => !/555[\s.-]01\d\d$/.test(m)],
  ['phone:tel', /\btel:\+?[\d\s().-]{7,}/gi, 'a tel: link', () => true],
  ['email', /\b[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi, 'an email address', (m) => !EMAIL_OK.some((re) => re.test(m)) && !FILE_EXT.test(m)],
  ['secret:aws', /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g, 'an AWS access key id', () => true],
  ['secret:github', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g, 'a GitHub token', () => true],
  ['secret:anthropic', /\bsk-ant-[A-Za-z0-9_-]{20,}/g, 'an Anthropic key', () => true],
  ['secret:openai', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/g, 'an API secret key', () => true],
  ['secret:stripe', /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/g, 'a Stripe key', () => true],
  ['secret:slack', /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, 'a Slack token', () => true],
  ['secret:google', /\bAIza[0-9A-Za-z_-]{35}\b/g, 'a Google API key', () => true],
  ['secret:tailscale', /\btskey-[a-z]+-[A-Za-z0-9-]{8,}/g, 'a Tailscale key', () => true],
  ['secret:langfuse', /\b[ps]k-lf-[0-9a-f-]{20,}/gi, 'a Langfuse key', () => true],
  ['secret:sentry-dsn', /https?:\/\/[0-9a-f]{32}@[a-z0-9.-]*sentry\.io\/\d+/gi, 'a Sentry DSN', () => true],
  ['secret:private-key', /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY(?: BLOCK)?-----/g, 'a private key block', () => true],
  ['secret:jwt', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, 'a JWT', () => true],
  ['secret:assignment', /\b[A-Z0-9_]*(?:API_?KEY|TOKEN|SECRET|PASSWORD|PASSWD)[A-Z0-9_]*\s*[:=]\s*['"]?([A-Za-z0-9+/_-]{24,})/gi, 'a credential value', (m) => /\d/.test(m.split(/[:=]/).slice(1).join('')) && /[A-Za-z]/.test(m.split(/[:=]/).slice(1).join(''))],
  ['secret:xprv', /\b[xyzt]prv[1-9A-HJ-NP-Za-km-z]{100,}/g, 'a wallet private key', () => true],
  ['wallet:btc', /\bbc1[ac-hj-np-z02-9]{25,87}\b/g, 'a Bitcoin address', () => true],
  ['wallet:btc-legacy', /\b[13][1-9A-HJ-NP-Za-km-z]{25,34}\b/g, 'a Bitcoin address', (m) => base58check(m)],
  ['wallet:xmr', /\b[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}\b/g, 'a Monero address', () => true],
  ['path:home', /(?:\/home|\/Users)\/([A-Za-z0-9._${}-]+)/g, 'a home directory with a user name', (m) => !HOME_OK.test(m.split('/')[2])],
  ['path:windows-home', /\b[A-Z]:\\Users\\([A-Za-z0-9._-]+)/gi, 'a Windows home directory with a user name', (m) => !/\\(you|user|username|public|name)$/i.test(m)],
];

/** Mask a match for logs: keep a little of each end so a reader can find it, hide the rest. */
export const mask = (s) => (s.length <= 6 ? '•'.repeat(s.length) : `${s.slice(0, 2)}${'•'.repeat(Math.min(12, s.length - 4))}${s.slice(-2)}`);

function scanShapes(text) {
  const hits = [];
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [rule, re, message, keep] of SHAPES) {
      re.lastIndex = 0;
      for (const m of lines[i].matchAll(re)) {
        if (keep(m[0])) hits.push({ rule, line: i + 1, shown: `${message} (${mask(m[0])})` });
      }
    }
    for (const [rule, message, whole] of [...ipHits(lines[i]), ...ipv6Hits(lines[i])]) hits.push({ rule, line: i + 1, shown: `${message} (${mask(whole)})` });
  }
  return hits;
}

/**
 * The text as a reader sees it run together: markup tags and Markdown emphasis removed, so "ac<b>me</b>" and
 * "ac**me**" read as "acme". Newlines stay, so line numbers still match.
 */
export const rendered = (text) =>
  decode(text)
    .replace(/<[^>\n]*>/g, '')
    .replace(/\*\*|__|~~|`/g, '')
    .replace(/(?<=[\p{L}\p{N}])[*_](?=[\p{L}\p{N}])/gu, '');

/**
 * Every finding in a text: [{ rule, line, shown }]. The text is read four ways (as written, decoded, decoded with
 * zero-width spaces as word breaks, and rendered: markup removed) and a finding is reported once per rule and line.
 * @param {string} text
 * @param {{ table?: Map<string, string>, salt?: string }} [opts]
 */
export function scanText(text, { table, salt = SALT } = {}) {
  const seen = new Set();
  const out = [];
  const views = [String(text), decode(text), decode(text, true), rendered(text)];
  for (const view of views) {
    for (const hit of [...(table ? scanDeny(view, table, salt) : []), ...scanShapes(view)]) {
      const key = `${hit.rule}:${hit.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(hit);
    }
  }
  return out.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}
