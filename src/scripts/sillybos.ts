// Sillyboi: in the Library of Alexandria each scroll carried a parchment tag, a sillybos, naming the work, so a reader
// could find it without unrolling it. Here every link carries one: hover or focus it and its tag swings down on a
// string. A touch screen has no hover, so a tap just follows the link.

type Preview = { t: string; s: string; f: number; n: string; tb: string; h: Record<string, string> };
type Tag = { kicker: string; title: string; section?: string | null; summary?: string; foot?: string; folio?: string };

const tag = document.getElementById('sillybos') as HTMLDivElement | null;
const ROUTES: Record<string, { title: string; summary: string }> = {
  '/': { title: 'Codex Tebou', summary: 'The frontispiece: how to be a beast, and the ten tables of the library.' },
  '/pinakes/': { title: 'The Pinakes', summary: 'The whole catalogue, table by table, with each folio’s opening words and its length in lines.' },
  '/search/': { title: 'Seek', summary: 'Full-text search across every folio in the library.' },
};

let previews: Promise<Record<string, Preview>> | null = null;
const load = () => (previews ??= fetch('/previews.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

let current: HTMLAnchorElement | null = null;
let showTimer = 0;
let hideTimer = 0;
let string: SVGSVGElement | null = null;

function eligible(a: Element | null): a is HTMLAnchorElement {
  if (!(a instanceof HTMLAnchorElement) || !tag) return false;
  if (a.closest('.sillybos, .capitula, .capitula-inline, .skip, .seek-dialog') || 'noPreview' in a.dataset) return false;
  const raw = a.getAttribute('href');
  return Boolean(raw) && !raw!.startsWith('javascript:');
}

async function describe(a: HTMLAnchorElement): Promise<Tag | null> {
  const url = new URL(a.href, location.href);
  if (url.origin === location.origin) {
    const slug = url.pathname.replace(/^\/+|\/+$/g, '');
    const all = await load();
    const p = all[slug];
    if (p) {
      const id = url.hash ? decodeURIComponent(url.hash.slice(1)) : '';
      return { kicker: `${p.n} · ${p.tb}`, title: p.t, section: id ? p.h[id] ?? null : null, summary: p.s, folio: `f. ${p.f}r` };
    }
    if (ROUTES[url.pathname]) return { kicker: 'The library', ...ROUTES[url.pathname] };
    if (url.pathname === location.pathname && url.hash) {
      const h = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!h) return null;
      return { kicker: 'On this folio', title: h.textContent?.replace(/#$/, '').trim() ?? '' };
    }
    return null;
  }
  if (url.protocol === 'mailto:') return { kicker: 'A letter', title: url.pathname };
  if (!/^https?:$/.test(url.protocol)) return null;
  const path = decodeURIComponent(url.pathname + url.search).replace(/\/$/, '');
  return {
    kicker: 'Beyond the library',
    title: url.hostname.replace(/^www\./, ''),
    summary: path && path !== '' ? (path.length > 72 ? `${path.slice(0, 70)}…` : path) : undefined,
    foot: 'Opens the source',
  };
}

function el<K extends keyof HTMLElementTagNameMap>(name: K, cls: string, text?: string) {
  const node = document.createElement(name);
  node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function render(t: Tag) {
  if (!tag) return;
  tag.replaceChildren();
  tag.append(el('span', 'tag-table', t.kicker), el('span', 'tag-title', t.title));
  if (t.section) tag.append(el('span', 'tag-table', `§ ${t.section}`));
  if (t.summary) tag.append(el('span', 'tag-summary', t.summary));
  const foot = el('span', 'tag-foot');
  if (t.folio) foot.append(el('span', 'folio-no', t.folio));
  if (t.foot) foot.append(el('span', '', t.foot));
  if (foot.childElementCount) tag.append(foot);
}

function drawString(link: DOMRect, box: { left: number; top: number; height: number }, above: boolean) {
  string ??= (() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sillybos-string');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>';
    document.body.append(svg);
    return svg;
  })();
  const x1 = link.left + scrollX + Math.min(18, link.width / 2);
  const y1 = (above ? link.top : link.bottom) + scrollY;
  const x2 = box.left + 13;
  const y2 = above ? box.top + box.height - 13 : box.top + 13;
  const minX = Math.min(x1, x2) - 10;
  const minY = Math.min(y1, y2) - 10;
  const w = Math.abs(x2 - x1) + 20;
  const h = Math.abs(y2 - y1) + 20;
  Object.assign(string.style, { left: `${minX}px`, top: `${minY}px`, width: `${w}px`, height: `${h}px`, color: 'var(--rule)' });
  string.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const [ax, ay, bx, by] = [x1 - minX, y1 - minY, x2 - minX, y2 - minY];
  const sag = 8 + Math.abs(bx - ax) * 0.12;
  string.querySelector('path')!.setAttribute('d', `M${ax} ${ay} Q ${(ax + bx) / 2 - 4} ${(ay + by) / 2 + (above ? -sag : sag)} ${bx} ${by}`);
  string.style.display = 'block';
}

function place(a: HTMLAnchorElement) {
  if (!tag) return;
  const r = a.getClientRects()[0] ?? a.getBoundingClientRect();
  const w = tag.offsetWidth;
  const h = tag.offsetHeight;
  const left = Math.max(scrollX + 8, Math.min(r.left + scrollX - 16, scrollX + innerWidth - w - 8));
  const roomBelow = innerHeight - r.bottom;
  const above = roomBelow < h + 30 && r.top > h + 30;
  const top = above ? r.top + scrollY - h - 18 : r.bottom + scrollY + 18;
  tag.style.left = `${left}px`;
  tag.style.top = `${top}px`;
  tag.classList.toggle('above', above);
  tag.style.setProperty('--tag-origin', above ? '13px calc(100% - 13px)' : '13px 13px');
  drawString(r, { left, top, height: h }, above);
}

async function show(a: HTMLAnchorElement) {
  if (!tag) return;
  const t = await describe(a);
  if (!t) return;
  current?.removeAttribute('aria-describedby');
  current = a;
  render(t);
  tag.hidden = false;
  tag.classList.remove('swing');
  void tag.offsetWidth; // restart the swing
  tag.classList.add('swing');
  a.setAttribute('aria-describedby', 'sillybos');
  place(a);
}

function hide(now = false) {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  const go = () => {
    if (!tag) return;
    tag.hidden = true;
    tag.classList.remove('swing');
    if (string) string.style.display = 'none';
    current?.removeAttribute('aria-describedby');
    current = null;
  };
  if (now) go();
  else hideTimer = window.setTimeout(go, 220);
}

if (tag) {
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    void load();
    const a = (e.target as Element).closest('a');
    if (a && tag.contains(a)) return;
    if (!eligible(a)) return;
    clearTimeout(hideTimer);
    if (a === current && !tag.hidden) return;
    clearTimeout(showTimer);
    showTimer = window.setTimeout(() => void show(a), 260);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const a = (e.target as Element).closest('a');
    if (!eligible(a)) return;
    const to = e.relatedTarget as Node | null;
    if (to && (a.contains(to) || tag.contains(to))) return;
    clearTimeout(showTimer);
    hide();
  });
  tag.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  tag.addEventListener('pointerleave', () => hide());

  document.addEventListener('focusin', (e) => {
    const a = e.target as Element;
    if (!eligible(a) || !a.matches(':focus-visible')) return;
    clearTimeout(showTimer);
    showTimer = window.setTimeout(() => void show(a), 380);
  });
  document.addEventListener('focusout', (e) => {
    if (eligible(e.target as Element)) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !tag.hidden) hide(true);
  });
  addEventListener('scroll', () => {
    if (!tag.hidden) hide(true);
  }, { passive: true });
  addEventListener('resize', () => hide(true));
}
