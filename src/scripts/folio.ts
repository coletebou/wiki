// Small kindnesses on every folio: section anchors, copy buttons on code, the contents following the reader.

for (const h of document.querySelectorAll<HTMLHeadingElement>('.prose :is(h2, h3, h4)[id]')) {
  const a = document.createElement('a');
  a.className = 'heading-anchor';
  a.href = `#${h.id}`;
  a.setAttribute('aria-label', `Link to “${h.textContent?.trim()}”`);
  a.dataset.noPreview = '';
  a.textContent = '#';
  h.append(a);
}

for (const pre of document.querySelectorAll<HTMLPreElement>('.prose pre')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-code';
  button.textContent = 'Copy';
  button.addEventListener('click', async () => {
    const code = pre.querySelector('code')?.innerText ?? pre.innerText;
    try {
      await navigator.clipboard.writeText(code.replace(/\n$/, ''));
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select and copy';
    }
    setTimeout(() => (button.textContent = 'Copy'), 1600);
  });
  pre.append(button);
}

const marks = new Map<string, HTMLAnchorElement>();
for (const a of document.querySelectorAll<HTMLAnchorElement>('[data-capitulum]')) marks.set(a.dataset.capitulum!, a);
if (marks.size && 'IntersectionObserver' in window) {
  const visible = new Set<string>();
  const order = [...marks.keys()];
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id));
      const current = order.find((id) => visible.has(id));
      if (!current) return;
      for (const [id, a] of marks) a.classList.toggle('active', id === current);
    },
    { rootMargin: '0px 0px -65% 0px' },
  );
  for (const id of order) {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  }
}
