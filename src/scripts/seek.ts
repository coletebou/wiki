// The seeker: full-text search over every folio, from the Pagefind index built alongside the site.
// The dialog opens with "/", Ctrl-K or Cmd-K, or any [data-seek] button; the search page runs the same engine inline.
import { fold, titleFit } from '../../lib/fit.mjs';
import { lately, readLink } from './lately';

type PagefindData = { url: string; excerpt: string; meta: { title?: string; folio?: string; table?: string; device?: string } };
type PagefindResult = { id: string; data: () => Promise<PagefindData> };
type Pagefind = {
  options: (o: Record<string, unknown>) => Promise<void>;
  init: () => Promise<void>;
  debouncedSearch: (q: string, o?: Record<string, unknown>, ms?: number) => Promise<{ results: PagefindResult[] } | null>;
};

let pagefind: Promise<Pagefind | null> | null = null;

function load(): Promise<Pagefind | null> {
  pagefind ??= import(/* @vite-ignore */ new URL('/pagefind/pagefind.js', location.href).href)
    .then(async (pf: Pagefind) => {
      await pf.options({ excerptLength: 22 });
      await pf.init();
      return pf;
    })
    .catch(() => null);
  return pagefind;
}

// Where each table's device is drawn; fetched on the first search and set beside each result's folio.
let devices: Promise<Record<string, string>> | null = null;
const loadDevices = () => (devices ??= fetch('/devices.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

function device(src: string | undefined): HTMLSpanElement | null {
  // Only the site's own drawings, never anything a reader typed: /devices.json gives a path on this site.
  if (!src || !/^\/[^/]/.test(src)) return null;
  const mark = document.createElement('span');
  mark.className = 'device';
  mark.setAttribute('aria-hidden', 'true');
  mark.style.setProperty('--m', `url("${src}")`);
  return mark;
}

/**
 * The excerpt as it is to be read under its title. The index reads a folio from its title down, so an excerpt near
 * the top opens by repeating the title just shown above it: that is cut. An excerpt that starts or stops in the
 * middle of a sentence is marked so with an ellipsis.
 */
function excerpt(html: string, title: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'r-excerpt';
  // Pagefind builds the excerpt from page text it has already escaped, adding only <mark> around matches.
  span.innerHTML = html;
  const text = span.textContent ?? '';
  const head = text.match(/^\s*/)![0].length;
  let cut = head;
  if (title && fold(text.slice(head, head + title.length)) === fold(title)) {
    cut = head + title.length;
    cut += text.slice(cut).match(/^[\s.:;,·]*/)![0].length;
  }
  if (cut > 0) drop(span, cut);
  const rest = (span.textContent ?? '').trimEnd();
  if (/^[a-z,;:)]/.test(rest)) span.prepend('…');
  if (rest && !/[.!?:”)]$/.test(rest)) span.append('…');
  return span;
}

/** Removes the first n characters of an element's text, across its text nodes, and any element they leave empty. */
function drop(el: Element, n: number) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = n;
  const emptied: Node[] = [];
  for (let node = walker.nextNode(); node && left > 0; node = walker.nextNode()) {
    const len = node.nodeValue?.length ?? 0;
    if (len <= left) {
      emptied.push(node);
      left -= len;
    } else {
      node.nodeValue = node.nodeValue!.slice(left);
      left = 0;
    }
  }
  for (const node of emptied) {
    const parent = node.parentNode;
    node.parentNode?.removeChild(node);
    if (parent && parent !== el && !parent.textContent) (parent as Element).remove();
  }
}

