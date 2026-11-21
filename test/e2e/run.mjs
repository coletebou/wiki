// The site, driven in a real browser: every suite in this directory against a running copy of the built site.
//
//   npm run build && npx astro preview --port 4391 &
//   npm run e2e -- http://127.0.0.1:4391                   every suite, in Chromium
//   npm run e2e -- http://127.0.0.1:4391 --engine=all      in Chromium, WebKit and Firefox
//   npm run e2e -- http://127.0.0.1:4391 --only=ribbon,keys
//
// The browsers are not installed with the site: `npx playwright-core install chromium webkit firefox` fetches them.
// Each suite is a script of its own that prints PASS or FAIL for each thing it checks and the page's own errors at
// the end; this runs them one after another and fails if any check failed, any page threw, or a suite fell over.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SUITES = ['keys', 'catalogue', 'planisphere', 'ribbon', 'defects'];
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith('--'));
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
if (!base) {
  console.error('usage: node test/e2e/run.mjs <the address of a running copy of the site> [--engine=chromium|webkit|firefox|all] [--only=suite,suite]');
  process.exit(2);
}
const engines = option('engine') === 'all' ? ['chromium', 'webkit', 'firefox'] : [option('engine') ?? 'chromium'];
const only = option('only')?.split(',');
const suites = only ? SUITES.filter((s) => only.includes(s)) : SUITES;

let failed = 0;
for (const engine of engines) {
  for (const suite of suites) {
    const file = fileURLToPath(new URL(`./${suite}.mjs`, import.meta.url));
    const run = spawnSync(process.execPath, [file, base.replace(/\/$/, ''), engine], { encoding: 'utf8', timeout: 240_000 });
    const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const passes = (out.match(/^PASS /gm) ?? []).length;
    const fails = out.split('\n').filter((l) => l.startsWith('FAIL '));
    // Everything from "page errors:" to the end, since a list of errors runs over several lines.
    const errors = /^page errors: \[\s*\]/m.test(out) ? '' : (out.match(/^page errors: [\s\S]*/m)?.[0].trim() ?? 'the suite did not finish');
    const bad = fails.length > 0 || errors !== '' || run.status !== 0;
    console.log(`${bad ? 'FAIL' : 'ok  '}  ${engine.padEnd(8)} ${suite.padEnd(12)} ${passes} passed${fails.length ? `, ${fails.length} failed` : ''}`);
    if (bad) {
      failed++;
      for (const line of fails) console.log(`        ${line}`);
      if (errors) console.log(errors.split('\n').map((l) => `        ${l}`).join('\n'));
      if (run.status !== 0 && !fails.length) console.log(out.split('\n').slice(-12).map((l) => `        ${l}`).join('\n'));
    }
  }
}
console.log(failed ? `${failed} suite${failed === 1 ? '' : 's'} failed` : 'every suite passed');
process.exit(failed ? 1 : 0);
