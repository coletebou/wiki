// The reader's keys, the catchword, the leaves lately read and the leaf drawn by lot.
// node test/e2e/keys.mjs <base> [chromium|webkit|firefox]
import * as pw from 'playwright-core';
const [base, engine = 'chromium'] = process.argv.slice(2);
const chromium = pw[engine];
const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const path = () => new URL(p.url()).pathname;
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
const key = async (k) => { await p.keyboard.press(k); await p.waitForTimeout(350); await p.waitForLoadState('networkidle'); };
// A key that turns to another page: wait until the address changes (or give up after a moment) and the page settles.
const turn = async (k) => { const was = p.url(); await p.keyboard.press(k); await p.waitForURL((u) => u.href !== was, { timeout: 5000 }).catch(() => {}); await p.waitForLoadState('networkidle'); await p.waitForTimeout(250); };

await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
const cw = await p.evaluate(() => { const a = document.querySelector('.catchword a'); return a && { text: a.textContent, href: a.getAttribute('href'), label: a.getAttribute('aria-label'), next: document.querySelector('.turn .next')?.getAttribute('href') }; });
ok('catchword links to the next leaf', cw && cw.href === cw.next && cw.text.trim().length > 0, JSON.stringify(cw));
const roman = await p.evaluate(() => document.querySelector('.roman-date')?.textContent);
ok('the verso carries a Roman date', /^(Kal|Non|Id|prid|a\.d\.)/.test(roman ?? ''), roman);

await turn('n');
ok('n turns to the next leaf', path() === cw.next, path());
await turn('p');
ok('p turns back', path() === '/tmux/', path());
await key('?');
ok('? opens the keys', await p.evaluate(() => document.querySelector('.keys-dialog').open));
await key('n');
ok('keys do nothing while the dialog is open', path() === '/tmux/', path());
await key('Escape');
ok('Esc closes it', await p.evaluate(() => !document.querySelector('.keys-dialog').open));
const before = await p.evaluate(() => document.documentElement.dataset.theme);
await key('l');
const after = await p.evaluate(() => document.documentElement.dataset.theme);
ok('l lights the lamp', before !== after, `${before} -> ${after}`);
await key('l');
await key('v');
await p.waitForTimeout(1500);
ok('v goes to the back of the leaf', await p.evaluate(() => { const r = document.getElementById('verso-head').getBoundingClientRect(); return r.top >= -5 && r.top < innerHeight; }));

// A study that reads keys keeps them.
await p.goto(`${base}/tmux-keymap/`, { waitUntil: 'networkidle' });
const focused = await p.evaluate(() => { const k = document.querySelector('figure .key, figure [tabindex], figure button'); if (!k) return false; k.focus(); return document.activeElement === k; });
await key('n');
ok('inside a study, n is the study\'s', path() === '/tmux-keymap/', `focused=${focused} ${path()}`);

await key('/');
ok('/ opens Seek', await p.evaluate(() => document.querySelector('.seek-dialog').open));
const recent = await p.evaluate(() => ({ head: document.querySelector('.seek-head')?.textContent, items: [...document.querySelectorAll('#seek-results a .r-title')].map((e) => e.textContent) }));
ok('Seek offers the leaves lately read', recent.head === 'Lately read' && recent.items.length >= 2, JSON.stringify(recent));
await p.keyboard.type('n');
ok('typing in Seek types', await p.evaluate(() => document.querySelector('#seek-input').value === 'n') && path() === '/tmux-keymap/');
await key('Escape');
await key('Escape');
ok('Seek is closed again', await p.evaluate(() => !document.querySelector('.seek-dialog').open));
// Closing the dialog hands the focus back to the study; the reader leaves the study by clicking off it.
await p.evaluate(() => document.activeElement?.blur());
await turn('c');
ok('c opens the catalogue', path() === '/pinakes/', path());
await turn('h');
ok('h opens the frontispiece', path() === '/', path());
const shelf = await p.evaluate(() => { const s = document.querySelector('[data-lately]'); return { hidden: s.hidden, items: [...s.querySelectorAll('li')].map((li) => li.textContent) }; });
ok('the frontispiece lays out what was lately read', !shelf.hidden && shelf.items.length >= 2, JSON.stringify(shelf.items));
await p.locator('[data-lately]').scrollIntoViewIfNeeded();
await turn('n');
ok('n on the frontispiece opens the first leaf', path() === '/how-to-be-a-beast/', path());
await turn('s');
await p.waitForURL((u) => !u.pathname.startsWith('/sortes'), { timeout: 5000 }).catch(() => {});
await p.waitForLoadState('networkidle');
ok('s draws a leaf by lot', path() !== '/sortes/' && path() !== '/how-to-be-a-beast/' && /^\/[a-z0-9-]+\/$/.test(path()), path());
await p.goBack({ waitUntil: 'networkidle' });
ok('Back from a drawn leaf returns to where the reader was', path() === '/how-to-be-a-beast/', path());

await p.goto(`${base}/sortes/#stay`, { waitUntil: 'networkidle' });
ok('#stay keeps the lot-drawing page', path() === '/sortes/');

await p.goto(`${base}/`, { waitUntil: 'networkidle' });
await p.click('[data-lately-clear]');
ok('the table can be cleared', await p.evaluate(() => document.querySelector('[data-lately]').hidden && localStorage.getItem('codex-read') === null));
console.log('page errors:', errs);
await b.close();
