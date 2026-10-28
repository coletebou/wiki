# Editing the wiki

How a page is written, for people and for agents. Agents get this text from the MCP server's `editing_guide` tool.
Every rule here is checked by `npm run check:content` and in every pull request, and the MCP server checks a proposed
edit against the same rules before it opens anything.

## A page

One page is one file, `content/<slug>.mdx`, where the slug is lowercase words joined by hyphens (`git-worktrees`).
It starts with frontmatter:

```yaml
---
title: Git Worktrees               # plain text, at most 80 characters; quote it if it contains a colon
summary: >-                        # one or two sentences, at most 240 characters: hover previews, search, catalogue
  Several branches of one repository checked out side by side, each in its own folder.
table: workshop                    # desk shell automata workshop works observatory atelier mint ledger library
folio: 41                          # a whole number no other page uses; a new page takes the next free one
aliases: [worktree, git worktree]  # optional: other names a [[link]] may use
updated: 2026-10-28                # the day of the last real change
sources:                           # optional: public references, official documentation first
  - title: git-worktree(1)
    url: https://git-scm.com/docs/git-worktree
---
```

The body is MDX: Markdown that can hold a few components.

- No `#` heading: the title comes from the frontmatter. Open with a short paragraph that says what the thing is and why
  it matters; its first words become the page's incipit in the catalogue. Then `##` sections and `###` below them.
- **Wiki links:** `[[slug]]`, `[[slug|label]]`, `[[slug#section-id|label]]`. A target may be a slug, a title or an
  alias. Inside a table cell escape the pipe, `[[slug\|label]]`, or the cell ends inside the link. Keep each link on
  one line: a label that wraps onto the next line is not a link. The label is plain words: no code, emphasis, HTML,
  comments or bare web addresses, which would split it. Literal double brackets belong in code (escaping them does not
  work: `\[\[` still renders as a link). The checks and the build refuse each of these. A link to a page that does not
  exist fails the build, so add the page in the same change or leave the link out. Section ids are the heading text
  lowercased, spaces to hyphens, punctuation dropped (`## The \`tm\` picker` is `#the-tm-picker`).
- Link the first mention of anything that has a page. Ordinary Markdown links for the rest of the web, official
  documentation first.
- No `import` or `export` lines and no HTML comments (`<!-- -->` is invalid MDX; write `{/* ... */}`). A bare `{` or
  `<` in running text starts JSX: put it in backticks or write `&lt;`.
- Keys: `<kbd>Ctrl</kbd>+<kbd>b</kbd>`. Code: fenced blocks with a language.

## Components

| Component | Use |
|---|---|
| `<ColesTake>...</ColesTake>` | Cole's own opinion, set apart. Markdown inside; leave a blank line after the opening tag and before the closing one. Only opinions Cole actually holds. |
| `<Price id="vercel-pro" />` | Any price. It prints the amount, the date it was read and a link to the vendor's page, from `src/data/prices.json`. Never type a price as plain text. A new price is a new entry in that file, read on the vendor's own page. |
| `<Diagram name="..." />` | One of the interactive studies: `tmux-keymap`, `agent-fleet` (with `scene="hooks"`, `messaging`, `handoff`, `parking` or `brain`), `worktree-fanout`, `observability`, `cloudflare-front-door`, `cost-calculator`. |

## Voice

Practical and specific: what the thing is, why it matters, how it works, how to set it up, the gotchas, and how it
connects to the rest of the setup, with Cole's real setup as the worked example. Plain American English, short
paragraphs, no marketing tone, no filler. Define jargon on first use or link the page that does. Write around pronouns
for Cole ("Cole", "Cole's", "you"). Verify claims about other people's products on their official pages, and never
present a guess as a fact.

## The public-safety rules

The wiki and its repository are public, and agent edits merge automatically, so these are hard rules. The
`public-safety` check enforces them on every file, on the built site, and on pull request titles, descriptions and
commit messages.

- No secrets of any kind: tokens, keys, passwords, private keys, wallet keys or seed phrases, connection strings.
- No contact details or identifiers: phone numbers, email addresses (except `example.com` ones), account, project or
  zone ids, wallet addresses, home directories with a user name in them.
- Nothing that locates a machine: host names, IP addresses, private network names or addresses. Describe servers by
  what they are used for, never by which machine does what or how many there are.
- Nothing about anyone's employer or its systems, and no customer, tenant or other people's personal data.
- When in doubt, leave it out.

A phrase-level deny-list is kept as salted hashes in `safety/denylist.json`; `node scripts/denylist.mjs test "text"`
says whether a text would trip it, without saying which phrase.

## How a change lands

Every change is a pull request to `master` and runs four checks: **build** (the site builds and every page passes the
rules above), **links** (every internal link and section anchor resolves), **gitleaks** (no credentials) and
**public-safety**. A pull request labelled `agent-edit`, opened by the repository owner's account from a branch of this
repository, that changes only files in `content/`, is squash-merged automatically when the four checks pass, and the
site redeploys. Every other pull request waits for review.
