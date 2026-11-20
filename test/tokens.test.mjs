// The design tokens' promise, held to: body text at least 10:1 against the leaf, and every colour that text is set in
// at least 4.5:1 against the surface it is written on (WCAG 2 contrast), in both themes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

/** The custom properties of one rule, by name. */
function block(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `tokens.css has no "${selector}" rule`);
  const body = css.slice(start, css.indexOf('\n}', start));
  return Object.fromEntries([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, `${hex} is not a six-digit hex colour`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const day = block(':root');
const themes = { vellum: day, lucerna: { ...day, ...block(":root[data-theme='lucerna']") } };

// [text, surface, the least contrast it may have]
const PAIRS = [
  ['ink', 'paper', 10],
  ['ink', 'paper-2', 10],
  ['ink', 'code-bg', 10],
  ['ink-2', 'paper', 4.5],
  ['ink-2', 'paper-2', 4.5],
  ['ink-3', 'paper', 4.5],
  ['ink-3', 'paper-2', 4.5],
  ['sanguine', 'paper', 4.5],
  ['sanguine', 'paper-2', 4.5],
  ['verdigris', 'paper', 4.5],
  ['lapis', 'paper', 4.5],
  ['gold-ink', 'paper', 4.5],
  ['desk-ink', 'desk', 10],
  ['desk-ink-2', 'desk', 4.5],
  ['desk-ink-3', 'desk', 4.5],
  ['sanguine', 'desk', 4.5],
];

for (const [name, t] of Object.entries(themes)) {
  test(`${name}: every text colour holds its contrast`, () => {
    for (const [text, surface, least] of PAIRS) {
      const ratio = contrast(t[text], t[surface]);
      assert.ok(ratio >= least, `--${text} on --${surface} is ${ratio.toFixed(2)}:1, below ${least}:1`);
    }
  });
}

test('the lamplight theme overrides every colour the daylight theme sets', () => {
  const night = block(":root[data-theme='lucerna']");
  const colours = Object.entries(day).filter(([k, v]) => /^(#|rgb\()/.test(v) && !k.startsWith('astro-code-background'));
  const missing = colours.map(([k]) => k).filter((k) => !(k in night));
  assert.deepEqual(missing, []);
});
