// Set the book's name in Pacioli's capitals, from letters traced by scripts/trace-pacioli.mjs, into the files the
// wordmark uses (src/components/Wordmark.astro):
//   codex-tebou-letters.svg and codex-tebou-construction.svg  built: each letter in its square, as Pacioli drew it,
//                                                               a square apart and a little more, the words parted
//                                                               by a Roman interpunct
//   codex-tebou-set.svg                                        set: the letters alone, spaced by their ink
//   initials/<L>-letter.svg and initials/<L>-construction.svg  each letter alone in its square, for the initial that
//                                                               opens a folio (src/components/Initial.astro). W is two
//                                                               V's crossed, as printers made it before there was one.
// Not part of the build: the files are committed. To make them again:
//   node scripts/set-pacioli.mjs <dir of traced letters> [out dir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [DIR, OUTARG] = process.argv.slice(2);
if (!DIR) {
  console.error('usage: node scripts/set-pacioli.mjs <dir of traced letters> [out dir]');
  process.exit(2);
}
const OUT = OUTARG ?? fileURLToPath(new URL('../src/assets/pacioli/', import.meta.url));
const WORDS = ['CODEX', 'TEBOU'];
const SIDE = 800; // the square's side in the traced files
const FILE = { O: 'O2', U: 'V' };
const PITCH = 1.1 * SIDE; // built: square to square
const GAP = 0.5 * SIDE; // built: between the words
const TRACK = 0.13 * SIDE; // set: ink to ink
const SET_GAP = 0.55 * SIDE; // set: between the words

