// Trace Leonardo's Vitruvian Man into vector ink: the drawing on the frontispiece (src/assets/vitruvian-man.svg).
//
// The source is Luc Viatour's photograph of the sheet in the Gallerie dell'Accademia, Venice, which Wikimedia
// Commons hosts as public domain, being a faithful photograph of a drawing long out of copyright ("Da Vinci Vitruve
// Luc Viatour.jpg", 2258 x 3070). The photographer asks for the credit "Luc Viatour / https://Lucnix.be" beside the
// image; the frontispiece and the About page give it.
//   https://upload.wikimedia.org/wikipedia/commons/2/22/Da_Vinci_Vitruve_Luc_Viatour.jpg
//   sha256 a4b9fa3f4ae65266c8f5... (the first twenty digits)
//
// Not part of the build: the traced file is committed, and this is how it was made. To make it again:
//   (sharp, the image library it uses, comes with Astro)
//   brew install potrace         (or your system's package)
//   node scripts/trace-vitruvian.mjs path/to/Da_Vinci_Vitruve_Luc_Viatour.jpg
//
// Steps: crop to the drawing (the handwriting above it through the scale beneath it), grey, flatten the paper
// (subtract a wide blur, so stains and uneven tone drop out and only ink darker than its surroundings is kept),
// find the ink with two thresholds, drop the paper's flecks and the later marks in the margins, carry the circle
// across the places where its ink is too faint to hold, and trace what is left with potrace. The numbers below are
// the ones the committed file was made with.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [SRC, outArg, ...rest] = process.argv.slice(2);
if (!SRC) {
  console.error('usage: node scripts/trace-vitruvian.mjs <scan.jpg> [out.svg] [--scale=0.5 --thresh=28 --lo=14 ...]');
  process.exit(2);
}
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('trace-vitruvian needs sharp, which comes with Astro: run npm ci first');
  process.exit(2);
}
const args = Object.fromEntries([outArg, ...rest].filter((a) => a?.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')));
const OUT = outArg && !outArg.startsWith('--') ? outArg : fileURLToPath(new URL('../src/assets/vitruvian-man.svg', import.meta.url));
const out = join(tmpdir(), `vitruvian-${process.pid}`);
const scale = Number(args.scale ?? 0.5);
const thresh = Number(args.thresh ?? 28);
const blur = Number(args.blur ?? 28);
const turd = Number(args.turd ?? 4);
const opt = Number(args.opt ?? 1);
const alpha = Number(args.alpha ?? 1.1);
// The drawing on the 2258 x 3070 scan: left, top, width, height.
const CROP = (args.crop ?? '68,56,2111,2360').split(',').map(Number);

const base = sharp(SRC).extract({ left: CROP[0], top: CROP[1], width: CROP[2], height: CROP[3] }).greyscale().toColourspace('b-w');
const W = Math.round(CROP[2] * scale);
const H = Math.round(CROP[3] * scale);
const { data: grey, info } = await base.clone().resize(W, H, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
if (info.channels !== 1 || grey.length !== W * H) throw new Error(`expected one channel of ${W * H} bytes, got ${info.channels} channels and ${grey.length} bytes`);
const paper = await base.clone().resize(W, H).blur(blur * scale).raw().toBuffer();
if (paper.length !== W * H) throw new Error('the paper estimate is not one channel');
// A light blur of the ink itself joins the grain of a pen stroke into one line.
const soft = await sharp(grey, { raw: { width: W, height: H, channels: 1 } }).blur(Math.max(0.3, Number(args.soft ?? 0.5) * scale)).toColourspace('b-w').raw().toBuffer();
if (soft.length !== W * H) throw new Error(`the softened ink is ${soft.length} bytes, not ${W * H}`);

// Later hands and time left marks that are not the drawing: a shelf mark, a folio number, a few stains. Lifted here,
// each a rectangle on the crop at full size: left, top, width, height.
const LIFT = [
  [370, 0, 110, 44],
  [1985, 0, 126, 52],
  [0, 40, 95, 115],
  [630, 1285, 72, 52],
  [1360, 1350, 40, 40],
  [1520, 1456, 38, 38],
  [794, 1106, 34, 34],
];
const lo = Number(args.lo ?? 14);
const dark = new Int16Array(W * H);
for (let i = 0; i < W * H; i++) dark[i] = paper[i] - soft[i];
for (const [l, t, w, h] of LIFT) {
  for (let y = Math.floor(t * scale); y < Math.min(H, Math.ceil((t + h) * scale)); y++)
    for (let x = Math.floor(l * scale); x < Math.min(W, Math.ceil((l + w) * scale)); x++) dark[y * W + x] = 0;
}
// Two thresholds, as an eye reads a faint line: ink dark enough is ink; fainter ink counts only where it touches
// ink already found. A pen line that thins keeps its length, and the grain of the paper, which touches nothing, goes.
const bits = Buffer.alloc(W * H);
const stack = [];
for (let i = 0; i < W * H; i++) {
  if (dark[i] > thresh) {
    bits[i] = 1;
    stack.push(i);
  }
}
while (stack.length) {
  const i = stack.pop();
  const x = i % W;
  const y = (i - x) / W;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (!bits[n] && dark[n] > lo) {
        bits[n] = 1;
        stack.push(n);
      }
    }
  }
}
// What is left that is not a pen's work: the flecks of the paper's own grain. A fleck is small, short and faint; a
// stroke of hatching is long, and a letter is dark. Each joined patch of ink is weighed, and the flecks dropped.
// (In the two bands of handwriting every mark is kept but the smallest: a letter can be as small as a fleck.)
// The circle (centre and radius) and the square (left, right, top, bottom) on the crop at full size, as measured.
const CIRCLE = [1059.6, 1217.4, 968.4];
const SQUARE = [262, 1864, 602, 2166];
const TEXT_BELOW = 2236 * scale;
/** How far down the handwriting above the drawing reaches, at a given x: its last lines stop short in the middle. */
const textFloor = (x) => {
  const at = x / scale;
  return (at < 700 ? 390 : at > 1530 ? 430 : at < 835 || at > 1325 ? 335 : 285) * scale;
};
const minLong = Number(args.long ?? 32) * scale;
const minArea = Number(args.area ?? 190) * scale * scale;

/** Every joined patch of ink, weighed: `keep` is asked of each, and a patch it refuses is taken off the sheet. */
function sweep(keep) {
  const seen = new Uint8Array(W * H);
  let dropped = 0;
  for (let start = 0; start < W * H; start++) {
    if (!bits[start] || seen[start]) continue;
    const patch = [start];
    seen[start] = 1;
    let [x0, y0, x1, y1, darkest] = [W, H, 0, 0, 0];
    for (let k = 0; k < patch.length; k++) {
      const i = patch[k];
      const x = i % W;
      const y = (i - x) / W;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (dark[i] > darkest) darkest = dark[i];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx;
          if (bits[n] && !seen[n]) {
            seen[n] = 1;
            patch.push(n);
          }
        }
      }
    }
    const above = y1 < textFloor((x0 + x1) / 2);
    const inText = above || y0 > TEXT_BELOW;
    if (!keep({ area: patch.length, long: Math.max(x1 - x0, y1 - y0) + 1, darkest, inText, above, x0, y0, x1, y1 })) {
      dropped++;
      for (const i of patch) bits[i] = 0;
    }
  }
  return dropped;
}

