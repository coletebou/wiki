// Daylight (vellum) or lamplight (lucerna). The switch is the oil lamp in the masthead: lit by night, out by day.
// A choice is remembered; without one the page follows the system.
const root = document.documentElement;
const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');

function label() {
  if (!button) return;
  button.setAttribute('aria-label', root.dataset.theme === 'lucerna' ? 'Put out the lamp: switch to daylight' : 'Light the lamp: switch to lamplight');
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
