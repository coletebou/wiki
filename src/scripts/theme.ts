// Daylight (vellum) or candlelight (lucerna). A choice is remembered; without one the page follows the system.
const root = document.documentElement;
const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');

function label() {
  if (!button) return;
  button.setAttribute('aria-label', root.dataset.theme === 'lucerna' ? 'Switch to daylight' : 'Switch to candlelight');
}

button?.addEventListener('click', () => {
  const next = root.dataset.theme === 'lucerna' ? 'vellum' : 'lucerna';
  root.dataset.theme = next;
  try {
    localStorage.setItem('codex-theme', next);
  } catch {}
  label();
  document.dispatchEvent(new CustomEvent('codex:theme', { detail: next }));
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  let chosen: string | null = null;
  try {
    chosen = localStorage.getItem('codex-theme');
  } catch {}
  if (chosen) return;
  root.dataset.theme = e.matches ? 'lucerna' : 'vellum';
  label();
});

label();
