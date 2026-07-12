# devops-generators — Design

> Status: DESIGN COMPLETE → BUILDING
> Author: vivim-final session
> Date: 2026-07-12

## Objective

A skill + tooling that runs **fully autonomous list-generation pings to LLMs** to build a massive provider taxonomy library, with **interactive gen sessions** where the agent understands the full state of the existing library and recommends where to begin.

## Two Rounds

- **Round 1 (Skeleton):** Generate a master catalog of platforms/interfaces as a database (`PlatformCatalog` table). Curated ~150–200 across 10 categories (deeper, higher confidence) — not literal 1000 (lower confidence, slower).
- **Round 2+ (Drill-down):** Pick a platform (e.g. `facebook`) → run iterative prompt-generation loops (meta → capabilities → intents → selectors → constraints → validate) → accumulate a deep taxonomy → merge into seed files.

## Architecture

```
.opencode/skill/devops-generators/SKILL.md   # the methodology + prompt templates + web-search
.opencode/command/taxonomy.md                # CLI command wrapper
scripts/taxonomy-gen/
  run.ts                  # bun run taxonomy-gen <cmd>
  lib/
    prompt-builder.ts     # renders prompts/*.md with vars
    llm-ping.ts           # autonomous LLM caller (zai/openai/anthropic)
    skeleton.ts           # Round 1: catalog generator
    provider-session.ts   # Round 2: per-provider drill-down loop
    merge.ts              # merge outputs → seeds/taxonomy/generated.seed.ts
    state.ts              # progress/resume
    catalog-scan.ts       # scans existing library (schema, seeds, contracts)
    recommend.ts          # recommendation engine (where to start)
    research.ts           # web-search during sessions (doubts + existing libs)
  prompts/
    skeleton.prompt.md
    provider-meta.prompt.md
    capabilities.prompt.md
    intents.prompt.md
    selectors.prompt.md
    constraints.prompt.md
    validate.prompt.md
  output/
    skeleton/platforms.json
    providers/<slug>/taxonomy.json
    providers/<slug>/sections/*.json
seeds/taxonomy/generated.seed.ts            # produced by merge.ts
```

## Component 1 — Skill (`.opencode/skill/devops-generators/SKILL.md`)

Documents:
- Two-round flow (skeleton → drill-down)
- Prompt template contract (input vars, expected JSON schema)
- **Interactive gen sessions** — agent reads next prompt, generates output file, validates
- **Library-state awareness** — agent scans `prisma/schema.prisma`, `seeds/`, `src/storage/contracts/`, `src/engines/provider-taxonomy/` before each session
- **Recommendations** — if user doesn't know where to start, agent runs `recommend` to scan catalog + existing library and suggest highest-value/lowest-effort platform
- **Web-search research** — during any session, agent may web-search to (a) find existing taxonomy libraries we can download/reuse, (b) resolve doubts (selectors, capabilities, API changes)

## Component 2 — Tooling

| File | Purpose |
|------|---------|
| `run.ts` | `skeleton`, `session <slug>`, `merge`, `status`, `resume`, `recommend`, `scan` |
| `lib/prompt-builder.ts` | Renders `prompts/*.md` with `{platform}`, `{category}`, `{section}`, `{prior}` substitutions |
| `lib/llm-ping.ts` | Sends prompt to LLM, expects JSON, validates (Zod), writes output. `--mode auto|agent` |
| `lib/skeleton.ts` | Round 1: pings for top-N per category → `output/skeleton/platforms.json` |
| `lib/provider-session.ts` | Round 2: runs section prompts in order, accumulates taxonomy |
| `lib/merge.ts` | Concatenates `output/providers/*/taxonomy.json` → `seeds/taxonomy/generated.seed.ts` |
| `lib/state.ts` | Tracks done/pending platforms + sections for resume |
| `lib/catalog-scan.ts` | Scans existing library for state (what's seeded, what's drilled) |
| `lib/recommend.ts` | Scores platforms by value/effort, suggests starting point |
| `lib/research.ts` | Web-search helper for doubts + existing-library discovery |

## Component 3 — Prompt Templates

Each emits **strict JSON** validated by Zod. Chained: `meta → capabilities → intents → selectors → constraints → validate`.

