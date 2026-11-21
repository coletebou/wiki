// An accessibility audit: axe-core on each page, by day and by lamplight, and on the dialogs when asked.
// node test/e2e/a11y.mjs <base> [path...]      (OPEN=seek|seekq|keys audits with that dialog open)
// Exits with a failure if anything is found.
import * as pw from 'playwright-core';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const [base, ...given] = process.argv.slice(2);
// With no pages named: one of each kind the site has.
const paths = given.length ? given : ['/', '/tmux/', '/pinakes/', '/planisphere/', '/about-this-wiki/', '/what-it-costs/', '/tmux-keymap/', '/agent-fleet/', '/parallel-worktrees/', '/observability/', '/cloudflare-front-door/', '/search/?q=tmux', '/sortes/#stay', '/no-such-folio/'];
const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const b = await pw.chromium.launch({ headless: true });
let total = 0;
for (const theme of ['vellum', 'lucerna']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme === 'vellum' ? 'light' : 'dark', reducedMotion: 'reduce' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('codex-theme', t); sessionStorage.setItem('codex-drawn', '1'); } catch {} }, theme);
  for (const path of paths) {
    const p = await ctx.newPage();
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    // OPEN=seek|seekq|keys: audit with that dialog open (seekq: with a query typed and results shown).
    const open = process.env.OPEN;
    if (open) {
      await p.evaluate(() => localStorage.setItem('codex-read', JSON.stringify([{ s: 'tmux', t: 'tmux', f: 'f. 11r', at: 1 }, { s: 'ssh', t: 'SSH', f: 'f. 30r', at: 0 }])));
      await p.keyboard.press(open === 'keys' ? '?' : '/');
      if (open === 'seekq') await p.keyboard.type('tmux');
      await p.waitForTimeout(1200);
    }
    await p.addScriptTag({ content: axe });
    const r = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }));
    for (const v of r.violations) {
      total += v.nodes.length;
      console.log(`${theme} ${path}  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`);
      for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.target.join(' ')}  ${(n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 150)}`);
    }
    const inc = r.incomplete.filter((i) => i.id === 'color-contrast').reduce((n, i) => n + i.nodes.length, 0);
    console.log(`${theme} ${path}: ${r.violations.length} rules violated, ${r.passes.length} passed, ${inc} contrast checks axe could not decide`);
    await p.close();
  }
  await ctx.close();
}
console.log('violating nodes in all:', total);
await b.close();
process.exit(total ? 1 : 0);
