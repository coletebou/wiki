// Trace one of Luca Pacioli's capitals into vector ink, in two layers: the letter, and the compass circles and ruled
// lines that built it. The letters are the frontispiece's name (src/assets/pacioli/, by scripts/set-pacioli.mjs).
//
// Pacioli's De divina proportione (Venice, 1509) closes with an alphabet of Roman capitals, each drawn in its square
// with compass and ruler; Leonardo drew the book's solids. Wikimedia Commons hosts a public-domain scan of each letter
// ("Luca Pacioli, De divina proportione, Letter C.jpg", and so on). Pacioli has no U: V serves, as in Roman
// inscriptions. The second O ("Letter O2.jpg") is the one used; the first's frame does not trace whole.
//   https://commons.wikimedia.org/wiki/File:Luca_Pacioli,_De_divina_proportione,_Letter_C.jpg
//
// Not part of the build: the traced files are committed, and this is how they were made. To make them again:
//   brew install potrace         (sharp comes with Astro)
//   node scripts/trace-pacioli.mjs "Letter C.jpg" out/C --open=6 --size=800 --margin=0.09 --prune=4 --grow=2
//   (D and X with --margin=0.14: their circles stand outside the square), then scripts/set-pacioli.mjs.
//
// Steps: find the letter's square from the long runs of ink that frame it; crop to it with a margin, leaving out the
// text beneath; flatten the paper (subtract a wide blur) and find the ink; close it, since the printed black is
// flecked with paper; open it wider than a hairline, so the letter survives and the construction does not; grow the
// letter back a little into the ink, for its serifs; fill its flecks, drop the knots where hairlines cross, prune the
// stubs of hairline left on it; and what ink is left, a hair clear of the letter, is the construction. Each layer is
// traced with potrace, and a json beside them says where the square and the letter's ink lie.
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [SRC, OUT, ...rest] = process.argv.slice(2);
const a = Object.fromEntries(rest.map((s) => s.replace(/^--/, '').split('=')));
const N = Number(a.size ?? 1100); // the square's side, in pixels, after scaling
const thresh = Number(a.thresh ?? 40);
const openR = Number(a.open ?? 5);
const grow = Number(a.grow ?? 3);

const meta = await sharp(SRC).metadata();
// First pass, small: find the square's frame from long runs of ink.
const pre = 1000 / meta.width;
const pw = Math.round(meta.width * pre), ph = Math.round(meta.height * pre);
const g0 = await sharp(SRC).greyscale().resize(pw, ph).raw().toBuffer();
const b0 = await sharp(SRC).greyscale().resize(pw, ph).blur(12).raw().toBuffer();
const ink0 = new Uint8Array(pw * ph);
for (let i = 0; i < pw * ph; i++) ink0[i] = b0[i] - g0[i] > 22 ? 1 : 0;
const ink1 = (x, y) => ink0[y * pw + x] || (y > 0 && ink0[(y - 1) * pw + x]) || (y < ph - 1 && ink0[(y + 1) * pw + x]);
const rowRun = (y) => { let best = 0, run = 0, gap = 0; for (let x = 0; x < pw; x++) { if (ink1(x, y)) { run += 1 + gap; gap = 0; } else if (run && gap < 4) gap++; else { run = 0; gap = 0; } best = Math.max(best, run); } return best; };
const inkc = (x, y) => ink0[y * pw + x] || (x > 0 && ink0[y * pw + x - 1]) || (x < pw - 1 && ink0[y * pw + x + 1]);
const colRun = (x, y0, y1) => { let best = 0, run = 0, gap = 0; for (let y = y0; y < y1; y++) { if (inkc(x, y)) { run += 1 + gap; gap = 0; } else if (run && gap < 4) gap++; else { run = 0; gap = 0; } best = Math.max(best, run); } return best; };
const rows = []; for (let y = 0; y < ph; y++) if (rowRun(y) > pw * 0.45) rows.push(y);
if (rows.length < 2) throw new Error(`no frame rows found in ${SRC}`);
const top = rows[0], bottom = rows[rows.length - 1];
const cols = []; for (let x = 0; x < pw; x++) if (colRun(x, top, bottom + 1) > (bottom - top) * 0.6) cols.push(x);
const left = cols[0], right = cols[cols.length - 1];
const side = Math.max(right - left, bottom - top);
// Some letters' circles stand outside the square (D, X): keep a margin all round, but nothing below (the text).
const m = Math.round(side * Number(a.margin ?? 0.09));
const crop = { left: Math.max(0, left - m), top: Math.max(0, top - m), width: 0, height: 0 };
crop.width = Math.min(pw - crop.left, right - left + 2 * m);
crop.height = Math.min(ph - crop.top, bottom - top + m + Math.round(side * 0.015));
const k = N / side; // scale from the small pass to the working size
const s = 1 / pre;
const W = Math.round(crop.width * k), H = Math.round(crop.height * k);
const base = sharp(SRC).greyscale().extract({ left: Math.round(crop.left * s), top: Math.round(crop.top * s), width: Math.round(crop.width * s), height: Math.round(crop.height * s) });
const grey = await base.clone().resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer();
const paper = await base.clone().resize(W, H).blur(Math.max(8, N / 60)).raw().toBuffer();
const ink = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) ink[i] = paper[i] - grey[i] > thresh || grey[i] < 90 ? 1 : 0;
// Blank whatever lies past the frame's bottom (the first words of the text), but keep the frame line itself.
const frameBottom = Math.round((bottom - crop.top) * k);
for (let y = frameBottom + Math.round(N * 0.012); y < H; y++) for (let x = 0; x < W; x++) ink[y * W + x] = 0;

