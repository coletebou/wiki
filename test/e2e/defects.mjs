// Defects found after the redesign shipped, each driven so that it cannot come back unseen: printing by lamplight,
// the ribbon that vanished, the late answer in Seek, the title read twice, Caps Lock, the finder and the tables'
// names, and the planisphere under a finger.
// node test/e2e/defects.mjs <base> [chromium|webkit|firefox]
import * as pw from 'playwright-core';
const [base, engine = 'chromium'] = process.argv.slice(2);
const b = await pw[engine].launch({ headless: true });
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
const errs = [];
const open = async (opts = {}) => { const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', ...opts }); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); return p; };
const path = (p) => new URL(p.url()).pathname;

// 1. Printing with the lamp lit.
{
  const p = await open({ colorScheme: 'dark' });
  await p.addInitScript(() => localStorage.setItem('codex-theme', 'lucerna'));
  await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
  const screen = await p.evaluate(() => getComputedStyle(document.querySelector('.prose p')).color);
  await p.emulateMedia({ media: 'print' });
  const print = await p.evaluate(() => ({ text: getComputedStyle(document.querySelector('.prose p')).color, title: getComputedStyle(document.querySelector('h1.title')).color, link: getComputedStyle(document.querySelector('.prose a')).color, hair: getComputedStyle(document.documentElement).getPropertyValue('--il-hair').trim() }));
  const dark = (c) => c.match(/\d+/g).slice(0, 3).reduce((n, v) => n + Number(v), 0) < 300;
  ok('with the lamp lit, the page is still printed in dark ink', !dark(screen) && dark(print.text) && dark(print.title) && dark(print.link), JSON.stringify({ screen, ...print }));
  await p.context().close();
}

// 2. The ribbon survives a visit that does not read on.
{
  const p = await open();
  await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
  await p.evaluate(() => { const hs = [...document.querySelectorAll('.prose h2[id]')]; hs[3].scrollIntoView(); });
  await p.waitForTimeout(250);
  await p.goto(`${base}/pinakes/`, { waitUntil: 'networkidle' });
  await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
  const first = await p.evaluate(() => document.querySelector('[data-resume]').textContent);
  await p.goto(`${base}/pinakes/`, { waitUntil: 'networkidle' });
  await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
  const second = await p.evaluate(() => document.querySelector('[data-resume]').hidden ? null : document.querySelector('[data-resume]').textContent);
  ok('an offer not taken up is made again next time', Boolean(first) && second === first, String(second));
  await p.context().close();
}

// 3. A search still on its way when the box is cleared does not come back.
{
  const p = await open();
  await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
  await p.keyboard.press('/');
  await p.keyboard.type('tm');
  await p.keyboard.press('Meta+a');
  await p.evaluate(() => { const i = document.querySelector('#seek-input'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(1500);
  const s = await p.evaluate(() => ({ results: document.querySelectorAll('#seek-results .r-excerpt').length, head: document.querySelector('.seek-head')?.textContent ?? null, label: document.querySelector('#seek-results').getAttribute('aria-label') }));
  ok('clearing the box leaves the leaves lately read, not a late answer', s.results === 0 && s.head === 'Lately read' && s.label === 'Lately read', JSON.stringify(s));
  await p.keyboard.type('tmux');
  await p.waitForTimeout(1500);
  await p.keyboard.press('ArrowDown');
  const a = await p.evaluate(() => { const i = document.querySelector('#seek-input'); const id = i.getAttribute('aria-activedescendant'); const el = id && document.getElementById(id); return { id, role: el?.getAttribute('role'), selected: el?.getAttribute('aria-selected'), label: document.querySelector('#seek-results').getAttribute('aria-label'), n: document.querySelectorAll('#seek-results a').length }; });
  ok('the arrow keys tell a screen reader which result is chosen', a.n > 0 ? a.role === 'option' && a.selected === 'true' && a.label === 'Results' : true, JSON.stringify(a));
  await p.context().close();
}

// 4. The title is read once, in words, and drawn in Pacioli's capitals for the eye.
{
  const p = await open();
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  const snap = await p.locator('.frontispiece h1').ariaSnapshot().catch((e) => `unsupported: ${e.message.slice(0, 40)}`);
  ok('the title is read once', /^- heading "Codex Tebou" \[level=1\]$/.test(snap.trim()) || snap.startsWith('unsupported'), snap.trim());
  const drawn = await p.evaluate(() => {
    const d = document.querySelector('.frontispiece h1 .wm-drawing');
    const masks = [...(d?.children ?? [])].map((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage);
    return { hidden: d?.getAttribute('aria-hidden'), masks: masks.map((m) => /pacioli|codex-tebou/.test(m ?? '')), height: d?.getBoundingClientRect().height };
  });
  ok('and drawn, letters and construction, hidden from assistive technology', drawn.hidden === 'true' && drawn.masks.length === 2 && drawn.masks.every(Boolean) && drawn.height > 20, JSON.stringify(drawn));
  await p.context().close();
}

// 5. Keys: Caps Lock, and "/" under the keys dialog.
{
  const p = await open();
  await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
  await p.keyboard.press('?');
  await p.keyboard.press('/');
  await p.waitForTimeout(200);
  ok('"/" does not open Seek over the keys', await p.evaluate(() => document.querySelector('.keys-dialog').open && !document.querySelector('.seek-dialog').open));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const was = p.url();
  await p.keyboard.press('N');
  await p.waitForURL((u) => u.href !== was, { timeout: 5000 }).catch(() => {});
  ok('a capital N turns the leaf too', path(p) === '/tmux-keymap/', path(p));
  await p.context().close();
}

// 6. The catalogue: a table's name leads to it even when the finder had put it away; the address is kept.
{
  const p = await open();
  await p.goto(`${base}/pinakes/`, { waitUntil: 'networkidle' });
  await p.fill('#pinax-find', 'tmux');
  await p.waitForTimeout(450);
  const kept = new URL(p.url()).search;
  const hiddenBefore = await p.evaluate(() => document.querySelector('#table-ledger').hidden);
  await p.click('.pinax-nav a[href="#table-ledger"]');
  await p.waitForTimeout(450);
  const after = await p.evaluate(() => ({ hidden: document.querySelector('#table-ledger').hidden, value: document.querySelector('#pinax-find').value, hash: location.hash, search: location.search }));
  ok('a table\'s name clears the finder and goes there', kept === '?find=tmux' && hiddenBefore && !after.hidden && after.value === '' && after.hash === '#table-ledger' && after.search === '', JSON.stringify({ kept, hiddenBefore, ...after }));
  await p.context().close();
}

// 7. The planisphere under a finger: the first touch draws, the second opens. And it is not announced twice.
{
  const p = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: engine !== 'firefox' });
  await p.goto(`${base}/planisphere/`, { waitUntil: 'networkidle' });
  const star = p.locator('.pl-star[data-slug="tmux"]');
  await star.scrollIntoViewIfNeeded();
  await star.tap();
  await p.waitForTimeout(500);
  const one = await p.evaluate(() => ({ path: location.pathname, links: document.querySelectorAll('.pl-link').length, caption: document.querySelector('[data-planisphere-caption]').textContent, live: document.querySelector('[data-planisphere-caption]').getAttribute('aria-live') }));
  ok('a first touch of a star draws its citations and stays', one.path === '/planisphere/' && one.links > 0 && /Touch it again to open it\.$/.test(one.caption) && one.live === null, JSON.stringify(one));
  const was = p.url();
  await star.tap();
  await p.waitForURL((u) => u.href !== was, { timeout: 5000 }).catch(() => {});
  ok('a second touch opens it', path(p) === '/tmux/', path(p));
  await p.context().close();
}
// 8. A folio's initial is Pacioli's letter, drawn in both layers and hidden from assistive technology, and the text
// still begins with the letter it stands for. WSL opens on a W, which Pacioli never drew: it is made of two V's.
{
  const p = await open();
  await p.goto(`${base}/wsl/`, { waitUntil: 'networkidle' });
  const s = await p.evaluate(() => {
    const i = document.querySelector('.prose > .initial');
    const layers = [...(i?.children ?? [])].map((e) => getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage || '');
    const box = i?.getBoundingClientRect();
    return { hidden: i?.getAttribute('aria-hidden'), layers: layers.map((m) => /W-(letter|construction)/.test(m)), w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0), text: i?.nextElementSibling?.textContent?.slice(0, 3) };
  });
  ok('the initial is drawn, letter and construction, and hidden', s.hidden === 'true' && s.layers.length === 2 && s.layers.every(Boolean) && s.w > 40 && s.h > 40, JSON.stringify(s));
  ok('and the text still begins with its letter', s.text === 'WSL', JSON.stringify(s));
  await p.context().close();
}

// The tables' devices: traced drawings set as masks, the broad-nibbed cut wherever they are small and the pen's own line
// at the head of a table, and the same small cut beside a search's results.
{
  const p = await open();
  const mask = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { url: (c.maskImage || c.webkitMaskImage || '').match(/url\("?([^")]+)/)?.[1] ?? '', w: Math.round(r.width), h: Math.round(r.height), hidden: e.getAttribute('aria-hidden') }; }, sel);
  await p.goto(`${base}/pinakes/`, { waitUntil: 'networkidle' });
  const head = await mask('#table-shell .pinax-head .device');
  await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
  const kicker = await mask('.kicker .device');
  const loads = async (u) => u && (await p.evaluate(async (x) => { const r = await fetch(x); return r.ok && /svg/.test(r.headers.get('content-type') ?? ''); }, u));
  ok('a folio\'s device is drawn, small, from the broad-nibbed cut, and hidden', kicker?.w >= 14 && kicker.w === kicker.h && kicker.hidden === 'true' && (await loads(kicker.url)) && head?.w > kicker.w && head.url !== kicker.url && (await loads(head.url)), JSON.stringify({ head, kicker }));
  await p.keyboard.press('/');
  await p.keyboard.type('tmux');
  const shown = await p.waitForFunction(() => document.querySelector('#seek-results .r-meta .device'), null, { timeout: 8000 }).then(() => true, () => false);
  const result = shown ? await mask('#seek-results .r-meta .device') : null;
  ok('a search sets each result\'s device beside it, from the same small cut', Boolean(result) && result.w >= 12 && result.hidden === 'true' && (await loads(result.url)) && /\/_astro\//.test(result.url), JSON.stringify(result));
  await p.context().close();
}

// A code block with a line too long for it: an edge shadow says it scrolls, and its label and copy button stay put
// on the frame while the text scrolls under them.
{
  const p = await open();
  await p.goto(`${base}/ssh/`, { waitUntil: 'networkidle' });
  const s = await p.evaluate(() => {
    const pre = [...document.querySelectorAll('.prose .code-frame > pre')].find((e) => e.scrollWidth > e.clientWidth + 4);
    if (!pre) return null;
    const frame = pre.parentElement, button = frame.querySelector('.copy-code');
    const at = () => Math.round(button.getBoundingClientRect().left);
    const before = at();
    pre.scrollLeft = 9999;
    const after = at();
    return { label: getComputedStyle(frame, '::before').content, layers: getComputedStyle(pre).backgroundImage.split('linear-gradient').length - 1, before, after, scrolled: pre.scrollLeft > 0 };
  });
  ok('a long line scrolls under a still label and copy button, with a shadow at the edge', s && s.scrolled && s.label === '"sh"' && s.layers === 4 && s.before === s.after, JSON.stringify(s));
  await p.context().close();
}

console.log('page errors:', errs);
await b.close();
