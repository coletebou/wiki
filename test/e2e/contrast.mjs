// A contrast audit of the page as it is painted: the contrast every piece of text really has on its surface.
// node test/e2e/contrast.mjs <base> [path...]      (THEMES=vellum or THEMES=lucerna for one theme)
// Each page is drawn twice: once to read every text's colour and place, once with the text made transparent to read
// what lies behind it. The surface is blurred a little first (a texture's single grains do not make text harder to
// read; its slow changes of tone do), and each text is weighed against the worst tone behind it: WCAG's 4.5:1, or
// 3:1 for large text. Ornament hidden from assistive technology is left out.
import * as pw from 'playwright-core';
import sharp from 'sharp';
const [base, ...given] = process.argv.slice(2);
const paths = given.length ? given : ['/', '/tmux/', '/pinakes/', '/planisphere/', '/about-this-wiki/', '/what-it-costs/', '/claude-code/', '/search/?q=tmux', '/sortes/#stay', '/no-such-folio/'];
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const b = await pw.chromium.launch({ headless: true });
let below = 0;
for (const theme of (process.env.THEMES ?? 'vellum,lucerna').split(',')) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, colorScheme: theme === 'vellum' ? 'light' : 'dark', reducedMotion: 'reduce' });
  await ctx.addInitScript((t) => { try { localStorage.setItem('codex-theme', t); sessionStorage.setItem('codex-drawn', '1'); } catch {} }, theme);
  for (const path of paths) {
    const p = await ctx.newPage();
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const texts = await p.evaluate(() => {
      const out = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        if (!el || seen.has(el) || el.closest('[aria-hidden="true"], .visually-hidden, dialog:not([open]), [hidden], script, style, noscript, svg')) continue;
        seen.add(el);
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const range = document.createRange();
        range.selectNodeContents(el);
        // Only what shows: text that runs on past the edge of a scrolling box (a long line of code) is cut off there.
        let [cl, ct, cr, cb] = [-Infinity, -Infinity, Infinity, Infinity];
        for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
          const o = getComputedStyle(a);
          if (o.overflowX === 'visible' && o.overflowY === 'visible') continue;
          const r = a.getBoundingClientRect();
          [cl, ct, cr, cb] = [Math.max(cl, r.left), Math.max(ct, r.top), Math.min(cr, r.right), Math.min(cb, r.bottom)];
        }
        const rects = [...range.getClientRects()]
          .map((r) => [Math.max(r.left, cl), Math.max(r.top, ct), Math.min(r.right, cr), Math.min(r.bottom, cb)])
          .filter(([l, t, r2, b2]) => r2 - l > 2 && b2 - t > 2)
          .map(([l, t, r2, b2]) => [l + scrollX, t + scrollY, r2 - l, b2 - t]);
        if (!rects.length) continue;
        let opacity = 1;
        for (let a = el; a; a = a.parentElement) opacity *= Number(getComputedStyle(a).opacity);
        const m = cs.color.match(/[\d.]+/g).map(Number);
        const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? cs.webkitTextFillColor.match(/[\d.]+/g).map(Number) : null;
        const c = fill ?? m;
        // Left out: text drawn by other means (the gold title), and what only shows when pointed at.
        if ((c[3] ?? 1) * opacity < 0.05 || el.closest('.frontispiece h1')) continue;
        const size = parseFloat(cs.fontSize);
        out.push({ who: `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`, text: n.textContent.trim().slice(0, 28), rgb: c.slice(0, 3), alpha: (c[3] ?? 1) * opacity, large: size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700), rects });
      }
      return out;
    });
    await p.addStyleTag({ content: `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } ::placeholder { color: transparent !important; } .prose a::after, .verso a::after { visibility: hidden !important; }` });
    await p.waitForTimeout(150);
    // The page as it is really seen: one screen at a time, each with the room's light where it falls on a screen
    // (a single tall picture would stretch that light over the whole page), and the screens laid end to end.
    const { height: pageH, vh, vw } = await p.evaluate(() => ({ height: document.documentElement.scrollHeight, vh: innerHeight, vw: innerWidth }));
    const tiles = [];
    for (let y = 0; y < pageH; y += vh) {
      const at = await p.evaluate((to) => { scrollTo(0, to); return scrollY; }, y);
      await p.waitForTimeout(40);
      const raw = await sharp(await p.screenshot()).removeAlpha().raw().toBuffer();
      // The last screen cannot scroll a whole screen further: only its new rows are taken.
      const skip = y - at;
      tiles.push(raw.subarray(skip * vw * 3));
    }
    const whole = Buffer.concat(tiles).subarray(0, pageH * vw * 3);
    const { data, info } = await sharp(whole, { raw: { width: vw, height: pageH, channels: 3 } }).blur(2.2).raw().toBuffer({ resolveWithObject: true });
    const worstBy = new Map();
    for (const t of texts) {
      const ls = [];
      for (const [x, y, w, h] of t.rects) {
        for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(info.height, Math.ceil(y + h)); yy += 2)
          for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(info.width, Math.ceil(x + w)); xx += 2) {
            const i = (yy * info.width + xx) * info.channels;
            ls.push([data[i], data[i + 1], data[i + 2]]);
          }
      }
      if (ls.length < 4) continue;
      let least = Infinity;
      const lums = ls.map((c) => lum(...c));
      const sorted = [...lums].sort((a, c) => a - c);
      // Against the surface's darkest and lightest tones behind this text, whichever is worse for it.
      for (const q of [0.02, 0.98]) {
        const bgL = sorted[Math.floor((sorted.length - 1) * q)];
        const bg = ls[lums.indexOf(bgL)];
        const fg = t.rgb.map((v, k) => v * t.alpha + bg[k] * (1 - t.alpha));
        const [hi, lo] = [lum(...fg), bgL].sort((a, c) => c - a);
        least = Math.min(least, (hi + 0.05) / (lo + 0.05));
      }
      const need = t.large ? 3 : 4.5;
      if (least < need) {
        const k = `${t.who} [needs ${need}]`;
        const was = worstBy.get(k);
        if (!was || least < was.least) worstBy.set(k, { least, text: t.text, n: (was?.n ?? 0) + 1 });
        else was.n++;
      }
    }
    below += worstBy.size;
    console.log(`${theme} ${path}: ${texts.length} texts, ${worstBy.size} kinds below`);
    for (const [k, v] of [...worstBy].sort((a, c) => a[1].least - c[1].least)) console.log(`     ${v.least.toFixed(2)}  ${k}  x${v.n}  "${v.text}"`);
    await p.close();
  }
  await ctx.close();
}
console.log(below ? `${below} kinds of text below their contrast` : 'every text holds its contrast on the painted surfaces');
await b.close();
process.exit(below ? 1 : 0);
