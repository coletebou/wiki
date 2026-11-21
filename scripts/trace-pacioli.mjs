// Trace one of Luca Pacioli's capitals into vector ink, in two layers: the letter, and the compass circles and ruled
// lines that built it: for the frontispiece's name, the masthead and every folio's initial (src/assets/pacioli/, set
// by scripts/set-pacioli.mjs).
//
// Pacioli's De divina proportione (Venice, 1509) closes with an alphabet of Roman capitals, each drawn in its square
// with compass and ruler; Leonardo drew the book's solids. Wikimedia Commons hosts a public-domain scan of each letter
// ("Luca Pacioli, De divina proportione, Letter C.jpg", and so on). Pacioli has no U: V serves, as in Roman
// inscriptions. The second O ("Letter O2.jpg") is the one used; the first's frame does not trace whole.
//   https://commons.wikimedia.org/wiki/File:Luca_Pacioli,_De_divina_proportione,_Letter_C.jpg
//
// Not part of the build: the traced files are committed, and this is how they were made. To make them again:
//   brew install potrace         (sharp comes with Astro)
//   for L in A B C D E F G H I K L M N O2 P Q R S T V X Y; do
//     node scripts/trace-pacioli.mjs "Letter $L.jpg" out/$L --open=6 --size=800 --margin=0.14 --prune=4 --grow=2
//   done
//   node scripts/set-pacioli.mjs out
//
// Steps: find the letter's square from its upright sides; crop to it with a margin; take out the text beneath; flatten the paper (subtract a wide blur) and find the ink; close it, since the printed black is
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
// First pass, small: find the square that frames the letter.
const pre = 1000 / meta.width;
const pw = Math.round(meta.width * pre), ph = Math.round(meta.height * pre);
const g0 = await sharp(SRC).greyscale().resize(pw, ph).raw().toBuffer();
const b0 = await sharp(SRC).greyscale().resize(pw, ph).blur(12).raw().toBuffer();
const ink0 = new Uint8Array(pw * ph);
for (let i = 0; i < pw * ph; i++) ink0[i] = b0[i] - g0[i] > 22 ? 1 : 0;
const inkc = (x, y) => ink0[y * pw + x] || (x > 0 && ink0[y * pw + x - 1]) || (x < pw - 1 && ink0[y * pw + x + 1]);
const colRun = (x, y0, y1) => { let best = 0, run = 0, gap = 0; for (let y = y0; y < y1; y++) { if (inkc(x, y)) { run += 1 + gap; gap = 0; } else if (run && gap < 8) gap++; else { run = 0; gap = 0; } best = Math.max(best, run); } return best; };
// The square's sides are the longest upright lines on the page: a line of the text beneath can look like a rule,
// but nothing in it stands upright. Its top and bottom are where those sides begin and end.
const segment = (x) => {
  let best = [0, 0], start = -1, gap = 0;
  for (let y = 0; y <= ph; y++) {
    const on = y < ph && inkc(x, y);
    if (on) { if (start < 0) start = y; gap = 0; }
    else if (start >= 0 && gap < 8 && y < ph) gap++;
    else if (start >= 0) { if (y - gap - start > best[1] - best[0]) best = [start, y - gap]; start = -1; gap = 0; }
  }
  return best;
};
// Every upright long enough, gathered into the lines they make (a line is a few pixels wide); the square is the
// widest pair of them about as far apart as they are tall. A letter's own stem (I, Y) stands upright too, but with
// no partner at the right distance. A side is often broken where a circle meets it (F), so it may measure short;
// Pacioli's frames are true squares, and the side is taken from the width.
const ups = [];
for (let x = 0; x < pw; x++) {
  if (colRun(x, 0, ph) <= ph * 0.3) continue;
  const [y0, y1] = segment(x);
  const last = ups[ups.length - 1];
  if (last && x - last.x1 <= 3) { last.x1 = x; if (y1 - y0 > last.y1 - last.y0) Object.assign(last, { y0, y1 }); }
  else ups.push({ x0: x, x1: x, y0, y1 });
}
let pair = null;
for (const p of ups) for (const q of ups) {
  const w = q.x1 - p.x0, h = Math.max(p.y1, q.y1) - Math.min(p.y0, q.y0);
  if (w < pw * 0.4 || h < w * 0.6 || h > w * 1.08) continue;
  if (!pair || w > pair.w) pair = { p, q, w };
}
if (!pair) throw new Error(`no square found in ${SRC}: uprights ${JSON.stringify(ups)}`);
const left = pair.p.x0, right = pair.q.x1;
const lt = pair.p.y0, rt = pair.q.y0;
const side = right - left;
const top = Math.min(lt, rt), bottom = top + side;
// Some letters stand outside their square: circles beside it (D, M, X, Y), A's apex above it, Q's tail below it. Keep
// a margin all round, and more below; the text beneath is taken out later, piece by piece.
const m = Math.round(side * Number(a.margin ?? 0.09));
const crop = { left: Math.max(0, left - m), top: Math.max(0, top - Math.round(side * 0.24)), width: 0, height: 0 };
crop.width = Math.min(pw - crop.left, right + Math.max(m, Math.round(side * 0.42)) - crop.left);
crop.height = Math.min(ph - crop.top, bottom + Math.round(side * 0.5) - crop.top);
const k = N / side; // scale from the small pass to the working size
const s = 1 / pre;
const W = Math.round(crop.width * k), H = Math.round(crop.height * k);
const full = { left: Math.round(crop.left * s), top: Math.round(crop.top * s) };
full.width = Math.min(meta.width - full.left, Math.round(crop.width * s));
full.height = Math.min(meta.height - full.top, Math.round(crop.height * s));
const base = sharp(SRC).greyscale().extract(full);
const grey = await base.clone().resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer();
const paper = await base.clone().resize(W, H).blur(Math.max(8, N / 60)).raw().toBuffer();
const ink = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) ink[i] = paper[i] - grey[i] > thresh || grey[i] < 90 ? 1 : 0;
// The text beneath the square: every piece of ink that starts below the frame's bottom line. A piece that reaches up
// into the square (Q's tail) is the letter's, and stays.
{
  const frameBottom = Math.round((bottom - crop.top) * k) + Math.round(N * 0.012);
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!ink[i] || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    let top = H;
    for (let c = 0; c < comp.length; c++) {
      const j = comp[c], x = j % W, y = (j / W) | 0;
      if (y < top) top = y;
      for (const q of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (q >= 0 && ink[q] && !seen[q]) { seen[q] = 1; comp.push(q); }
    }
    if (top > frameBottom) for (const j of comp) ink[j] = 0;
  }
}

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