Example `capabilities.prompt.md`:
```
Generate the capability taxonomy for {platform} ({category}).
Return JSON: { "capabilities": [{ "slug","type","authScope","description" }], "messageTypes":[...] }
If known, base on UI at {discoveryHints.composerSelector}. Use web research if unsure.
```

## Component 4 — Output & Integration

`merge.ts` emits the same shape as `atomic-v8/v8.4` seeds → drops into `PrismaProviderTaxonomyStore`.

## Component 5 — Schema Extension

`PlatformCatalog` table (separate from `ProviderDefinition` so we don't create 1000 provider rows prematurely):

```prisma
model PlatformCatalog {
  id               String  @id
  slug             String  @unique
  displayName      String  @map("display_name")
  category         String  // social_messaging|social_feed|ai_chatbot|ide|agentic_agent|browser_automation|productivity|dating|forum
  url              String?
  description      String?
  catalogStatus    String  @default("skeleton") @map("catalog_status") // skeleton|drilling|complete
  sourceConfidence String @default("medium") @map("source_confidence")
  createdAt        Int     @map("created_at")
  @@index([category])
  @@map("platform_catalog")
}
```

Drilling into a skeleton entry promotes it: creates `ProviderDefinition` + `ProviderCapabilityTaxonomy`.

## Categories (full library)

1. **social_messaging** — WhatsApp, Telegram, Messenger, Signal, WeChat, Line, Viber
2. **social_feed** — Facebook, Instagram, X/Twitter, LinkedIn, Reddit, TikTok, Threads, Mastodon
3. **dating** — Tinder, Bumble, Hinge, OkCupid, Grindr
4. **ai_chatbot** — ChatGPT, Claude, Gemini, DeepSeek, Qwen, Perplexity, Grok, Poe
5. **ai_tooling** — Midjourney, Runway, Suno, ElevenLabs, Cursor, Replit, v0, Lovable
6. **ide** — VS Code, JetBrains suite, Neovim, Zed, Sublime
7. **agentic_agent** — Claude Code, Devin, OpenCode, Aider, Cline, Copilot CLI
8. **browser_automation** — Chrome CDP, Playwright, Puppeteer, Selenium, SeleniumBase
9. **productivity** — Notion, Slack, Discord, Trello, Asana, Linear, Jira, Confluence
10. **forum** — Reddit, StackOverflow, Discourse, HackerNews

## Ralph Loop (interactive orchestration)

```
loop:
  1. state = load()
  2. if no skeleton: run skeleton → platforms.json
  3. for each platform in state.pending (filtered by --category):
       a. agent scans existing library (catalog-scan)
       b. agent may web-search for existing libs / doubts (research)
       c. start session(state.slug): print next prompt
       d. agent generates section output → save → validate
       e. loop sections until taxonomy.json complete; mark complete
  4. merge all → seeds/taxonomy/generated.seed.ts
  5. bun run devops gate
  6. report: "N platforms, M capabilities, K intents"
```

## LLM Ping (two modes)

- `--mode auto`: `llm-ping.ts` calls LLM API directly (Z.AI/OpenAI via fetch), parses JSON, validates, retries 3×.
- `--mode agent`: orchestrator prints the next prompt; the opencode agent generates the output file; orchestrator validates. (No API key needed.)

## Recommendation Engine

`recommend` scans `PlatformCatalog` + existing seeds, scores each platform:
- **Value:** how many capabilities/intents it would unlock (category weight × coverage gap)
- **Effort:** how much is already known (seeds present = low effort; blank = high)
- Suggests: highest value / lowest effort first. If user is lost, prints top 3 with rationale.

## Web-Search Research

During any session, the agent may:
1. **Find existing taxonomy libraries** — search GitHub/npm for "platform capability taxonomy", "social media API capabilities", "CDP selector library" → download/reuse if found.
2. **Resolve doubts** — search for current selectors, API capabilities, rate limits when the agent is unsure.

## Verification

- `bunx prisma validate` passes (PlatformCatalog added)
- `bun run taxonomy-gen scan` prints library state
- `bun run taxonomy-gen recommend` suggests starting platform
- `bun run taxonomy-gen session facebook` runs interactive drill-down
- `bun run taxonomy-gen merge` produces `seeds/taxonomy/generated.seed.ts`
- `bun run typecheck` + `bun run lint` pass
