# Plan: all of the infrastructure under OpenTofu

- **Status:** Proposal for Cole's review. Nothing here has been run against real infrastructure.
- **Date:** 2026-10-28

The wiki describes the infrastructure as managed by [OpenTofu](https://opentofu.org): every zone, project, repository
setting, policy and server described in code, changed by pull request, planned in CI and applied on merge. That is the
target. This plan is how to get every last piece there without breaking anything that is live, and how to keep it there.

## The target

- One **root** per provider (and per account where a provider has several), each with its own state, its own
  credentials and a README that says what it manages and what it deliberately does not.
- **State** in an encrypted, versioned bucket with locking; never on a laptop.
- **Pull request** runs: format, validate, lint, a security scan, then a plan with **read-only** credentials, posted as
  a comment. A **destroy guard** fails any plan that deletes or replaces something unless a human labels it.
- **Merge** runs: re-plan, refuse if the plan differs from the one reviewed, apply with the root's write role.
- **Nightly drift**: a read-only plan of every root, plus a report of live objects that are missing from state.
- CI authenticates with short-lived OIDC credentials, never long-lived keys.

## What goes under it

| Area | Objects | Notes |
|---|---|---|
| State and identity | The state bucket, its encryption keys, the CI's OIDC trust and one role per root | Bootstrapped locally once; everything else depends on it |
| Cloud accounts | Organization structure, guardrail policies, budgets and cost-anomaly alerts | Budgets first: they are the cheapest insurance |
| DNS and the edge | Every Cloudflare zone's records, rulesets (custom rules, rate limits, Bot Fight Mode), email routing, Access applications, tunnel objects, R2 buckets | Tunnel routes stay in each box's local config: moving them to remote config is one-way |
| Code | GitHub repositories, rulesets and branch protection, environments, variables | Including this wiki's own repository settings |
| Hosting | Vercel projects and their domains | Environment variables stay out until read-only tokens exist |
| Network | The Tailscale policy file | Imported verbatim, then edited only through pull requests |
| Errors | Sentry projects, teams, monitors and alerts | |
| Servers | The servers, their volumes, addresses and firewalls | Treated as pets: no replacement without a human |
| Databases | Cluster configuration, network access lists, backup policy | Never users or data |

**Deliberately out of scope:** host configuration (systemd units, nginx, compose files: they stay in their repositories
as code and are deployed by scripts), application deploys (Vercel's Git integration and deploy scripts), data of any
kind, and anything that holds a secret (API tokens, tunnel secrets, database users). Objects whose recreation would
silently break something, such as a webhook endpoint whose signing secret changes when it is recreated, stay out too.

## Phases

| Phase | Work | Done when |
|---|---|---|
| 0. Bootstrap | Create the state bucket, keys, OIDC trust and per-root roles from a local run | A no-op plan runs in CI with read-only credentials |
| 1. Rehearsal | For each root, write the configuration and import blocks, then run a read-only "rehearsal" plan | Every root plans at zero diff against the live objects |
| 2. Low-risk imports | The network policy, then the smallest DNS zones | Imported at zero diff; one real change made through a pull request |
| 3. Core zones | The main domains' records, rulesets and email routing, one zone at a time | Each at zero diff; rollback rehearsed |
| 4. Code, hosting, errors | GitHub, Vercel, Sentry | At zero diff; Vercel applied locally until it offers read-only tokens |
| 5. Servers and accounts | Servers, volumes, firewalls; organization and budgets | At zero diff; destroy guard proven to stop a replacement |
| 6. Apply in CI | Turn on apply-on-merge for each root that has passed phase 1 to 5 | Two weeks of clean nightly drift reports |
| 7. This wiki | Import its GitHub repository settings and branch protection, its Vercel project and domain, and its DNS record | The wiki's own infrastructure changes only by pull request |

Each import is a pull request of its own, with the rehearsal plan attached, and needs Cole's approval.

## Rules for agents working on it

- Never apply from a laptop except phase 0 and the documented exceptions.
- Never run a plan with write credentials; plans use the read-only role.
- An import that does not plan at zero diff is a bug in the configuration, not in the infrastructure: fix the code.
- Never paste a plan that contains secrets or identifiers into a public place.

## Risks

| Risk | Mitigation |
|---|---|
| An import recreates a live object | Zero-diff rehearsal, the destroy guard, and import blocks instead of re-creation |
| A provider's API differs from its dashboard | Rehearse with read-only tokens; keep the dashboard read-only for humans once a root is live |
| Drift from manual dashboard changes | Nightly drift report; dashboard edits become pull requests |
| CI credentials leak | OIDC, per-root roles, no long-lived keys, plans read-only |

## What needs Cole

Approval of this plan, of the phase 0 bootstrap run, and of each import pull request; the read-only and write roles for
each provider; and a decision on which objects stay out of scope for good.
