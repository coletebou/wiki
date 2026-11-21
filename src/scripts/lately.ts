// What the reader has lately read: the last dozen folios opened, kept in this browser and nowhere else. The
// frontispiece lays them out, and Seek offers them before anything is typed.

export type Read = { s: string; t: string; f: string; at: number };

const KEY = 'codex-read';
const KEEP = 12;
const isRead = (r: unknown): r is Read => {
  const v = r as Read;
  return Boolean(v) && typeof v.s === 'string' && /^[a-z0-9-]+$/.test(v.s) && typeof v.t === 'string' && typeof v.f === 'string' && typeof v.at === 'number';
};

/** The folios lately read, the latest first. */
export function lately(): Read[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter(isRead).slice(0, KEEP) : [];
  } catch {
    return [];
  }
}

function keep(list: Read[]) {
  try {
    if (list.length) localStorage.setItem(KEY, JSON.stringify(list.slice(0, KEEP)));
    else localStorage.removeItem(KEY);
  } catch {}
}

/** A link to a folio lately read, with its folio number. */
export function readLink(r: Read): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = `/${r.s}/`;
  const title = document.createElement('span');
  title.className = 'r-title';
  title.textContent = r.t;
  const folio = document.createElement('span');
  folio.className = 'r-meta';
  folio.textContent = r.f;
  a.append(title, folio);
  return a;
}

// On a folio: it goes to the head of the list.
const here = document.querySelector<HTMLElement>('[data-folio-slug]');
if (here) {
  const now: Read = { s: here.dataset.folioSlug!, t: here.dataset.folioTitle ?? '', f: here.dataset.folioLabel ?? '', at: Date.now() };
  if (isRead(now)) keep([now, ...lately().filter((r) => r.s !== now.s)]);
}

// On the frontispiece: the reader's table, if anything lies on it. A folio since renamed has no roll in the cabinet
// and is left out.
const table = document.querySelector<HTMLElement>('[data-lately]');
const list = table?.querySelector<HTMLOListElement>('ol');
if (table && list) {
  const lay = () => {
    const reads = lately()
      .filter((r) => document.querySelector(`a.roll[href="/${r.s}/"]`))
      .slice(0, 6);
    list.replaceChildren(
      ...reads.map((r) => {
        const li = document.createElement('li');
        li.append(readLink(r));
        return li;
      }),
    );
    table.hidden = reads.length === 0;
  };
  lay();
  table.querySelector('[data-lately-clear]')?.addEventListener('click', () => {
    keep([]);
    lay();
  });
  // A leaf read in another tab, or come back to with the browser's Back, shows here too.
  addEventListener('pageshow', lay);
  addEventListener('storage', (e) => {
    if (e.key === KEY) lay();
  });
}
