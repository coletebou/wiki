// The lost scroll: the folios nearest the address that was asked for (lib/near.mjs), offered above the other ways
// on. Nothing is shown when nothing is near, or when the catalogue cannot be fetched.
import { nearest } from '../../lib/near.mjs';

const box = document.querySelector<HTMLElement>('[data-near]');
const list = box?.querySelector('ul');
if (box && list && location.pathname !== '/') {
  fetch('/previews.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((folios: Record<string, { t: string; f?: number }>) => {
      const near = nearest(location.pathname, folios);
      for (const n of near) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `/${n.slug}/`;
        a.textContent = n.title;
        li.append(a);
        const f = folios[n.slug]?.f;
        if (f) {
          const no = document.createElement('span');
          no.className = 'near-folio';
          no.textContent = ` f. ${f}r`;
          li.append(no);
        }
        list.append(li);
      }
      box.hidden = near.length === 0;
    })
    .catch(() => {});
}
