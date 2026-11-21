// The ribbon: a long folio remembers where its reader stopped. Leaving a folio part read lays a ribbon at the last
// heading read past; coming back to it, the folio offers to be taken up there. Kept in this browser and nowhere else,
// for the last forty folios left unfinished. Reading a folio to its end takes its ribbon out.

type Mark = { id: string; t: string; at: number };
const KEY = 'codex-ribbon';
const KEEP = 40;

const article = document.querySelector<HTMLElement>('[data-folio-slug]');
const prose = article?.querySelector<HTMLElement>('.prose');

if (article && prose) {
  const slug = article.dataset.folioSlug!;
  const heads = [...prose.querySelectorAll<HTMLElement>(':is(h2, h3)[id]')];

  const marks = (): Record<string, Mark> => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
      return stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, Mark>) : {};
    } catch {
      return {};
    }
  };
  const keep = (all: Record<string, Mark>) => {
    const latest = Object.entries(all)
      .filter(([, m]) => m && typeof m.id === 'string' && typeof m.t === 'string' && typeof m.at === 'number')
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, KEEP);
    try {
      if (latest.length) localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(latest)));
      else localStorage.removeItem(KEY);
    } catch {}
  };
  /** A heading's words, without the "#" link the page hangs on it. */
  const titleOf = (h: HTMLElement) => {
    const copy = h.cloneNode(true) as HTMLElement;
    copy.querySelector('.heading-anchor')?.remove();
    return (copy.textContent ?? '').trim();
  };

  // Leaving: the ribbon goes in at the last heading read past, unless the folio was hardly begun or was finished.
  const lay = () => {
    const all = marks();
    // A reader who came, saw the offer and left again without reading on has not moved the ribbon.
    if (all[slug] && scrollY < 240) return;
    const line = scrollY + innerHeight * 0.4;
    const passed = heads.filter((h) => h.getBoundingClientRect().top + scrollY <= line);
    const foot = prose.getBoundingClientRect().bottom + scrollY;
    if (passed.length < 2 || scrollY + innerHeight >= foot - 60) delete all[slug];
    else {
      const h = passed.at(-1)!;
      all[slug] = { id: h.id, t: titleOf(h), at: Date.now() };
    }
    keep(all);
  };
  addEventListener('pagehide', lay);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') lay();
  });

  // Arriving at the head of a folio with a ribbon in it: the offer to take it up there.
  const mark = marks()[slug];
  const target = mark ? document.getElementById(mark.id) : null;
  const offer = article.querySelector<HTMLButtonElement>('[data-resume]');
  if (mark && target && offer && prose.contains(target) && !location.hash && scrollY < 240) {
    offer.textContent = `Take it up at “${titleOf(target)}”`;
    offer.hidden = false;
    const silk = document.createElement('span');
    silk.className = 'ribbon';
    silk.setAttribute('aria-hidden', 'true');
    article.closest('.leaf-sheet')?.append(silk);
    const done = () => {
      offer.hidden = true;
      silk.remove();
    };
    offer.addEventListener('click', () => {
      target.scrollIntoView();
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      done();
    });
    // A reader who reads on from the head has no use for the offer.
    const onward = () => {
      if (scrollY > innerHeight * 1.2) {
        done();
        removeEventListener('scroll', onward);
      }
    };
    addEventListener('scroll', onward, { passive: true });
  }
}
