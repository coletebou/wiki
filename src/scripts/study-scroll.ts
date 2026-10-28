// A study's drawing keeps its size and scrolls sideways inside its frame when the screen is narrower than the drawing:
// scaled down to a phone's width its labels would be too small to read. So the reader can tell, an edge with more of
// the drawing beyond it fades out, a line under the drawing says so, and reveal() brings whatever a step lights into
// view, so the part the note is talking about is on screen.

const HINT = 'Slide the drawing sideways to see all of it.';

function update(scroller: HTMLElement) {
  const room = scroller.scrollWidth - scroller.clientWidth;
  const more = room > 1;
  scroller.classList.toggle('more-left', more && scroller.scrollLeft > 1);
  scroller.classList.toggle('more-right', more && scroller.scrollLeft < room - 1);
  const hint = scroller.nextElementSibling;
  if (hint instanceof HTMLElement && hint.classList.contains('study-swipe')) hint.hidden = !more;
}

for (const scroller of document.querySelectorAll<HTMLElement>('.study-scroll')) {
  const hint = document.createElement('p');
  hint.className = 'study-swipe';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = HINT;
  hint.hidden = true;
  scroller.after(hint);
  update(scroller);
  scroller.addEventListener('scroll', () => update(scroller), { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => update(scroller)).observe(scroller);
}

/** Scroll the drawing these elements are in so all of them show, or as much as fits from their left edge. */
export function reveal(els: Iterable<Element>) {
  let scroller: HTMLElement | null = null;
  let left = Infinity;
  let right = -Infinity;
  for (const el of els) {
    scroller ??= el.closest<HTMLElement>('.study-scroll');
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
  }
  if (!scroller || left === Infinity || scroller.scrollWidth <= scroller.clientWidth) return;
  const view = scroller.getBoundingClientRect();
  const pad = 12;
  if (left >= view.left + pad && right <= view.right - pad) return;
  const start = left - view.left + scroller.scrollLeft;
  const width = right - left;
  const target = width + 2 * pad <= scroller.clientWidth ? start - (scroller.clientWidth - width) / 2 : start - pad;
  const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  scroller.scrollTo({ left: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' });
}