// The circle is one line, struck with compasses, and in places its ink is too thin and too broken for any rule that
// keeps the paper's grain out. So its course is found first: round the measured circle, the darkest track within a
// few pixels of it. What ink lies on that course is kept whatever its size, and where there is none the line is
// carried across (at the end, below).
const course = (() => {
  const [cx, cy, R] = CIRCLE.map((v) => v * scale);
  const N = Math.ceil(2 * Math.PI * R * 1.5);
  const B = Math.round(Number(args.ring ?? 22) * scale); // how far from the measured circle the line may lie
  const span = 4 * B + 1; // in half pixels
  const at = (k, o) => [cx + (R + o) * Math.cos((k / N) * 2 * Math.PI), cy + (R + o) * Math.sin((k / N) * 2 * Math.PI)];
  const raw = new Float32Array(N * span);
  for (let k = 0; k < N; k++) {
    for (let s = 0; s < span; s++) {
      const [x, y] = at(k, (s - 2 * B) / 2).map(Math.round);
      raw[k * span + s] = x < 0 || y < 0 || x >= W || y >= H ? 0 : Math.max(0, dark[y * W + x]);
    }
  }
  // Averaged along the line, so that one grain of the paper does not pass for a stroke.
  const win = 7;
  const offset = new Float32Array(N);
  const strength = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    let best = -1;
    for (let s = 0; s < span; s++) {
      let sum = 0;
      for (let d = -win; d <= win; d++) sum += raw[((k + d + N) % N) * span + s];
      if (sum > best) [best, offset[k]] = [sum, (s - 2 * B) / 2];
    }
    strength[k] = best / (2 * win + 1);
  }
  // Where the line shows plainly its place is taken as read (the middle of the readings round about, so that a
  // finger or a letter crossing it does not pull it aside); elsewhere it runs straight between such places.
  const sure = Number(args.sure ?? 9);
  const reach = 45;
  const known = new Float32Array(N).fill(NaN);
  for (let k = 0; k < N; k++) {
    const seen = [];
    for (let d = -reach; d <= reach; d++) {
      const i = (k + d + N) % N;
      if (strength[i] >= sure) seen.push(offset[i]);
    }
    if (seen.length >= reach / 2) known[k] = seen.sort((a, b) => a - b)[seen.length >> 1];
  }
  const track = new Float32Array(N);
  const first = known.findIndex((v) => !Number.isNaN(v));
  if (first < 0) return null;
  for (let n = 0, prev = first; n < N; ) {
    let next = prev + 1;
    while (Number.isNaN(known[next % N])) next++;
    for (let k = prev; k <= next; k++) track[k % N] = known[prev % N] + ((known[next % N] - known[prev % N]) * (k - prev)) / (next - prev);
    n += next - prev;
    prev = next;
  }
  /** Whether a point lies on the circle's course (within a pen's width or so of it). */
  const on = (x, y) => {
    const k = Math.round((Math.atan2(y - cy, x - cx) / (2 * Math.PI)) * N + N) % N;
    return Math.abs(Math.hypot(x - cx, y - cy) - R - track[k]) <= 2.5;
  };
  return { N, at, track, on };
})();

