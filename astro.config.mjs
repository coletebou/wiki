// @ts-check
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { materialsCss } from './lib/materials.mjs';
import { wikiLinks } from './lib/satteri-wikilinks.mjs';

const contentDir = fileURLToPath(new URL('./content', import.meta.url));

/** The textures and the leaf's outline (lib/materials.mjs), computed at build time and bundled with the other styles. */
const materials = () => ({
  name: 'codex-materials',
  resolveId: (id) => (id === 'virtual:materials.css' ? '\0virtual:materials.css' : undefined),
  load: (id) => (id === '\0virtual:materials.css' ? materialsCss : undefined),
});

export default defineConfig({
  site: 'https://wiki.coletebou.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: satteri({ mdastPlugins: [wikiLinks({ contentDir })] }),
    shikiConfig: { theme: 'css-variables', wrap: false },
  },
  devToolbar: { enabled: false },
  vite: { plugins: [materials()] },
});
