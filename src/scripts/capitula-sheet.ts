// The mark in the corner on a narrow screen (Capitula.astro): it shows once the folio's own contents have been
// scrolled past, and opens a sheet with them, the head of the leaf and the library's other rooms.
const mark = document.querySelector<HTMLButtonElement>('[data-capitula-open]');
const sheet = document.querySelector<HTMLDialogElement>('.capitula-sheet');
// What the mark waits to be past: the folio's inline contents, else its title.
const after = document.querySelector('.capitula-inline') ?? document.querySelector('h1.title');
if (mark && sheet && after && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => {
    // Shown only once the contents are above the screen, not while they are still below it.
    mark.hidden = e.isIntersecting || e.boundingClientRect.top > 0;
  }).observe(after);
  mark.addEventListener('click', () => sheet.showModal());
  // A tap outside the sheet closes it, as Escape does.
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close();
  });
  for (const a of sheet.querySelectorAll('[data-capitula-go]')) a.addEventListener('click', () => sheet.close());
}
