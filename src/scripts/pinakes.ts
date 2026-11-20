// The catalogue's own finder: it narrows the entries to those whose title, other names, summary or folio hold every
// word typed. (Seek, in the masthead, reads the whole text of every folio; this only reads the catalogue.)

const box = document.querySelector<HTMLElement>('.pinax-find');
const input = box?.querySelector<HTMLInputElement>('input');
const tally = box?.querySelector<HTMLOutputElement>('output');

if (box && input && tally) {
  const entries = [...document.querySelectorAll<HTMLElement>('.pinax li[data-find]')];
  const tables = [...document.querySelectorAll<HTMLElement>('.pinax')];
  const none = document.querySelector<HTMLElement>('.pinax-none');
  const fold = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const apply = () => {
    const words = fold(input.value).split(/\s+/).filter(Boolean);
    const finding = words.length > 0;
    let shown = 0;
    for (const li of entries) {
      const hit = words.every((w) => li.dataset.find!.includes(w));
      li.hidden = !hit;
      if (hit) shown++;
    }
    for (const t of tables) t.hidden = finding && !t.querySelector('li[data-find]:not([hidden])');
    tally.textContent = finding ? `${shown} of ${entries.length} folios` : '';
    if (none) none.hidden = !finding || shown > 0;
    document.documentElement.toggleAttribute('data-finding', finding);
    // The address keeps what was sought, so a narrowed catalogue can be linked to and survives a reload.
    const url = new URL(location.href);
    if (finding) url.searchParams.set('find', input.value.trim());
    else url.searchParams.delete('find');
    history.replaceState(history.state, '', url);
  };

  box.hidden = false;
  input.value = new URLSearchParams(location.search).get('find') ?? input.value;
  input.addEventListener('input', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      input.value = '';
      apply();
      e.stopPropagation();
    }
  });
  if (input.value) apply();
}
