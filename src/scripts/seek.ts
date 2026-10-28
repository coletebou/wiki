// The seeker: full-text search over every folio, from the Pagefind index built alongside the site.
// The dialog opens with "/", Ctrl-K or Cmd-K, or any [data-seek] button; the search page runs the same engine inline.
type PagefindData = { url: string; excerpt: string; meta: { title?: string; folio?: string; table?: string } };
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

/** Wire a query box to a results list. Returns a function that runs a query. */
function seeker(input: HTMLInputElement, list: HTMLUListElement) {
  let selected = -1;

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
    links.forEach((a, n) => a.setAttribute('aria-selected', String(n === selected)));
    links[selected].scrollIntoView({ block: 'nearest' });
  };

  const run = async (q: string) => {
    if (!q.trim()) {
      empty('Seek by word or phrase: tmux, Langfuse, worktrees, what Vercel costs…');
      return;
    }
    const pf = await load();
    if (!pf) {
      empty('The index is built with the site; it is not here in development.');
      return;
    }
    const search = await pf.debouncedSearch(q, {}, 160);
    if (!search) return; // a newer keystroke superseded this one
    if (!search.results.length) {
      empty(`Nothing in the library matches “${q}”.`);
      return;
    }
    const items = await Promise.all(search.results.slice(0, 12).map((r) => r.data()));
    const nodes = items.map((d) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'presentation');
      const a = document.createElement('a');
      a.href = d.url;
      a.setAttribute('role', 'option');
      a.dataset.noPreview = '';
      const title = document.createElement('span');
      title.className = 'r-title';
      title.textContent = d.meta.title ?? d.url;
      const meta = document.createElement('span');
      meta.className = 'r-meta';
      meta.textContent = [d.meta.folio, d.meta.table].filter(Boolean).join(' · ');
      const excerpt = document.createElement('span');
      excerpt.className = 'r-excerpt';
      // Pagefind builds the excerpt from page text it has already escaped, adding only <mark> around matches.
      excerpt.innerHTML = d.excerpt;
      a.append(title, meta, excerpt);
      li.append(a);
      return li;
    });
    list.replaceChildren(...nodes);
    selected = -1;
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
  const typing = (e.target as Element).closest('input, textarea, select, [contenteditable="true"]');
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
