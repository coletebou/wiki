# ADR 0001: v2 search and editing

- **Status:** Proposed. Not built. Building any part of it needs Cole's design review first.
- **Date:** 2026-10-28
- **Decider:** Cole Tebou

## Context

Version 1, live today, is deliberately small:

- a static Astro site on Vercel, searched in the browser with Pagefind (keyword search over a prebuilt index);
- a stdio MCP server that each agent runs locally, reading the site's `/api/wiki.json` and ranking pages with BM25;
- edits as GitHub pull requests opened with the caller's own token, checked by CI (build, links, gitleaks,
  public-safety) and squash-merged automatically for `agent-edit` pull requests from the owner.

What it cannot do: search by meaning rather than words, answer a question across pages, show changes live, let an
agent connect by URL without cloning anything, or give each agent its own identity for writes.

When choosing v1, Cole set the longer-term target in these words (2026-10-27, as typed):

> eventually we'll get to liks connecting to a broker that has a loadbalancer and mesh network and runs ECS containers
> connected to an documentdb and or opensearch databse with hybrid vector search via a miltimodal embedding model and
> bm25 keyword and agentic search and websocket connections etc

Restated: a broker service behind a load balancer, on a service mesh, running as ECS containers; DocumentDB and/or
OpenSearch behind it; hybrid search combining vectors from a multimodal embedding model with BM25 keyword search;
agentic search; and WebSocket connections.

## Decision drivers

1. **Git stays the source of truth.** Every word is public, reviewable, attributable and CC BY. A database may index or
   draft, never own the canonical text.
2. **The public-safety gate cannot weaken.** Whatever writes, the same lint runs before a pull request exists and again
   in CI.
3. **Cost floor.** v1 costs nothing beyond plans Cole already pays for. Always-on services change that, so each phase
   must justify itself.
4. **Agent ergonomics.** Connecting should be a URL and a login, not a clone and an install.
5. **Operability.** Everything in OpenTofu, observable on the existing path (Langfuse, Sentry, Datadog).

## Proposed architecture (the target)

| Part | Proposal |
|---|---|
| Broker | An HTTP + WebSocket API: the remote MCP endpoint (Streamable HTTP), a REST surface for the site, and a WebSocket channel. ECS on Fargate, at least two tasks across availability zones, behind an Application Load Balancer. |
| Mesh | ECS Service Connect between the broker, the indexer and the search worker: service discovery, retries and per-call metrics without a sidecar to run. |
| Search store | OpenSearch with a k-NN vector field and a BM25 text field per chunk; hybrid queries through a search pipeline that normalizes and combines the two scores. |
| Document store | DocumentDB only if drafts, review threads or collaborative sessions need durable state outside git. Otherwise skipped: git plus OpenSearch is enough. |
| Embeddings | A multimodal embedding model on Amazon Bedrock, so text, diagrams and screenshots share one vector space; chunks cut at headings, carrying folio, table and anchor. |
| Agentic search | An `ask` tool: a model plans queries, runs hybrid search, follows backlinks, and answers with citations to folios and anchors. |
| WebSockets | Live events to the site and to agents: page changed, pull request opened, checks passed, merged. |
| Writes | Still pull requests, now opened by a GitHub App with a per-agent identity in the commit trailer instead of personal tokens. The auto-merge rules and the four checks stay as they are. |
| Indexing | A GitHub webhook on merge to `master` starts the indexer: re-chunk changed pages, embed, upsert, publish an event. |
| Infrastructure | All of it as OpenTofu roots, per [the OpenTofu plan](../plans/opentofu.md). |

## Phased path

Each phase ships on its own and is worth having even if the next never comes.

| Phase | What | New infrastructure | Exit criteria |
|---|---|---|---|
| 0 | v1 (done): static site, stdio MCP, pull requests, auto-merge | none | An agent edit merges and goes live with no human |
| 1 | Remote MCP: the same tools over Streamable HTTP with GitHub OAuth, so agents connect by URL | one serverless function (Vercel or a Cloudflare Worker) | `claude mcp add --transport http` works; writes still pull requests |
| 2 | Hybrid search: chunk, embed and index on merge; `search` gains `mode: keyword, semantic, hybrid` | a vector index (managed OpenSearch, or a serverless vector store to start) | Better recall on a fixed set of 50 real questions than Pagefind and BM25, measured |
| 3 | Agentic search: the `ask` tool with citations, budgets and caching | none beyond phase 2 | Answers cite folios, stay under a cost budget per question, traced in Langfuse |
| 4 | The broker: ECS behind a load balancer, Service Connect, WebSockets, a GitHub App for writes; DocumentDB if drafts need it | ECS cluster, load balancer, OpenSearch domain, optionally DocumentDB | Live updates on the site; per-agent identities on every commit |
| 5 | Multimodal: embed the diagrams and screenshots; search by image | none beyond phase 4 | "find the drawing of the front door" works |

The recommendation is to do phases 1 to 3 on serverless pieces first and move to the full broker of phase 4 when there
is a demonstrated need: several people or agents editing live, or traffic that a function cannot serve well.

## Alternatives considered

1. **Stay at v1.** Zero cost and zero operations; no semantic search and no live updates.
2. **Serverless all the way.** A remote MCP and hybrid search on serverless functions and a hosted vector store. Much
   cheaper to run than ECS and OpenSearch; less control over ranking and no long-lived WebSockets on some platforms.
3. **The full broker now.** Matches the target immediately, at the highest cost floor and operating burden, before the
   need is proven.

## Risks

- **Cost floor.** Load balancers, Fargate tasks and OpenSearch domains bill by the hour whether or not anyone reads the
  wiki. Each phase gets a budget and an alert before it is applied.
- **A second writer.** Any write path other than a pull request could bypass the checks. Rule: the broker can open pull
  requests, never push to `master`.
- **Index drift.** The index can lag git. Every result carries the commit it was indexed from; a nightly job re-indexes
  everything and reports differences.
- **Secrets.** The GitHub App key, model credentials and database credentials live in a secrets manager, never in
  state, images or the repository.

## Open questions for Cole

1. Is DocumentDB wanted for drafts and collaboration, or is git plus OpenSearch enough?
2. Which embedding model and region, given where the rest of the Bedrock usage runs?
3. Should anyone other than Cole's agents be able to propose edits through the remote MCP?
4. A monthly budget for phases 2 to 4.
