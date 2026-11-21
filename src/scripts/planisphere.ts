// The planisphere: pointing at a star (or coming to it with the keyboard) draws its citations across the chart, in
// red chalk to the folios it cites and in lapis from the folios that cite it, and says the counts beneath.

const root = document.querySelector<HTMLElement>('[data-planisphere]');
const links = root?.querySelector<SVGGElement>('.pl-links');
const caption = document.querySelector<HTMLElement>('[data-planisphere-caption]');

if (root && links) {
  const stars = new Map([...root.querySelectorAll<HTMLAnchorElement>('.pl-star')].map((a) => [a.dataset.slug!, a]));
  const rest = caption?.textContent ?? '';
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  const clear = () => {
    links.replaceChildren();
    root.classList.remove('pl-pointing');
    for (const a of root.querySelectorAll('.pl-here, .pl-lit')) a.classList.remove('pl-here', 'pl-lit');
    if (caption) caption.textContent = rest;
  };

  const point = (a: HTMLAnchorElement) => {
    clear();
    root.classList.add('pl-pointing');
    a.classList.add('pl-here');
    const draw = (slugs: string, kind: 'out' | 'in') => {
      const list = slugs.split(' ').filter(Boolean);
      for (const slug of list) {
        const b = stars.get(slug);
        if (!b) continue;
        b.classList.add('pl-lit');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', `pl-link ${kind}`);
        line.setAttribute('x1', a.dataset.x!);
        line.setAttribute('y1', a.dataset.y!);
        line.setAttribute('x2', b.dataset.x!);
        line.setAttribute('y2', b.dataset.y!);
        links.append(line);
      }
      return list.length;
    };
    // Those that cite it first, so that the lines to what it cites lie over them where a folio is both.
    const back = draw(a.dataset.cited ?? '', 'in');
    const out = draw(a.dataset.cites ?? '', 'out');
    if (caption) caption.textContent = `${a.dataset.title}: cites ${count(out, 'folio', 'folios')} (red), cited by ${count(back, 'folio', 'folios')} (blue).`;
  };

  const star = (e: Event) => (e.target as Element).closest<HTMLAnchorElement>('.pl-star');
  root.addEventListener('pointerover', (e) => {
    const a = star(e);
    if (a) point(a);
  });
  root.addEventListener('pointerout', (e) => {
    // A finger lifting is not a pointer leaving: what it drew stays until something else is touched.
    if ((e as PointerEvent).pointerType === 'touch') return;
    if (star(e) && !root.querySelector('.pl-star:focus-visible')) clear();
  });
  root.addEventListener('focusin', (e) => {
    const a = star(e);
    if (a) point(a);
  });
  root.addEventListener('focusout', clear);
  // Under a finger there is no pointing before pressing, and the stars stand close: the first touch of a star draws
  // its citations and names it, and a second touch of the same star opens it.
  let touched: HTMLAnchorElement | null = null;
  root.addEventListener('pointerdown', (e) => {
    touched = e.pointerType === 'touch' ? star(e) : null;
  });
  root.addEventListener('click', (e) => {
    const a = star(e);
    if (!a || a !== touched || a.dataset.shown) return;
    e.preventDefault();
    for (const other of stars.values()) delete other.dataset.shown;
    a.dataset.shown = '1';
    point(a);
    if (caption) caption.textContent += ' Touch it again to open it.';
  });
}