// Morphology on a square structuring element, separable.
const pass = (src, r, isMax) => {
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = isMax ? 0 : 1; for (let d = -r; d <= r && (isMax ? !v : v); d++) { const xx = x + d; const p = xx < 0 || xx >= W ? 0 : src[y * W + xx]; v = isMax ? v | p : v & p; } tmp[y * W + x] = v; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = isMax ? 0 : 1; for (let d = -r; d <= r && (isMax ? !v : v); d++) { const yy = y + d; const p = yy < 0 || yy >= H ? 0 : tmp[yy * W + x]; v = isMax ? v | p : v & p; } out[y * W + x] = v; }
  return out;
};
const erode = (m, r) => pass(m, r, false), dilate = (m, r) => pass(m, r, true);
// The letter: what survives an opening wider than a hairline, grown back a little into the ink so its fine serifs
// and thin strokes come back with it.
// The printed black is flecked with paper: close it first, so the opening keeps the letter whole.
const close = (m, r) => erode(dilate(m, r), r);
const solid = close(ink, Number(a.close ?? 3));
let letter = close(dilate(erode(solid, openR), openR), 4);
for (let i = 0; i < grow; i++) { letter = dilate(letter, 2); for (let j = 0; j < W * H; j++) letter[j] &= solid[j]; }
// Any fleck of paper left inside the letter is filled: background is what the border reaches.
{
  const out = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) { const i = stack.pop(); if (out[i] || letter[i]) continue; out[i] = 1; const x = i % W, y = (i / W) | 0; if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1); if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W); }
  // Only small holes are flecks; a counter (the inside of an O or a D) is large and stays open.
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (letter[i] || out[i] || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    for (let c = 0; c < comp.length; c++) { const j = comp[c], x = j % W, y = (j / W) | 0; for (const q of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (q >= 0 && !letter[q] && !out[q] && !seen[q]) { seen[q] = 1; comp.push(q); } }
    if (comp.length < N * N * 0.004) for (const j of comp) letter[j] = 1;
  }
}
// Where hairlines cross they pile into small knots of ink the opening keeps; the letter is only its large pieces.
{
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!letter[i] || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    for (let c = 0; c < comp.length; c++) { const j = comp[c], x = j % W, y = (j / W) | 0; for (const q of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (q >= 0 && letter[q] && !seen[q]) { seen[q] = 1; comp.push(q); } }
    if (comp.length < N * N * Number(a.minpiece ?? 0.006)) for (const j of comp) letter[j] = 0;
  }
}
// The grown letter has kept short stubs of every hairline that met it: anything thinner than the prune is cut off.
if (Number(a.prune ?? 2) > 0) { const r = Number(a.prune ?? 2); letter = dilate(erode(letter, r), r); }
const constr = new Uint8Array(W * H);
// The construction: the rest of the ink, kept a hair clear of the letter so the two layers do not double up.
const halo = dilate(letter, 1);
for (let j = 0; j < W * H; j++) constr[j] = ink[j] && !halo[j] ? 1 : 0;

const pbm = (mask, file) => {
  const header = Buffer.from(`P4\n${W} ${H}\n`);
  const rowBytes = Math.ceil(W / 8);
  const body = Buffer.alloc(rowBytes * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) body[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
  writeFileSync(file, Buffer.concat([header, body]));
};
for (const [name, mask, turd] of [['letter', letter, 40], ['construction', constr, 12]]) {
  pbm(mask, `${OUT}-${name}.pbm`);
  execFileSync('potrace', ['-s', '-t', String(turd), '-O', String(a.opt ?? 1.0), '-a', '1.0', '--flat', '-o', `${OUT}-${name}.svg`, `${OUT}-${name}.pbm`]);
}
await sharp(grey, { raw: { width: W, height: H, channels: 1 } }).png().toFile(`${OUT}-crop.png`);
const sq = { x: Math.round((left - crop.left) * k), y: Math.round((top - crop.top) * k), side: N };
const bounds = { x0: W, x1: -1, y0: H, y1: -1 };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (letter[y * W + x]) { bounds.x0 = Math.min(bounds.x0, x); bounds.x1 = Math.max(bounds.x1, x); bounds.y0 = Math.min(bounds.y0, y); bounds.y1 = Math.max(bounds.y1, y); }
writeFileSync(`${OUT}.json`, JSON.stringify({ W, H, square: sq, ink: bounds }));
console.log(OUT, W, H, JSON.stringify(sq));
