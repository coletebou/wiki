// The ribbon: leave a folio part read, come back, and take it up where it was left.
// node test/e2e/ribbon.mjs <base> [chromium|webkit|firefox]
import * as pw from 'playwright-core';
const [base, engine = 'chromium'] = process.argv.slice(2);
const b = await pw[engine].launch({ headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
const state = () => p.evaluate(() => ({ offer: document.querySelector('[data-resume]')?.hidden === false ? document.querySelector('[data-resume]').textContent : null, silk: Boolean(document.querySelector('.ribbon')), mark: JSON.parse(localStorage.getItem('codex-ribbon') ?? '{}').tmux ?? null }));

await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
ok('a folio never read makes no offer', (await state()).offer === null && !(await state()).silk);
const heading = await p.evaluate(() => { const hs = [...document.querySelectorAll('.prose h2[id]')]; const h = hs[Math.min(4, hs.length - 2)]; h.scrollIntoView(); return { id: h.id, text: h.firstChild.textContent.trim() }; });
await p.waitForTimeout(300);
await p.goto(`${base}/pinakes/`, { waitUntil: 'networkidle' });
await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
let s = await state();
ok('leaving part way lays the ribbon at the last heading read past', s.mark?.id === heading.id, JSON.stringify(s.mark));
ok('coming back, the folio offers to be taken up there', s.offer === `Take it up at “${heading.text}”` && s.silk, String(s.offer));
await p.click('[data-resume]');
await p.waitForTimeout(500);
const at = await p.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { top: Math.round(r.top), focused: document.activeElement?.id }; }, heading.id);
s = await state();
ok('taking it up goes to that heading and puts the ribbon away', at.top >= 0 && at.top < 200 && at.focused === heading.id && s.offer === null && !s.silk, JSON.stringify(at));
await p.goto(`${base}/tmux/#plugins`, { waitUntil: 'networkidle' });
ok('arriving at a place of one\'s own, no offer is made', (await state()).offer === null);
await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(300);
await p.goto(`${base}/pinakes/`, { waitUntil: 'networkidle' });
await p.goto(`${base}/tmux/`, { waitUntil: 'networkidle' });
s = await state();
ok('a folio read to its end keeps no ribbon', s.mark === null && s.offer === null, JSON.stringify(s));
console.log('page errors:', errs);
await b.close();