/** Wire a query box to a results list. Returns a function that runs a query. */
function seeker(input: HTMLInputElement, list: HTMLUListElement) {
  let selected = -1;
  // Each query is numbered, and an answer is shown only if no later query has been asked since: a search still on
  // its way when the box is cleared must not come back and fill it.
  let asked = 0;
  let rows = 0;
  // In the dialog the results are a listbox the arrow keys choose from; on the search page they are a plain list
  // of links, and are marked up as one.
  const options = list.getAttribute('role') === 'listbox';
  const row = (a: HTMLAnchorElement) => {
    const li = document.createElement('li');
    if (options) {
      li.setAttribute('role', 'presentation');
      a.setAttribute('role', 'option');
      a.id = `${list.id}-${rows++}`;
    }
    a.dataset.noPreview = '';
    li.append(a);
    return li;
  };

  const empty = (text: string) => {
    const li = document.createElement('li');
    li.className = 'seek-empty';
    li.textContent = text;
    list.replaceChildren(li);
  };

  const choose = (i: number) => {
    const links = [...list.querySelectorAll<HTMLAnchorElement>('a')];
    if (!links.length) return;
    selected = (i + links.length) % links.length;
    links.forEach((a, n) => {
      a.toggleAttribute('data-chosen', n === selected);
      if (options) a.setAttribute('aria-selected', String(n === selected));
    });
    // The focus stays in the box; this is how the choice is told to a screen reader.
    if (options) input.setAttribute('aria-activedescendant', links[selected].id);
    links[selected].scrollIntoView({ block: 'nearest' });
  };

  const show = (label: string, nodes: Node[]) => {
    list.replaceChildren(...nodes);
    selected = -1;
    input.removeAttribute('aria-activedescendant');
    if (options) list.setAttribute('aria-label', label);
  };

  const run = async (q: string) => {
    const mine = ++asked;
    rows = 0;
    if (!q.trim()) {
      // Before a word is typed, the leaves lately read: most often the reader is going back to one of them.
      const reads = lately().slice(0, 8);
      if (!reads.length) {
        empty('Seek by word or phrase: tmux, Langfuse, worktrees, what Vercel costs…');
        return;
      }
      const head = document.createElement('li');
      head.className = 'seek-head';
      // The list's own name says what these are; the line above them is for the eye.
      if (options) {
        head.setAttribute('role', 'presentation');
        head.setAttribute('aria-hidden', 'true');
      }
      head.textContent = 'Lately read';
      show('Lately read', [head, ...reads.map((r) => row(readLink(r)))]);
      return;
    }
    const pf = await load();
    if (mine !== asked) return;
    if (!pf) {
      empty('The index is built with the site; it is not here in development.');
      return;
    }
    const search = await pf.debouncedSearch(q, {}, 160);
    if (!search || mine !== asked) return; // a newer keystroke superseded this one
    if (!search.results.length) {
      empty(`Nothing in the library matches “${q}”.`);
      return;
    }
    const [found, drawings] = await Promise.all([Promise.all(search.results.slice(0, 20).map((r) => r.data())), loadDevices()]);
    if (mine !== asked) return;
    const items = found
      .map((d, i) => ({ d, i, fit: titleFit(d.meta.title ?? '', q) }))
      .sort((a, b) => b.fit - a.fit || a.i - b.i)
      .slice(0, 12)
      .map(({ d }) => d);
    const nodes = items.map((d) => {
      const a = document.createElement('a');
      a.href = d.url;
      const title = document.createElement('span');
      title.className = 'r-title';
      title.textContent = d.meta.title ?? d.url;
      const meta = document.createElement('span');
      meta.className = 'r-meta';
      const mark = device(d.meta.device && drawings[d.meta.device]);
      if (mark) meta.append(mark);
      meta.append([d.meta.table, d.meta.folio].filter(Boolean).join(', '));
      a.append(title, meta, excerpt(d.excerpt, d.meta.title ?? ''));
      return row(a);
    });
    show('Results', nodes);
  };

  input.addEventListener('input', () => void run(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      choose(selected + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      choose(selected - 1);
    } else if (e.key === 'Enter') {
      const a = list.querySelectorAll<HTMLAnchorElement>('a')[Math.max(0, selected)];
      if (a) {
        e.preventDefault();
        location.href = a.href;
      }
    }
  });
  return run;
}

const dialog = document.querySelector<HTMLDialogElement>('.seek-dialog');
const dialogInput = document.querySelector<HTMLInputElement>('#seek-input');
const dialogList = document.querySelector<HTMLUListElement>('#seek-results');
const runDialog = dialogInput && dialogList ? seeker(dialogInput, dialogList) : null;

const pageInput = document.querySelector<HTMLInputElement>('#seek-page-input');
const pageList = document.querySelector<HTMLUListElement>('#seek-page-results');

function open() {
  if (pageInput) {
    pageInput.focus();
    pageInput.select();
    return;
  }
  if (!dialog || !dialogInput || !runDialog) return;
  if (!dialog.open) dialog.showModal();
  dialogInput.select();
  void runDialog(dialogInput.value);
  void load();
}

document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-seek]')) {
    e.preventDefault();
    open();
  }
});

document.addEventListener('keydown', (e) => {
  // A study that took the key for itself (the tmux keymap reads real chords, Ctrl+K among them) keeps it.
  if (e.defaultPrevented) return;
  const target = e.target as HTMLElement;
  // Typing, or in some other dialog (the keys): "/" is a character there, not a summons.
  const typing = target.isContentEditable || target.closest('input, textarea, select') || (target.closest('dialog') && target.closest('dialog') !== dialog);
  if ((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) {
    e.preventDefault();
    open();
  }
});

dialog?.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

if (pageInput && pageList) {
  const runPage = seeker(pageInput, pageList);
  pageInput.form?.addEventListener('submit', (e) => e.preventDefault());
  const q = new URLSearchParams(location.search).get('q') ?? '';
  pageInput.value = q;
  void runPage(q);
  pageInput.addEventListener('input', () => {
    const url = new URL(location.href);
    if (pageInput.value) url.searchParams.set('q', pageInput.value);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  });
}
