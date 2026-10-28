#!/usr/bin/env node
// After Pagefind indexes the site: drop the stock search UIs it writes, which the site does not use (it has its own
// seeker on Pagefind's JS API), so they are neither shipped nor scanned.
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? 'dist/pagefind');
const unused = /^pagefind-(ui|modular-ui|component-ui)\.(js|css)$/;
const removed = readdirSync(dir).filter((f) => unused.test(f));
for (const f of removed) rmSync(path.join(dir, f));
console.log(`postbuild: removed ${removed.length} unused Pagefind UI file${removed.length === 1 ? '' : 's'}`);
