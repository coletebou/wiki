// The planisphere: pointing at a star draws its citations, by pointer and by keyboard.
// node test/e2e/planisphere.mjs <base> [chromium|webkit|firefox]
import * as pw from 'playwright-core';
const [base, engine = 'chromium'] = process.argv.slice(2);
const b = await pw[engine].launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
await p.goto(`${base}/planisphere/`, { waitUntil: 'networkidle' });
const n = await p.evaluate(() => document.querySelectorAll('.pl-star').length);
ok('every folio is a star', n >= 81, String(n));
const star = p.locator('.pl-star[data-slug="tmux"]');
await star.scrollIntoViewIfNeeded();
await star.hover();
await p.waitForTimeout(500);
const s = await p.evaluate(() => { const a = document.querySelector('.pl-star[data-slug="tmux"]'); return { out: document.querySelectorAll('.pl-link.out').length, inn: document.querySelectorAll('.pl-link.in').length, cites: a.dataset.cites.split(' ').filter(Boolean).length, cited: a.dataset.cited.split(' ').filter(Boolean).length, lit: document.querySelectorAll('.pl-lit').length, caption: document.querySelector('[data-planisphere-caption]').textContent, tag: !document.getElementById('sillybos').hidden && document.getElementById('sillybos').textContent.slice(0, 40) }; });
ok('pointing draws a line for every citation', s.out === s.cites && s.inn === s.cited && s.out > 0 && s.inn > 0, JSON.stringify(s));
ok('the caption says the counts', /^tmux: cites \d+ folios? \(red\), cited by \d+ folios? \(blue\)\.$/.test(s.caption), s.caption);
ok('the star carries its hanging tag', Boolean(s.tag), String(s.tag));
await p.mouse.move(5, 5);
await p.waitForTimeout(400);
ok('moving off clears the chart', await p.evaluate(() => document.querySelectorAll('.pl-link').length === 0 && !document.querySelector('.pl-pointing')));
await p.focus('.pl-star[data-slug="claude-code"]').catch(() => {});
// Safari moves between links with Option+Tab unless the reader has asked for Tab to.
await p.keyboard.press(engine === 'webkit' ? 'Alt+Tab' : 'Tab');
await p.waitForTimeout(300);
const f = await p.evaluate(() => ({ focused: document.activeElement?.className, links: document.querySelectorAll('.pl-link').length }));
ok('the keyboard points too', /pl-star/.test(f.focused ?? '') && f.links > 0, JSON.stringify(f));
const was = p.url();
await p.keyboard.press('Enter');
await p.waitForURL((u) => u.href !== was, { timeout: 5000 }).catch(() => {});
ok('Enter opens the star\'s folio', /^\/[a-z0-9-]+\/$/.test(new URL(p.url()).pathname) && !p.url().includes('planisphere'), new URL(p.url()).pathname);
await p.keyboard.press('m');
await p.waitForURL((u) => u.pathname === '/planisphere/', { timeout: 5000 }).catch(() => {});
ok('m opens the planisphere', new URL(p.url()).pathname === '/planisphere/');
console.log('page errors:', errs);
await b.close();
