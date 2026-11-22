// @ts-check
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { codeFrame } from './lib/code-frame.mjs';
import { shortCode } from './lib/satteri-code.mjs';
import { burnCss, materialsCss, volumenCss } from './lib/materials.mjs';
import { wikiLinks } from './lib/satteri-wikilinks.mjs';

const contentDir = fileURLToPath(new URL('./content', import.meta.url));

/** The textures and the outlines (lib/materials.mjs), computed at build time and bundled with the other styles: the
 *  ones every page uses, and the two that belong to one page each (the catalogue's roll, the burnt leaf). */
const sheets = { 'virtual:materials.css': materialsCss, 'virtual:volumen.css': volumenCss, 'virtual:burn.css': burnCss };
const materials = () => ({
  name: 'codex-materials',
  resolveId: (id) => (id in sheets ? `\0${id}` : undefined),
  load: (id) => (id.startsWith('\0') && id.slice(1) in sheets ? sheets[id.slice(1)] : undefined),
});

export default defineConfig({
  site: 'https://wiki.coletebou.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // The lot-drawing page sends its reader on at once: it is a tool, not a text, and stays out of the sitemap.
  integrations: [mdx(), sitemap({ filter: (page) => !page.endsWith('/sortes/') })],
  markdown: {
    processor: satteri({ mdastPlugins: [wikiLinks({ contentDir }), shortCode()] }),
    shikiConfig: { theme: 'css-variables', wrap: false, transformers: [codeFrame()], langAlias: { tmux: 'shellscript' } },
  },
  devToolbar: { enabled: false },
  vite: { plugins: [materials()] },
});
