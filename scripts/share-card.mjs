// Make the share card (public/og.jpg, 1200 x 630): the picture a link to the wiki's front page shows when it is posted
// somewhere. Each folio has a card of its own, drawn with the build (src/pages/og/[slug].jpg.ts).
// It is the frontispiece itself, rearranged to the card's shape: the name in Pacioli's capitals on the left, Leonardo's man on
// the right. Like the traced drawing, the card is committed and this is how it was made; it is not part of the build.
//
// It needs a browser to draw with, which the site itself does not:
//   npm install --no-save playwright-core && npx playwright-core install chromium
//   npm run build && npx astro preview --port 4391 &
//   node scripts/share-card.mjs http://127.0.0.1:4391
import { fileURLToPath } from 'node:url';

const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/share-card.mjs <the address of a running preview of the site>');
  process.exit(2);
}
let chromium;
let sharp;
try {
  ({ chromium } = await import('playwright-core'));
  sharp = (await import('sharp')).default;
} catch {
  console.error('share-card needs playwright-core (see the head of this file) and sharp, which comes with Astro');
  process.exit(2);
}

// The frontispiece, laid out as a card. Everything on it is the page's own: only the arrangement is new.
const CARD = `
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  .skip, .masthead, .colophon, .lumen, .leaf-under, .leaf::before, .running-head, .seek-large, .vt-credit, .vt-margin,
  .frontispiece ~ *, dialog { display: none !important; }
  .leaf { max-width: none; width: 1200px; height: 630px; margin: 0; }
  .leaf-sheet { height: 630px; -webkit-mask-box-image: none; mask-border: none; }
  .folio { padding: 0; }
  .frontispiece {
    display: grid; grid-template-columns: minmax(0, 1fr) 424px; grid-template-rows: auto auto auto auto 1fr; column-gap: 30px;
    height: 630px; padding: 54px 46px 44px 64px; text-align: left;
  }
  .frontispiece > * { grid-column: 1; min-width: 0; }
  .frontispiece .greek { font-size: 18px; margin-top: 30px; }
  .frontispiece h1 { width: 640px; margin: 22px 0 0; }
  .frontispiece .beast { font-size: 36px; margin-top: 20px; }
  .frontispiece .being { max-width: 590px; margin: 28px 0 0; font-size: 25px; line-height: 1.42; text-wrap: pretty; }
  .vitruvian { grid-column: 2; grid-row: 1 / -1; align-self: center; width: 424px; margin: 0; }
  .vt-sheet { animation: none !important; }
`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2, colorScheme: 'light', reducedMotion: 'reduce' });
await page.addInitScript(() => {
  try {
    localStorage.setItem('codex-theme', 'vellum');
    sessionStorage.setItem('codex-drawn', '1');
  } catch {}
});
await page.goto(base, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: CARD });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();

const out = fileURLToPath(new URL('../public/og.jpg', import.meta.url));
const info = await sharp(shot).resize(1200, 630).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
console.log(`${out}: ${info.width} x ${info.height}, ${info.size} bytes`);
