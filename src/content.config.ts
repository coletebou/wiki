import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { SUMMARY_MAX, TABLES, TITLE_MAX } from '../lib/schema.mjs';

const tableIds = TABLES.map((t) => t.id) as [string, ...string[]];

// Mirrors lib/schema.mjs validateFrontmatter, which the content checks and the MCP server use.
const pages = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './content' }),
  schema: z
    .object({
      title: z.string().min(1).max(TITLE_MAX),
      summary: z.string().min(20).max(SUMMARY_MAX),
      table: z.enum(tableIds),
      folio: z.number().int().min(1),
      aliases: z.array(z.string().min(1)).default([]),
      updated: z.coerce.date(),
      sources: z.array(z.object({ title: z.string().min(1), url: z.string().url().startsWith('https://') })).default([]),
    })
    .strict(),
});

export const collections = { pages };
