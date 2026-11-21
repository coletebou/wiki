// Make the favicon (public/favicon.svg, favicon-32.png, apple-touch-icon.png): Pacioli's C, the first letter of the
// book's name, in brown ink on vellum, inside a ruled square, from the traced initial (src/assets/pacioli/initials).
// Committed, like the share card; this is how it was made. To make it again:  node scripts/favicon.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const src = readFileSync(at('../src/assets/pacioli/initials/C-letter.svg'), 'utf8');
const vb = src.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace('fill="#000"', 'fill="#2b1d12"');
// The letter's 896-unit box fitted into a 64-unit icon with a margin, on vellum, with a ruled square round it.
const k = 50 / vb[2];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="9" fill="#efe3c6"/><rect x="5" y="5" width="54" height="54" rx="2" fill="none" stroke="#2b1d12" stroke-opacity="0.45" stroke-width="1.2"/><g transform="translate(7 7) scale(${k.toFixed(5)}) translate(${-vb[0]} ${-vb[1]})">${inner}</g></svg>\n`;
writeFileSync(at('../public/favicon.svg'), svg);
for (const [file, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
  await sharp(Buffer.from(svg), { density: 72 * (size / 64) * 4 }).resize(size, size).png().toFile(at(`../public/${file}`));
}
console.log('favicon', svg.length, 'bytes');
