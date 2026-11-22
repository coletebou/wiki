// Each folio's share card (1200 x 630): what a link to the folio shows when it is posted somewhere. Drawn when the
// site is built: the folio's table and number, its title in the inscription capitals, the first words of its
// summary, and its table's device in ink on vellum. The site's own fonts, set by satori and painted by resvg.
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import sharp from 'sharp';
import { folioLabel } from '../../../lib/schema.mjs';
import { tableOf, wiki } from '../../lib/wiki';

export async function getStaticPaths() {
  const { pages } = await wiki();
  return pages.map((page) => ({ params: { slug: page.id } }));
}

const font = (path: string) => readFileSync(new URL(`../../../node_modules/${path}`, import.meta.url));
const FONTS = [
  { name: 'Cinzel', data: font('@fontsource/cinzel/files/cinzel-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'Garamond', data: font('@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff'), weight: 400 as const, style: 'normal' as const },
  { name: 'Garamond', data: font('@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff'), weight: 400 as const, style: 'italic' as const },
];
// The leaf by day (src/styles/tokens.css).
const INK = '#2a1c12', INK2 = '#4e3b2a', INK3 = '#5c4734', SANGUINE = '#892f17', RULE = '#b49a74';

const DEVICES = import.meta.glob('../../assets/devices/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const device = (table: string) => {
  const svg = DEVICES[`../../assets/devices/${table}.svg`];
  return svg ? `data:image/svg+xml;base64,${Buffer.from(svg.replace('fill="#000"', `fill="${INK2}"`)).toString('base64')}` : null;
};

/** At most `n` letters, cut at a word, with an ellipsis if anything was cut. */
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n)).replace(/[,;:.]$/, '')}…`);

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | null)[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.filter((c) => c !== null) },
});

export async function GET({ params }: { params: { slug: string } }) {
  const { bySlug } = await wiki();
  const page = bySlug.get(params.slug)!;
  const t = tableOf(page.data.table);
  const title = page.data.title;
  const size = title.length > 34 ? 50 : title.length > 22 ? 60 : 74;
  const art = device(t.id);
  const card = h(
    'div',
    {
      width: 1200,
      height: 630,
      padding: 30,
      backgroundColor: '#f3e8cf',
      backgroundImage: 'radial-gradient(ellipse 80% 90% at 38% 40%, #f7eed9 0%, #f1e4c6 55%, #dfc9a0 100%)',
    },
    h(
      'div',
      { flex: 1, border: `1px solid ${RULE}`, padding: 6 },
      h(
        'div',
        { flex: 1, border: `1px solid ${RULE}`, padding: '52px 56px 40px 60px' },
        h(
          'div',
          { flexDirection: 'column', flex: 1, paddingRight: 24 },
          h('div', { fontFamily: 'Cinzel', fontSize: 22, letterSpacing: 5, color: SANGUINE }, `TABLE ${t.numeral} · ${t.title.toUpperCase()}`),
          h('div', { fontFamily: 'Cinzel', fontSize: size, lineHeight: 1.08, color: INK, marginTop: 22 }, title),
          h('div', { width: 210, height: 2, backgroundColor: SANGUINE, opacity: 0.55, marginTop: 24 }),
          h('div', { fontFamily: 'Garamond', fontStyle: 'italic', fontSize: 30, lineHeight: 1.36, color: INK2, marginTop: 24 }, clip(page.data.summary, 150)),
          h('div', { flex: 1 }),
          h(
            'div',
            { alignItems: 'baseline', gap: 22, color: INK3 },
            h('div', { fontFamily: 'Garamond', fontStyle: 'italic', fontSize: 30, color: SANGUINE }, folioLabel(page.data.folio)),
            h('div', { fontFamily: 'Cinzel', fontSize: 22, letterSpacing: 4, color: INK }, 'CODEX · TEBOU'),
            h('div', { fontFamily: 'Garamond', fontSize: 22 }, 'wiki.coletebou.com'),
          ),
        ),
        art ? h('div', { width: 330, alignItems: 'center', justifyContent: 'center' }, { type: 'img', props: { src: art, width: 310, height: 310, style: { opacity: 0.9 } } }) : null,
      ),
    ),
  );
  const svg = await satori(card as never, { width: 1200, height: 630, fonts: FONTS });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  const jpg = await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { 'content-type': 'image/jpeg' } });
}
