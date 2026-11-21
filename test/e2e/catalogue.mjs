// The catalogue's finder: it narrows the entries as words are typed, keeps what was sought in the address, and
// gives the whole catalogue back.
// node test/e2e/catalogue.mjs <base> [chromium|webkit|firefox]
import * as pw from 'playwright-core';
const [base, engine = 'chromium'] = process.argv.slice(2);
const b = await pw[engine].launch({ headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
const ok = (name, cond, extra = '') => console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
const state = () =>
  p.evaluate(() => ({
    shown: document.querySelectorAll('.pinax li[data-find]:not([hidden])').length,
    all: document.querySelectorAll('.pinax li[data-find]').length,
    tables: document.querySelectorAll('.pinax:not([hidden])').length,
    tally: document.querySelector('.pinax-find output').textContent,
    none: !document.querySelector('.pinax-none').hidden,
    finding: document.documentElement.hasAttribute('data-finding'),
    search: location.search,
    offered: !document.querySelector('.pinax-find').hidden,
  }));
// The address is written when the typing pauses: wait until it says what the box says (a fixed pause lost the
// race on a loaded machine), and give up after a few seconds so a finder that never writes it fails the check.
const settle = () =>
  p
    .waitForFunction(() => (new URLSearchParams(location.search).get('find') ?? '') === document.querySelector('#pinax-find').value, null, { timeout: 4000 })
    .catch(() => {});

await p.goto(`${base}/pinakes/`, { waitUntil: 'networkidle' });
let s = await state();
ok('the finder is offered, and the catalogue is whole', s.offered && s.shown === s.all && s.all > 50 && s.tables === 10 && !s.finding, JSON.stringify(s));
await p.fill('#pinax-find', 'tmux');
await settle();
s = await state();
ok('a word narrows the catalogue and the tally says to how many', s.shown > 0 && s.shown < s.all && s.tally === `${s.shown} of ${s.all} folios` && s.finding && s.search === '?find=tmux', JSON.stringify(s));
const some = s.shown;
await p.fill('#pinax-find', 'TMUX status');
await settle();
s = await state();
ok('more words narrow it further, whatever their case', s.shown >= 1 && s.shown < some, JSON.stringify(s));
await p.fill('#pinax-find', 'zzzz');
await settle();
s = await state();
ok('a word nothing answers to shows the offer to Seek', s.shown === 0 && s.tables === 0 && s.none, JSON.stringify(s));
await p.press('#pinax-find', 'Escape');
await settle();
s = await state();
ok('Escape gives the whole catalogue back and clears the address', s.shown === s.all && s.tables === 10 && !s.finding && s.search === '' && !s.none, JSON.stringify(s));
await p.goto(`${base}/pinakes/?find=f.%2011r`, { waitUntil: 'networkidle' });
s = await state();
ok('an address that names what was sought opens narrowed', s.shown === 1 && s.tables === 1, JSON.stringify(s));
console.log('page errors:', errs);
await b.close();