const glyph = (L, layer) => {
  const f = join(DIR, FILE[L] ?? L);
  const g = readFileSync(`${f}-${layer}.svg`, 'utf8').match(/<g transform="([^"]+)"[^>]*>([\s\S]*)<\/g>/);
  if (!g) throw new Error(`${f}-${layer}.svg is not a potrace file`);
  return { transform: g[1], body: g[2].trim(), ...JSON.parse(readFileSync(`${f}.json`, 'utf8')) };
};
// A Roman interpunct: a small triangle, point down, at the middle of the line.
const interpunct = (cx) => {
  const cy = SIDE * 0.52, r = SIDE * 0.05;
  return `<path d="M${(cx - r).toFixed(1)} ${(cy - r * 0.75).toFixed(1)}L${(cx + r).toFixed(1)} ${(cy - r * 0.75).toFixed(1)}L${cx.toFixed(1)} ${(cy + r).toFixed(1)}Z"/>`;
};
const file = (viewBox, defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><defs>${[...defs.values()].join('')}</defs><g fill="#000">${body}</g></svg>\n`;
const use = (defs, id, g, x, y) => {
  if (!defs.has(id)) defs.set(id, `<g id="${id}" transform="${g.transform}">${g.body}</g>`);
  return `<use href="#${id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"/>`;
};

// Built.
{
  const layers = { letter: { defs: new Map(), body: '' }, construction: { defs: new Map(), body: '' } };
  let x = 0, end = 0;
  WORDS.forEach((word, wi) => {
    if (wi > 0) {
      layers.letter.body += interpunct(end + GAP / 2);
      x = end + GAP;
    }
    [...word].forEach((L, i) => {
      const at = x + i * PITCH;
      for (const layer of ['letter', 'construction']) {
        const g = glyph(L, layer);
        layers[layer].body += use(layers[layer].defs, `${layer[0]}${FILE[L] ?? L}`, g, at - g.square.x, -g.square.y);
      }
      end = at + SIDE;
    });
  });
  const M = 75;
  const vb = `${-M} ${-M} ${(end + 2 * M).toFixed(0)} ${SIDE + M + 14}`;
  writeFileSync(join(OUT, 'codex-tebou-letters.svg'), file(vb, layers.letter.defs, layers.letter.body));
  writeFileSync(join(OUT, 'codex-tebou-construction.svg'), file(vb, layers.construction.defs, layers.construction.body));
  console.log('built', vb);
}
// Set.
{
  const defs = new Map();
  let body = '', x = 0;
  WORDS.forEach((word, wi) => {
    if (wi > 0) {
      body += interpunct(x - TRACK + SET_GAP / 2);
      x += SET_GAP - TRACK;
    }
    for (const L of word) {
      const g = glyph(L, 'letter');
      body += use(defs, `g${FILE[L] ?? L}`, g, x - g.ink.x0, -g.square.y);
      x += g.ink.x1 - g.ink.x0 + TRACK;
    }
  });
  const vb = `-10 -10 ${(x - TRACK + 20).toFixed(0)} ${SIDE + 30}`;
  writeFileSync(join(OUT, 'codex-tebou-set.svg'), file(vb, defs, body));
  console.log('set', vb);
}
// Initials: every letter Pacioli drew, in its square with a narrow margin. The construction is cut at the margin; the
// letter never is, so where it stands out of its square (A's apex, Q's tail) the drawing is that much larger, and
// initials/index.json says each one's box.
{
  const dir = join(OUT, 'initials');
  mkdirSync(dir, { recursive: true });
  const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'V', 'X', 'Y'];
  const m = Math.round(0.06 * SIDE);
  const boxes = {};
  // One letter in square coordinates (the square from 0 to SIDE), squeezed by `sx` and moved by `dx` (for W).
  const one = (L, layer, dx = 0, sx = 1) => {
    const g = glyph(L, layer);
    const place = dx || sx !== 1 ? `translate(${dx.toFixed(1)} 0) scale(${sx} 1) ` : '';
    return { svg: `<g transform="${place}translate(${-g.square.x} ${-g.square.y})"><g transform="${g.transform}">${g.body}</g></g>`, g, dx, sx };
  };
  const write = (name, parts) => {
    // The box: the square and its margin, and all of the letter's ink.
    let [x0, y0, x1, y1] = [-m, -m, SIDE + m, SIDE + m];
    for (const { g, dx, sx } of parts.letter) {
      x0 = Math.min(x0, dx + (g.ink.x0 - g.square.x) * sx - 4);
      x1 = Math.max(x1, dx + (g.ink.x1 - g.square.x) * sx + 4);
      y0 = Math.min(y0, g.ink.y0 - g.square.y - 4);
      y1 = Math.max(y1, g.ink.y1 - g.square.y + 4);
    }
    const vb = [x0, y0, x1 - x0, y1 - y0].map(Math.round);
    boxes[name] = vb;
    const sq = `<clipPath id="sq"><rect x="${-m}" y="${-m}" width="${SIDE + 2 * m}" height="${SIDE + 2 * m}"/></clipPath>`;
    const svg = (body, clip) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}">${clip ? `<defs>${sq}</defs>` : ''}<g fill="#000"${clip ? ' clip-path="url(#sq)"' : ''}>${body}</g></svg>\n`;
    writeFileSync(join(dir, `${name}-letter.svg`), svg(parts.letter.map((p) => p.svg).join(''), false));
    writeFileSync(join(dir, `${name}-construction.svg`), svg(parts.construction.map((p) => p.svg).join(''), true));
  };
  for (const L of ALPHABET) write(L, { letter: [one(L, 'letter')], construction: [one(L, 'construction')] });
  // W: two V's, each drawn narrower, the second crossing the first, as printers set a W before founts had one.
  const narrow = 0.6, step = (0.6 - 0.2) * SIDE;
  write('W', { letter: [one('V', 'letter', 0, narrow), one('V', 'letter', step, narrow)], construction: [one('V', 'construction', 0, narrow), one('V', 'construction', step, narrow)] });
  writeFileSync(join(dir, 'index.json'), `${JSON.stringify(boxes, null, 1)}\n`);
  console.log('initials', Object.keys(boxes).length);
}
