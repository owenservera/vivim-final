---
name: devops-generators
description: >
  Autonomous + interactive taxonomy generation. Builds ProviderCapabilityTaxonomy
  library via LLM-driven pipeline (skeleton → drill-down → UI slot mapping →
  cross-surface binding). Use when expanding platform coverage or generating
  capability taxonomies.
---
# devops-generators

Autonomous + interactive taxonomy generation. Builds a `ProviderCapabilityTaxonomy`
library by pinging LLMs with structured prompts in a Ralph loop. Two rounds: skeleton
(`PlatformCatalog`) then drill-down (deep per-platform taxonomy).

> **CANONICAL TRACKER:** `docs/atomic-v3-fork-canon/01-tracker.md` (127 units).
> This skill drives taxonomy-generation work; it does NOT own the 127-unit plan.
> Deprecated references: `docs/atomic-v3/`, `docs/atomic-v4/`, `docs/atomic-v5/`,
> and any `atomic-v8` phrasing — the taxonomy generation pipeline was consolidated
> into the fork-canon tracker.

## Provider reality

The live system supports **6 providers**: `chatgpt`, `claude`, `gemini`,
`deepseek`, `qwen`, `grok` (see `seeds/providers/*.json`). The taxonomy pipeline
extends beyond these toward additional platforms (social, agentic, IDE, etc.), but
every generated capability MUST eventually resolve through the same
`UnifiedCapability` → `surfaces: ['cli','ui','api']` contract used by the 6 seeded
providers. Do NOT invent a second capability transport.

## When to Load

**Load this skill when:**
1. User says "generate taxonomy for X", "build provider library", "taxonomy session"
2. User asks "what platforms should we cover" or "where do I start" → run `recommend`
3. User wants to extend the taxonomy beyond the 6 seeded providers
4. User says "find existing taxonomy libraries" → use web-search research
5. User has doubts about a platform's selectors/capabilities → use web-search research

**Do NOT load when:**
- Just implementing atomic units from `docs/atomic-v3-fork-canon/` (use the atomic specs directly)
- Pure conversation, no taxonomy generation intent

## Two-Round Flow

### Round 1 — Skeleton (`PlatformCatalog`)
Build a master catalog of platforms across 10 categories. Curated ~150-200 (not
literal 1000 — deeper, higher confidence). Each entry: `slug`, `displayName`,
`category`, `url`, `description`, `catalogStatus: skeleton`.

Categories:
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

### Round 2 — Drill-down (`ProviderCapabilityTaxonomy`)
For each platform, run section prompts in order, accumulate into the output JSON:
`meta → capabilities → intents → selectors → constraints → validate`.

## Library-State Awareness (MANDATORY before each session)

Before generating for any platform, the agent MUST scan the existing library:

```powershell
bun run taxonomy-gen scan
```

This prints:
- Existing Prisma tables (schema.prisma)
- Existing seed files (seeds/)
- Existing `ProviderCapabilityTaxonomy` rows (if DB present)
- Current `PlatformCatalog` state (what's skeleton/drilling/complete)
- Existing resolver capabilities

The agent uses this to avoid duplication and to know what's already covered.

## Recommendations (when user is unsure)

If the user doesn't know where to begin:

```powershell
bun run taxonomy-gen recommend
```

This scores each platform by **value** (capabilities/intents unlocked × coverage gap) ÷
**effort** (how much is already known) and suggests the top 3 with rationale.

## Web-Search Research (during any session)

The agent MAY use web-search at any point to:
### A. Find existing taxonomy libraries to reuse
Search GitHub/npm for:
- "platform capability taxonomy github"
- "social media API capabilities list"
- "CDP selector library playwright"
- "messaging platform message types schema"
If a downloadable library is found, reuse it (download/adapt) instead of generating from scratch.

### B. Resolve doubts
When unsure about a platform's:
- DOM selectors (composer/send/message-list) → search "<platform> composer selector 2026"
- API capabilities → search "<platform> API capabilities docs"
- Rate limits → search "<platform> API rate limits"
- Auth scopes → search "<platform> OAuth scopes"

Use `web-search-prime`, `firecrawl`, or `exa` MCP tools (priority order). If none available,
flag `confidence: Low` and note the assumption.

## Interactive Gen Session (Ralph loop)

For a single platform drill-down:

```powershell
bun run taxonomy-gen session <slug>
```

The orchestrator:
1. Loads platform state
2. Determines next section (meta → capabilities → intents → selectors → constraints → validate)
3. Prints the rendered prompt (the "ping") — OR auto-pings LLM if `--mode auto`
4. Agent (you) reads the prompt, generates the section JSON, writes it to
   `scripts/taxonomy-gen/output/providers/<slug>/sections/<section>.json`
5. Orchestrator validates against Zod schema, saves, advances to next section
6. Loop until all sections done → merges into the output JSON, marks `complete`

### Prompt Template Contract
Each `prompts/*.prompt.md` is rendered with vars: `{platform}`, `{category}`,
`{prior}` (prior section output), `{discoveryHints}` (if known). Output MUST be strict JSON
conforming to the Zod schema in `scripts/taxonomy-gen/lib/<section>-schema.ts` (or the
equivalent schema module under `scripts/taxonomy-gen/lib/`).

### Section order + schemas

| Section | Output key | Schema |
|---------|-----------|--------|
| meta | platform meta | `{ slug, displayName, category, url, description, authType }` |
| capabilities | capabilities + messageTypes | `{ capabilities: [{slug,type,authScope,description}], messageTypes: [] }` |
| intents | nlpIntentPatterns | `{ intents: [{intent,patterns,confidence,requiredEntities}] }` |
| selectors | discoveryHints + nlpEntityTypes | `{ discoveryHints: {composerSelector,sendButtonSelector,messageListSelector}, entityTypes: [] }` |
| constraints | constraints + authRequirements | `{ constraints: {rateLimits,maxMessageLength,supportedMediaTypes}, authRequirements: [] }` |
| validate | full taxonomy | merged + validated |

## Merge & Integrate

After drill-downs complete:

```powershell
bun run taxonomy-gen merge
```

Produces the generated seed file (same shape as the v8.4 seed spec referenced by the
taxonomy generator). Imported by the seed runner → loads into `ProviderCapabilityTaxonomy`.

## Commands

| Command | Purpose |
|---------|---------|
| `bun run taxonomy-gen scan` | Print full library state |
| `bun run taxonomy-gen recommend` | Suggest where to start |
| `bun run taxonomy-gen skeleton` | Round 1: build PlatformCatalog |
| `bun run taxonomy-gen session <slug>` | Round 2: drill-down one platform |
| `bun run taxonomy-gen status` | Show progress (done/pending) |
| `bun run taxonomy-gen resume` | Continue from last incomplete |
| `bun run taxonomy-gen merge` | Merge outputs → seed file |

## Integration with DevOps

- Extends the taxonomy-generation units in `docs/atomic-v3-fork-canon/`. This skill
  automates the seed-generation step for the taxonomy pipeline.
- Output conforms to the provider taxonomy store contract.
- After merge: `bun run devops gate` must pass.

## Quality Rules

1. Every generated capability/intent needs a source (web research or known UI).
2. No duplication — scan library state first.
3. Strict JSON — validate with Zod before saving.
4. Confidence scoring — mark `sourceConfidence` per platform.
5. Reuse over regenerate — prefer existing libraries found via web search.
6. Fail-forward — if a section is uncertain, mark `confidence: Low` and continue.
7. Cross-surface parity — every generated capability must resolve across CLI/API/MCP/UI.
   Run `bun run devops verify-cross-surface` after integration.
