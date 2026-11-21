# Codex Tebou: How to Be a Beast

The source of [wiki.coletebou.com](https://wiki.coletebou.com), Cole Tebou's wiki of the whole working setup: terminals
and tmux, agents and their hooks, worktrees, Cloudflare, Vercel, Langfuse, apps, the desk, and what it all costs. It is
one of the editions of [coletebou.com](https://coletebou.com), set as Leonardo da Vinci's notebooks filed in the Library
of Alexandria: folios with a recto and a verso, the catalogue as Callimachus' *Pinakes*, hover previews as the
*sillyboi* tags that hung from scrolls.

People and agents edit it the same way: by pull request. An agent edit that passes every check merges itself.

## Layout

| Path | What it is |
|---|---|
| `content/*.mdx` | One page per file. Format: [docs/EDITING.md](docs/EDITING.md) |
| `src/` | The Astro site: layouts, components, the interactive studies (`src/diagrams`), styles, routes |
| `src/data/prices.json` | Every price on the site, with the date it was read and the vendor page it was read on |
| `lib/` | Shared, dependency-free code: wiki links, the link graph, validation, search, the public-safety lint, and the drawing of the materials (vellum, stone, papyrus, the outlines of the leaf and the roll, the burnt edge), of each folio's illuminated initial, of Attic numerals and Roman dates, and the layout of the planisphere |
| `mcp/` | The MCP server for agents (stdio) |
| `scripts/` | Checks: pages, links in the built site, public safety, the deny-list tool; and how the two committed pictures were made (the frontispiece's drawing, traced from a photograph of Leonardo's sheet, and the share card) |
| `test/` | Unit tests for `lib/` (`npm test`), and in `test/e2e/` the browser suites and audits |
| `safety/denylist.json` | Salted hashes of phrases that must never be published |
| `docs/` | The editing guide, design records and plans |
| `.github/workflows/` | CI, agent auto-merge, the weekly external link check, the daily agent-branch cleanup |

## Develop

Node.js 22.12 or later.

```sh
npm ci
npm run dev                # http://localhost:4321 (search works only in a build)
npm run check:content      # every page: frontmatter, MDX, components, prices, wiki links, safety
npm test                   # unit tests for lib/
npm run build              # the site and its Pagefind index, in dist/
npm run check:links        # every internal link and anchor in dist/
node scripts/safety-lint.mjs --dist dist
```

The built site can also be driven in real browsers. These checks are not part of CI: they need browsers, which
`npx playwright-core install chromium webkit firefox` fetches once.

```sh
npx astro preview --port 4391 &                       # serve dist/
npm run e2e -- http://127.0.0.1:4391                  # every suite in test/e2e/, in Chromium
npm run e2e -- http://127.0.0.1:4391 --engine=all     # in Chromium, WebKit and Firefox
npm run audit:a11y -- http://127.0.0.1:4391           # axe-core, by day and by lamplight
npm run audit:contrast -- http://127.0.0.1:4391       # every text against the surface as it is painted
npm run audit:overflow -- http://127.0.0.1:4391       # no page scrolls sideways, at six widths
```

The suites cover the reader's keys, the catalogue's finder, the planisphere, the reading ribbon, and the defects found
after the redesign shipped. The contrast audit matters because the surfaces are textured: a colour that passes
against the flat paper can fail on its darkest patch, and only the painted page shows that.

## Agents: the MCP server

The server gives any MCP client `search`, `list_pages`, `read_page`, `backlinks`, `editing_guide` and `propose_edit`.
It reads the live site's `/api/wiki.json` by default (no build needed), or a local checkout with `WIKI_DIR`. Proposed
edits are validated locally with the same rules as CI, then opened as a branch, one commit and a pull request labelled
`agent-edit`, with your own GitHub token (`GITHUB_TOKEN` or `GH_TOKEN`, else `gh auth token`).

```sh
git clone https://github.com/coletebou/wiki.git ~/code/wiki
npm --prefix ~/code/wiki/mcp install
```

Claude Code:

```sh
claude mcp add --scope user coletebou-wiki -- node ~/code/wiki/mcp/server.mjs
```

Codex (`codex mcp add coletebou-wiki -- node ~/code/wiki/mcp/server.mjs`, or in `~/.codex/config.toml`):

```toml
[mcp_servers.coletebou-wiki]
command = "node"
args = ["/home/you/code/wiki/mcp/server.mjs"]
```

Environment: `WIKI_SITE` (default `https://wiki.coletebou.com`), `WIKI_DIR`, `WIKI_REPO` (default `coletebou/wiki`),
`WIKI_BRANCH` (default `master`). Tests: `npm --prefix mcp test` (end to end over stdio, against this checkout).

## How a change lands

Every pull request to `master` runs four required checks: **build** (unit tests, every page, the site, the MCP server
end to end), **links**, **gitleaks** and **public-safety** (sources, the built site, the pull request's title, body and
commit messages). A pull request labelled `agent-edit`, opened by `coletebou` from a branch of this repository, not a
draft, that changes only `content/*.mdx`, is squash-merged automatically when the checks pass. Everything else waits for
review. GitHub's own branch deletion skips merges made by GitHub Actions, so a daily job deletes `agent-edit` branches
once nothing is open on them. Vercel deploys `master` to production and every pull request to a preview, which only
the Vercel team can open.

The public-safety rules are in [docs/EDITING.md](docs/EDITING.md#the-public-safety-rules). To add a phrase to the
deny-list without committing it: `node scripts/denylist.mjs add <kind> "<phrase>"`; to rebuild it from a private list of
`kind: phrase` lines kept outside the repository: `node scripts/denylist.mjs build <file>`; to test a text without
learning which phrase it trips: `node scripts/denylist.mjs test "<text>"`.

## Design records

- [ADR 0001: v2 search and editing](docs/adr/0001-v2-search-and-editing.md), a proposal, not built.
- [Plan: everything under OpenTofu](docs/plans/opentofu.md), a proposal.

## Licenses

Code: [MIT](LICENSE). Words, drawings and data: [CC BY 4.0](LICENSE-CONTENT). Fonts (EB Garamond, Cinzel, Italianno,
JetBrains Mono): SIL Open Font License 1.1, served from this site. The Vitruvian Man on the frontispiece
(`src/assets/vitruvian-man.svg`) is Leonardo da Vinci's drawing, in the public domain, traced from a photograph by
Luc Viatour / [Lucnix.be](https://lucnix.be).
