# Generation Sessions — Manifest

**Purpose:** Complete inventory of all generation sessions needed to build the taxonomy chain.

---

## Session Types

| Type | Command | Output | Duration |
|------|---------|--------|----------|
| **Skeleton** | `bun run taxonomy-gen skeleton` | PlatformCatalog entries | ~5 min |
| **Drill-down** | `bun run taxonomy-gen session <slug>` | Per-platform taxonomy | ~10 min/platform |
| **UI Mapping** | `bun run taxonomy-gen ui-map` | Enriched capability nodes | ~2 min |
| **Cross-Surface** | `bun run taxonomy-gen bind` | Unified capability specs | ~2 min |
| **Merge** | `bun run taxonomy-gen merge` | Final pool + seed | ~1 min |

---

## Round 1: Skeleton

Single session that produces the PlatformCatalog.

```bash
bun run taxonomy-gen skeleton
```

**Platforms to cover (10 categories):**

### 1. social_messaging (7)
whatsapp, telegram, messenger, signal, wechat, line, viber

### 2. social_feed (8)
facebook, instagram, x_twitter, linkedin, reddit, tiktok, threads, mastodon

### 3. dating (5)
tinder, bumble, hinge, okcupid, grindr

### 4. ai_chatbot (8)
chatgpt, claude, gemini, deepseek, qwen, perplexity, grok, poe

### 5. ai_tooling (8)
midjourney, runway, suno, elevenlabs, cursor, replit, v0, lovable

### 6. ide (6)
vscode, jetbrains, neovim, zed, sublime, vim

### 7. agentic_agent (7)
claude_code, devin, opencode, aider, cline, copilot_cli, amp

### 8. browser_automation (6)
chrome_cdp, playwright, puppeteer, selenium, seleniumbase, rod

### 9. productivity (9)
notion, slack, discord, trello, asana, linear, jira, confluence, clickup

### 10. forum (5)
stackoverflow, discourse, hackernews, devto, phabricator

**Total: 69 platforms** (curated, not exhaustive)

---

## Round 2: Drill-Down

One session per platform. Each session follows the 6-section protocol:

| Section | Prompt | Output |
|---------|--------|--------|
| meta | `prompts/meta.prompt.md` | Platform meta |
| capabilities | `prompts/capabilities.prompt.md` | Capabilities + message types |
| intents | `prompts/intents.prompt.md` | NLP intent patterns |
| selectors | `prompts/selectors.prompt.md` | Discovery hints + entity types |
| constraints | `prompts/constraints.prompt.md` | Rate limits + auth requirements |
| validate | `prompts/validate.prompt.md` | Merged + validated taxonomy |

**Session count:** 69 platforms × 6 sections = 414 section prompts

**Execution order:**
1. Complete all skeleton entries first
2. Drill down by category (one category at a time)
3. Within a category, drill down platforms in order of complexity (simple first)

---

## Round 3: UI Slot Mapping

Single session that processes all capability nodes.

```bash
bun run taxonomy-gen ui-map
```

**Input:** All capability nodes from Round 2
**Output:** Capability nodes with UI fields populated

**Process:**
1. Load `pool.taxonomy.json`
2. Filter to `kind === 'capability'` nodes
3. For each node, run `mapCapabilityToUI(node)`
4. Merge UI fields into node
5. Write enriched pool back

---

## Round 4: Cross-Surface Binding

Single session that generates cross-surface specs.

```bash
bun run taxonomy-gen bind
```

**Input:** Enriched capability nodes from Round 3
**Output:** Capability nodes with CLI/API/MCP/UI specs

**Process:**
1. Load enriched pool
2. Filter to `kind === 'capability'` nodes
3. For each node, run `bindCrossSurface(node)`
4. Merge cross-surface fields into node
5. Write final pool back

---

## Merge

Single session that produces the final seed file.

```bash
bun run taxonomy-gen merge
```

**Input:** Final enriched pool
**Output:**
- `seeds/taxonomy/pool.taxonomy.json` — master pool
- `seeds/taxonomy/generated.seed.ts` — Prisma seed file

---

## Total Session Count

| Round | Sessions | Effort |
|-------|----------|--------|
| Round 1: Skeleton | 1 | S |
| Round 2: Drill-down | 69 | M each |
| Round 3: UI Mapping | 1 | S |
| Round 4: Cross-Surface | 1 | S |
| Merge | 1 | S |
| **Total** | **73** | — |

**Estimated total time:** ~12 hours (69 drill-downs × 10 min + overhead)

---

## Session Execution Strategy

### Parallel Execution

Drill-down sessions within a category are independent and can run in parallel:

```
Category: social_messaging (7 platforms)
  ├── whatsapp.session.ts     ← run in parallel
  ├── telegram.session.ts     ← run in parallel
  ├── messenger.session.ts    ← run in parallel
  ├── signal.session.ts       ← run in parallel
  ├── wechat.session.ts       ← run in parallel
  ├── line.session.ts         ← run in parallel
  └── viber.session.ts        ← run in parallel
```

### Sequential Dependencies

```
Skeleton (1 session)
    ↓
Drill-downs (69 sessions, parallel within categories)
    ↓
UI Mapping (1 session)
    ↓
Cross-Surface (1 session)
    ↓
Merge (1 session)
```

### Resume Strategy

Each session writes its output to `output/live/<slug>.taxonomy.json`. If a session fails, it can be resumed from the last completed section:

```bash
bun run taxonomy-gen session whatsapp --resume
```

---

## Quality Gates

After each round, run verification:

| Round | Gate Command | Checks |
|-------|-------------|--------|
| Round 1 | `bun run taxonomy-gen status` | All platforms have skeleton entries |
| Round 2 | `bun run taxonomy-gen validate` | All platforms have complete taxonomy |
| Round 3 | `bun run taxonomy-gen verify-ui` | All capabilities have UI fields |
| Round 4 | `bun run taxonomy-gen verify-bindings` | All capabilities have cross-surface specs |
| Merge | `bun run devops gate` | Full quality gate passes |
