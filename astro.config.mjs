// @ts-check
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { wikiLinks } from './lib/satteri-wikilinks.mjs';

const contentDir = fileURLToPath(new URL('./content', import.meta.url));

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
});
