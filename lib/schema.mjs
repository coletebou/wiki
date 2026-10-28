// The shape of a page, shared by the site, the content checks and the MCP server.

/** The Pinakes: Callimachus sorted the Library of Alexandria into tables by subject; this wiki keeps ten. */
export const TABLES = [
  { id: 'desk', numeral: 'I', title: 'The Desk', subtitle: 'The machines on and around the desk' },
  { id: 'shell', numeral: 'II', title: 'The Shell', subtitle: 'Terminals, the multiplexer, the prompt and the dotfiles' },
  { id: 'automata', numeral: 'III', title: 'The Automata', subtitle: 'Agents, their hooks, their messages and their memory' },
  { id: 'workshop', numeral: 'IV', title: 'The Workshop', subtitle: 'Git, worktrees, tests, linters and protocols' },
  { id: 'works', numeral: 'V', title: 'The Works', subtitle: 'Servers, DNS, hosting, CI and infrastructure as code' },
  { id: 'observatory', numeral: 'VI', title: 'The Observatory', subtitle: 'Traces, errors, logs and archives' },
  { id: 'atelier', numeral: 'VII', title: 'The Atelier', subtitle: 'Making apps for phones, watches, desktops and browsers' },
  { id: 'mint', numeral: 'VIII', title: 'The Mint', subtitle: 'Bitcoin, mining, wallets and privacy' },
  { id: 'ledger', numeral: 'IX', title: 'The Ledger', subtitle: 'What it all costs' },
  { id: 'library', numeral: 'X', title: 'The Library', subtitle: 'About this wiki and how to add to it' },
];

export const DIAGRAMS = ['tmux-keymap', 'agent-fleet', 'worktree-fanout', 'observability', 'cloudflare-front-door', 'cost-calculator'];
export const SCENES = { 'agent-fleet': ['hooks', 'messaging', 'handoff', 'parking', 'brain'] };

const KEYS = new Set(['title', 'summary', 'table', 'folio', 'aliases', 'updated', 'sources']);
export const SUMMARY_MAX = 240;
export const TITLE_MAX = 80;

const isDate = (v) => (v instanceof Date && !Number.isNaN(v.valueOf())) || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));

/** Problems with a page's frontmatter, as messages; an empty list means it is valid. */
export function validateFrontmatter(data) {
  const out = [];
  if (!data || typeof data !== 'object') return ['frontmatter is missing'];
  for (const key of Object.keys(data)) if (!KEYS.has(key)) out.push(`unknown frontmatter key "${key}" (allowed: ${[...KEYS].join(', ')})`);
  if (typeof data.title !== 'string' || !data.title.trim()) out.push('title is required');
  else if (data.title.length > TITLE_MAX) out.push(`title is ${data.title.length} characters, the most is ${TITLE_MAX}`);
  if (typeof data.summary !== 'string' || data.summary.trim().length < 20) out.push('summary is required (one or two sentences)');
  else if (data.summary.trim().length > SUMMARY_MAX) out.push(`summary is ${data.summary.trim().length} characters, the most is ${SUMMARY_MAX}`);
  if (!TABLES.some((t) => t.id === data.table)) out.push(`table must be one of ${TABLES.map((t) => t.id).join(', ')}`);
  if (!Number.isInteger(data.folio) || data.folio < 1) out.push('folio must be a whole number, 1 or more');
  if (data.aliases !== undefined && !(Array.isArray(data.aliases) && data.aliases.every((a) => typeof a === 'string' && a.trim()))) {
    out.push('aliases must be a list of names');
  }
  if (!isDate(data.updated)) out.push('updated must be a date like 2026-10-28');
  if (data.sources !== undefined) {
    if (!Array.isArray(data.sources)) out.push('sources must be a list of { title, url }');
    else
      data.sources.forEach((s, i) => {
        if (!s || typeof s.title !== 'string' || !s.title.trim()) out.push(`sources[${i}] needs a title`);
        if (!s || typeof s.url !== 'string' || !/^https:\/\/[^\s]+$/.test(s.url)) out.push(`sources[${i}] needs an https url`);
      });
  }
  return out;
}

/** Folio label for the recto (the page) or verso (its back matter): 12 -> "f. 12r". */
export const folioLabel = (n, side = 'r') => `f. ${n}${side}`;
