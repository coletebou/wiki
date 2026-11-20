// The reader's keys: one letter each, for turning leaves and getting about the library without the pointer. "?"
// lists them. They stand aside for typing, for any chord with Ctrl, Alt or Cmd, and for the studies that read the
// keyboard themselves.

const dialog = document.querySelector<HTMLDialogElement>('.keys-dialog');

function follow(selector: string): boolean {
  const a = document.querySelector<HTMLAnchorElement>(selector);
  if (a) location.href = a.href;
  return Boolean(a);
}

document.addEventListener('click', (e) => {
  if ((e.target as Element).closest('[data-keys]')) dialog?.showModal();
});
dialog?.addEventListener('click', (e) => {
  if (e.target === dialog) dialog.close();
});

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target as Element;
  if (target.closest('input, textarea, select, [contenteditable="true"], figure, dialog')) return;
  switch (e.key) {
    case '?':
      dialog?.showModal();
      break;
    case 'n':
      // From the frontispiece or the catalogue, the next leaf is the first.
      if (!follow('.turn .next') && !follow('a[data-first-leaf]')) return;
      break;
    case 'p':
      if (!follow('.turn .prev')) return;
      break;
    case 'v': {
      const verso = document.getElementById('verso-head');
      if (!verso) return;
      verso.scrollIntoView();
      break;
    }
    case 'c':
      location.href = '/pinakes/';
      break;
    case 'm':
      location.href = '/planisphere/';
      break;
    case 'h':
      location.href = '/';
      break;
    case 's':
      location.href = '/sortes/';
      break;
    case 'l':
      document.querySelector<HTMLButtonElement>('[data-theme-toggle]')?.click();
      break;
    default:
      return;
  }
  e.preventDefault();
});
