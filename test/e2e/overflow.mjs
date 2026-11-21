// A page must never scroll sideways: every page of the site, at phone, tablet and laptop widths. Whatever reaches
// past the edge of the screen (and is not inside a box that scrolls on its own) is named.
// node test/e2e/overflow.mjs <base> [widths, comma separated]      (default 320,360,390,768,1024,1280)
// Exits with a failure if any page scrolls sideways.
import * as pw from 'playwright-core';

const [base, widths = '320,360,390,768,1024,1280'] = process.argv.slice(2);
if (!base) {
  console.error('usage: node test/e2e/overflow.mjs <the address of a running copy of the site> [widths]');
  process.exit(2);
}
// Every page the sitemap lists, and the two it leaves out on purpose.
const sitemap = await (await fetch(`${base}/sitemap-0.xml`)).text();
const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
paths.push('/sortes/#stay', '/no-such-folio/');

const b = await pw.chromium.launch({ headless: true });
let bad = 0;
for (const width of widths.split(',').map(Number)) {
  const ctx = await b.newContext({ viewport: { width, height: 780 }, deviceScaleFactor: 1, isMobile: width < 700, hasTouch: width < 700 });
  let here = 0;
  for (const path of paths) {
    const p = await ctx.newPage();
    await p.goto(base + path, { waitUntil: 'load' });
    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const over = document.documentElement.scrollWidth - vw;
      if (over <= 1) return null;
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        const box = el.getBoundingClientRect();
        if (box.right <= vw + 1 || box.width === 0) continue;
        let clipped = false;
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          if (getComputedStyle(a).overflowX !== 'visible') {
            clipped = true;
            break;
          }
        }
        if (clipped || getComputedStyle(el).position === 'fixed') continue;
        out.push(`${el.tagName.toLowerCase()}.${(typeof el.className === 'string' ? el.className : '').split(' ')[0]} +${Math.round(box.right - vw)}`);
      }
      return { over, out: [...new Set(out)].slice(0, 6) };
    });
    if (r) {
      here++;
      console.log(`${width}px ${path}: scrolls ${r.over}px sideways: ${r.out.join(', ')}`);
    }
    await p.close();
  }
  bad += here;
  console.log(`${width}px: ${paths.length} pages, ${here} scroll sideways`);
  await ctx.close();
}
await b.close();
process.exit(bad ? 1 : 0);
