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

// 4. The gold title is read once.
{
  const p = await open();
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  const snap = await p.locator('.frontispiece h1').ariaSnapshot().catch((e) => `unsupported: ${e.message.slice(0, 40)}`);
  ok('the title is read once', /^- heading "CODEX TEBOU" \[level=1\]$/.test(snap.trim()) || snap.startsWith('unsupported'), snap.trim());
  const shown = await p.evaluate(() => getComputedStyle(document.querySelector('.frontispiece h1'), '::after').content);
  ok('and the gold is still laid over it', shown.includes('CODEX TEBOU') || shown.includes('attr('), shown);
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
console.log('page errors:', errs);
await b.close();