// First the flecks that are plainly flecks, and the margins.
let dropped = sweep(({ area, long, darkest, inText, above, x0, y0, x1, y1 }) => {
  // The margins hold nothing of Leonardo's: beside the handwriting, and outside both the circle and the square.
  const [mx, my] = [(x0 + x1) / 2 / scale, (y0 + y1) / 2 / scale];
  const inMargin = above
    ? x1 < 215 * scale || x0 > 2010 * scale
    : y0 > TEXT_BELOW
      ? x1 < 225 * scale || x0 > 1960 * scale
      : Math.hypot(mx - CIRCLE[0], my - CIRCLE[1]) > CIRCLE[2] + 16 && (mx < SQUARE[0] - 16 || mx > SQUARE[1] + 16 || my < SQUARE[2] - 16 || my > SQUARE[3] + 16);
  if (inMargin) return false;
  if (course?.on((x0 + x1) / 2, (y0 + y1) / 2) && long <= 60 * scale) return true;
  return inText
    ? (darkest >= 52 && area >= 5) || area >= 60 * scale * scale
    : area >= minArea || (long >= minLong && darkest >= 40) || (darkest >= 72 && area >= 30 * scale * scale + 4);
});

// Then the flecks that passed for strokes. Hatching stands among other strokes; a fleck stands alone. With the
// plain flecks gone, how much ink lies round each point tells the two apart (the handwriting is left as it is).
const near = await sharp(Buffer.from(bits.map((b) => (b ? 255 : 0))), { raw: { width: W, height: H, channels: 1 } })
  .blur(Number(args.near ?? 44) * scale)
  .toColourspace('b-w')
  .raw()
  .toBuffer();
if (near.length !== W * H) throw new Error('the ink-density map is not one channel');
const company = Number(args.company ?? 18);
dropped += sweep(({ area, long, inText, x0, y0, x1, y1 }) => inText || area >= minArea * 2.2 || (course?.on((x0 + x1) / 2, (y0 + y1) / 2) && long <= 60 * scale) || near[Math.round((y0 + y1) / 2) * W + Math.round((x0 + x1) / 2)] >= company);

// Last, the circle is inked wherever the sheet so far has a gap in it, along the course found for it above.
const followed = (() => {
  if (!course) return { inked: 0, of: 0 };
  const { N, at, track } = course;
  let inked = 0;
  for (let k = 0; k < N; k++) {
    let has = false;
    for (let o = -2.5; o <= 2.5 && !has; o += 0.5) {
      const [x, y] = at(k, track[k] + o).map(Math.round);
      has = x >= 0 && y >= 0 && x < W && y < H && bits[y * W + x] === 1;
    }
    if (has) continue;
    inked++;
    const [px, py] = at(k, track[k]);
    for (let y = Math.floor(py - 1); y <= Math.ceil(py + 1); y++)
      for (let x = Math.floor(px - 1); x <= Math.ceil(px + 1); x++)
        if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(x - px, y - py) <= 0.95) bits[y * W + x] = 2;
  }
  for (let i = 0; i < W * H; i++) if (bits[i] === 2) bits[i] = 1;
  return { inked, of: N };
})();

let ink = 0;
for (let i = 0; i < W * H; i++) ink += bits[i];
// PBM (P4): 1 is black.
const rowBytes = Math.ceil(W / 8);
const pbm = Buffer.alloc(rowBytes * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bits[y * W + x]) pbm[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
writeFileSync(`${out}.pbm`, Buffer.concat([Buffer.from(`P4\n${W} ${H}\n`), pbm]));
if (args.bits) await sharp(Buffer.from(bits.map((b) => (b ? 0 : 255))), { raw: { width: W, height: H, channels: 1 } }).png().toFile(args.bits);

execFileSync('potrace', [`${out}.pbm`, '-s', '-t', String(turd), '-a', String(alpha), '-O', String(opt), '-o', `${out}.svg`]);
const svg = readFileSync(`${out}.svg`, 'utf8');
const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
// One path, in potrace's own units (tenths of a pixel, y upward), turned upright by the group's transform.
const compact = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><g transform="translate(0,${H}) scale(0.1,-0.1)"><path d="${paths.join('')}"/></g></svg>\n`;
writeFileSync(OUT, compact);
rmSync(`${out}.pbm`, { force: true });
rmSync(`${out}.svg`, { force: true });
console.log(JSON.stringify({ out: OUT, W, H, inkPct: ((ink / (W * H)) * 100).toFixed(2), flecksDropped: dropped, circleFollowed: `${followed.inked} of ${followed.of}`, paths: paths.length, svgBytes: compact.length }));
