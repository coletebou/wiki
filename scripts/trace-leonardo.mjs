// Trace one of Leonardo's pen sketches into vector ink: the machines round the Vitruvian man, the plate of studies,
// and the outer margin of every folio (src/assets/leonardo/). The way the Vitruvian man was traced (scripts/trace-vitruvian.mjs), for any sheet: crop to
// the sketch, flatten the paper, find the ink at two thresholds, drop the paper's flecks, trace with potrace.
//
// The sheets are the Biblioteca Ambrosiana's scans of the Codex Atlanticus and the Institut de France's of Manuscript
// B, which Wikimedia Commons hosts as public domain (faithful photographs of drawings long out of copyright):
//   https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_Ambrosiana-Codice-Atlantico-Codex-Atlanticus-f-21-recto.jpg
//   https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_Ambrosiana-Codice-Atlantico-Codex-Atlanticus-f-272-verso.jpg
//   https://commons.wikimedia.org/wiki/File:Leonardo_da_vinci,_Flying_machine.jpg
//   https://commons.wikimedia.org/wiki/File:Vinci,_Leonardo_Da_-_Volano_(meccanica).jpg
//   https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_helicopter_and_lifting_wing.jpg
//   https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_Ms._H_45v_-_Viola_organista.jpg
//   https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_RCIN_912660,_Studies_of_water_c.1510-12.jpg
//   https://commons.wikimedia.org/wiki/File:Leonardo_da_Vinci_-_zamek_drzwiowy_(Kodeks_Madrycki).jpg
//
// Not part of the build: the traced files are committed, and this is how they were made (each at 1920 pixels wide,
// the size Commons serves; the crops below are on that size). To make them again:
//   brew install potrace         (sharp comes with Astro)
//   node scripts/trace-leonardo.mjs <sheet.jpg> <out.svg> --crop=left,top,width,height [--thresh=34 --lo=16 ...]
//   rotae      Codex Atlanticus f. 21r, the winch    --crop=860,20,940,880 --size=520
//   veru       Codex Atlanticus f. 21r, the smoke-jack   --crop=790,880,560,1360 --size=520
//   volatus    Manuscript B, the vertical flying machine (804 wide)   --crop=20,200,780,700 --size=520
//   geometria  Codex Atlanticus f. 272v   --crop=240,370,290,290 --size=520 --thresh=20 --lo=9 --blur=10 --area=40 --long=14
//   volano     the flywheel press, Codex Atlanticus   --crop=30,20,1860,1700 --size=520 --thresh=26 --lo=12
//   cochlea    the aerial screw, Manuscript B (364 wide)   --crop=15,5,335,240 --size=520 --thresh=30 --lo=14 --blur=8
//   clavis     the viola organista's keyboard, Manuscript H f. 45v (652 wide)   --crop=20,0,630,289 --size=520 --thresh=16 --lo=8 --blur=10 --area=30 --long=12
//   flumen     water past an obstacle, Windsor RCIN 912660 (1439 wide)   --crop=110,310,650,490 --size=520 --thresh=24 --lo=11
//   porta      a door's lock, Codex Madrid I (324 wide)   --crop=0,0,324,200 --size=520 --thresh=22 --lo=10 --blur=8
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const [SRC, OUT, ...rest] = process.argv.slice(2);
if (!SRC || !OUT) {
  console.error('usage: node scripts/trace-leonardo.mjs <sheet.jpg> <out.svg> --crop=left,top,width,height [--thresh= --lo= --blur= --area= --size=]');
  process.exit(2);
}
const a = Object.fromEntries(rest.map((s) => s.replace(/^--/, '').split('=')));
const [cl, ct, cw, ch] = (a.crop ?? '').split(',').map(Number);
if (![cl, ct, cw, ch].every(Number.isFinite)) throw new Error('--crop=left,top,width,height is needed');
const thresh = Number(a.thresh ?? 34); // ink: this much darker than the paper round it
const lo = Number(a.lo ?? 16); // fainter ink, kept where it touches ink
const size = Number(a.size ?? 900); // the longer side, traced at
const k = size / Math.max(cw, ch);
const W = Math.round(cw * k), H = Math.round(ch * k);
const base = sharp(SRC).extract({ left: cl, top: ct, width: cw, height: ch }).greyscale().toColourspace('b-w');
const grey = await base.clone().resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer();
// The paper: a wide blur, so stains and the sheet's tone fall away and only ink darker than its surroundings is kept.
const paper = await base.clone().resize(W, H).blur(Number(a.blur ?? 14)).raw().toBuffer();
const soft = await sharp(grey, { raw: { width: W, height: H, channels: 1 } }).blur(0.5).toColourspace('b-w').raw().toBuffer();
if (grey.length !== W * H || paper.length !== W * H || soft.length !== W * H) throw new Error('expected one channel');
const strong = new Uint8Array(W * H), weak = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  const d = paper[i] - soft[i];
  strong[i] = d > thresh ? 1 : 0;
  weak[i] = d > lo ? 1 : 0;
}
// Fainter ink that touches ink: a pen line that thins keeps its length; the grain of the paper, touching nothing, goes.
const ink = strong.slice();
{
  const stack = [];
  for (let i = 0; i < W * H; i++) if (ink[i]) stack.push(i);
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const j = yy * W + xx;
      if (!ink[j] && weak[j]) { ink[j] = 1; stack.push(j); }
    }
  }
}
// The paper's flecks: small patches that are neither long nor many.
{
  const minArea = Number(a.area ?? 24), minLong = Number(a.long ?? 10);
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!ink[i] || seen[i]) continue;
    const comp = [i]; seen[i] = 1;
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let c = 0; c < comp.length; c++) {
      const j = comp[c], x = j % W, y = (j / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, y > 0 ? j - W : -1, y < H - 1 ? j + W : -1]) if (q >= 0 && ink[q] && !seen[q]) { seen[q] = 1; comp.push(q); }
    }
    if (comp.length < minArea && Math.max(x1 - x0, y1 - y0) < minLong) for (const j of comp) ink[j] = 0;
  }
}
const tmp = join(tmpdir(), `leonardo-${process.pid}.pbm`);
const rowBytes = Math.ceil(W / 8);
const body = Buffer.alloc(rowBytes * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink[y * W + x]) body[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
writeFileSync(tmp, Buffer.concat([Buffer.from(`P4\n${W} ${H}\n`), body]));
execFileSync('potrace', ['-s', '-t', String(a.turd ?? 3), '-O', String(a.opt ?? 0.8), '-a', '1.0', '--flat', '-o', OUT, tmp]);
rmSync(tmp);
// Plain SVG: the drawing in black on nothing, at its own size, for a mask.
const svg = readFileSync(OUT, 'utf8');
const g = svg.match(/<g transform="([^"]+)"[^>]*>([\s\S]*)<\/g>/);
writeFileSync(OUT, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><g fill="#000" transform="${g[1]}">${g[2].trim()}</g></svg>\n`);
console.log(OUT, W, H, readFileSync(OUT).length, 'bytes');
