# The Codex — Vivim's Wiki Layer (Specification)

> Design brief: **Wikipedia meets product onboarding meets guided tour meets Accenture
> discovery session.** One body of knowledge, four ways to experience it depending on
> who the reader is and where they are in their journey.

---

## 1. Concept

**The Codex is the single, code-grounded encyclopedia of Vivim.**

It is *one* corpus consumed through three lenses:

| Lens | Reader | Experience |
|---|---|---|
| **Encyclopedia** | "What is this thing?" | Wikipedia-style articles — neutral, complete, cross-linked, cited to source files |
| **Tour** | "Show me around" | Guided tours that *link into* articles at the exact moment of need (progressive disclosure) |
| **Discovery** | "Map this to *my* goals" | Structured intake sessions whose output is a personalized reading path + mission track |

Non-negotiable principle: **the wiki is a projection of code truth, never a parallel narrative.**
Every claim cites `file:line`. If the code moves and the citation dies, CI flags it.

## 2. Article Anatomy

Every article follows one template (Wikipedia infobox discipline):

```markdown
---
slug: conversation/send          # mirrors capability slug conversation:send
title: Sending Messages
tier: L1                         # disclosure tier (see §4)
status: working                  # working | conditional | experimental | broken | stub
surfaces: [ui, cli, api, mcp]
last-verified: 2026-08-26        # date a human confirmed against code
sources:
  - src/server/conversation-router.ts
  - src/engines/capability-bootstrap/default-caps.ts:conversation_send
---

# Sending Messages

> **TL;DR** — one sentence a non-technical friend understands.

<!-- INFOBOX -->
| | |
|---|---|
| Status | 🟢 Working |
| Reach it | Type in the entry box · `vivim chat send` · `POST /api/interpret` |
| Since | v1.0 |
| Deepness | L1 |

## What it does
## How to reach it (per surface: UI path / NL phrase / CLI / API)
## What can go wrong (honest failure modes + recovery)
## Under the hood (optional collapsible, file:line citations)
## See also            ← cross-links drive the wiki feel
```

Rules:
- **Infobox first.** Status chip and reach-it paths are mandatory.
- **"How to reach it" is the onboarding hook** — same operation, all surfaces, because
  FRONTEND=BACKEND: the capability slug is the only link.
- **See also** section required ≥2 links (this is what makes it a wiki and not docs).
- **Under the hood** collapses by default — progressive disclosure inside every article.

## 3. Ground Truth Contract

1. Every article MUST cite ≥1 real source path in frontmatter `sources`.
2. **wiki-lint** (small bun script, add later as `scripts/wiki-lint.ts`):
   - every cited path exists
   - every slug resolves in `seeds/taxonomy/pool.taxonomy.json` OR matches a default cap id
   - status values ∈ enum; `last-verified` ≤ 30 days old for `working`
3. Status chips derive from ONE manifest (`docs/alpha/03-FEATURE-INVENTORY.md` today,
   later `seeds/wiki/status.json`) consumed by both the wiki render and the in-app help
   Search tab — so the app and the wiki can never disagree.

## 4. Disclosure Tiers (the progressive spine)

Tiers tag every article; tours and missions use them to sequence exposure:

| Tier | Name | Reader state | Example articles |
|---|---|---|---|
| **L0** | Arrival | Just installed | Welcome, What Vivim Is (and Isn't), First Message |
| **L1** | Core Loop | Daily chatting | Conversations, Layers, Entry Box & Palette, Streaming Blocks |
| **L2** | Fluency | Power-curious | Capabilities Catalog, Natural-Language Control, Memory Facts, Knowledge Ingest, Help System Self-Service |
| **L3** | Mastery | Builder/tester | Provider Fleet (CDP), Local Agent (OpenCode), Automation Recipes, Canvas Building, Node Graph, Dev Console, Diagnostics |

Disclosure mechanics (no hard walls — gates are *nudges*):
- In-app help Search ranks articles by tier relative to user's demonstrated usage stage.
- Tour completion and mission completion unlock "you might like…" suggestions pointing at next-tier articles.
- Any article is directly reachable via search at any time (Wikipedia freedom preserved).

## 5. Rendering — Three Phases

| Phase | Ship | How |
|---|---|---|
| **A (alpha)** | Markdown bundle in repo: `docs/wiki/**/*.md` | Readable on GitHub/private mirror; HelpPanel Search tab indexes them via existing `/api/help/search`; zip export in welcome pack |
| **B (alpha+)** | Static `/wiki` route in frontend export | Same markdown rendered in-app; deep-link from tour steps ("learn more → opens article") |
| **C (v1.1)** | Auto-generated stubs | Script walks taxonomy pool → creates stub article per capability (`status: stub`) so catalog and wiki have identical coverage; humans upgrade stubs |

Phase C closes the "3,548 listed vs ~54 documented" honesty gap structurally.

## 6. Starter Corpus (alpha set — 16 articles)

L0: `welcome` · `what-is-vivim` · `first-message`
L1: `conversation/send` · `ui/layers` · `ui/palette` · `ui/panels`
L2: `capabilities/catalog` · `nl/control` · `memory/facts` · `knowledge/ingest` · `help/self-service`
L3: `providers/fleet` · `agent/opencode` · `diagnostics/logs` · `meta/status-board`

Each starter article is written FROM the feature inventory doc — zero new claims.

## 7. Voice & Style (Wikipedia discipline, friendlier)

- Declarative, present tense, no marketing adjectives.
- Honest failure modes get their own subsection — testers trust docs that admit limits.
- Every "experimental/broken" statement links to the known-gaps list rather than hiding it.
- No screenshots-as-truth: UI changes faster than prose. Prefer "reach it" paths over pixel descriptions; screenshots allowed but must carry a captured-on version stamp.

## 8. Governance

- Owner: you (alpha). Post-alpha: one owner per domain folder.
- Review cadence: any behavior-changing commit touching a cited file must bump that
  article's `last-verified` in the same PR (docs-as-byproduct rule, already house style).
- Supersede, never delete: renamed features keep old slugs as redirects (wiki convention).
