# Smaller-Model Agent Guide — VIVIM Development

**Target:** Agents with 50K-150K token context windows (Claude Haiku, GPT-4o-mini, DeepSeek V4 Pro, OpenCode)

## Core Invariant: Everything is DB-Driven

**Never hardcode provider-specific values in source code.** Composers, selectors, capture patterns, fetch URL patterns, composer types, send methods — all live in the database (`ProviderEndpoint` rows, seeded from JSON manifests).

Before doing ANY work, run:
```bash
bun run devops agentic preflight
```

This surfaces:
- Which providers are seeded and active
- Which Chrome profiles exist and have cookies
- Which Chrome instances are live and what pages they're on
- What gaps exist (missing endpoints, parsers, stream configs)

## The Development Loop (for limited-context agents)

### 1. START: Get context (always first)
```bash
bun run devops agentic preflight
```
Understand what exists before touching anything.

### 2. PLAN: Decompose the objective
```bash
bun run devops agentic start --objective="your objective here"
```
This produces a task DAG with scoped files. Each task tells you exactly which files to read.

### 3. DISCOVER: For new providers, auto-discover protocols
```bash
bun run devops discover-protocol https://newprovider.com --hint=provider-name
```
This auto-detects: composer elements, composer type, send buttons, response containers, framework. Produces a `manifestDraft` ready for seeding.

### 4. SEED: Write protocol to DB
Update `seeds/providers/<provider>.json` with the discovered data, then:
```bash
bun run seed
```

### 5. BUILD: Implement the changes
Read ONLY the files listed in the task's `requiredFiles`. Each task is ~12K tokens of required reading.

### 6. VERIFY: Run the task's verification command
```bash
bun test <test-file>
```

### 7. HANDOFF: Produce a compact artifact
When done (or when context fills up), write to `.runtime/agentic/handoff-<task-id>.json`:
```json
{"taskId":"...","status":"done","summary":"...","filesChanged":[...],"testsPassed":N}
```

### 8. RESUME: Continue from handoff
```bash
bun run devops agentic resume
```

## Provider Protocol Configuration

All provider-specific interaction details live in `seeds/providers/<slug>.json` → `ProviderEndpoint` DB rows:

| Field | Purpose | Example (Claude) |
|---|---|---|
| `selector.composer` | Primary composer CSS selector | `[data-testid="chat-input"]` |
| `selector.composer_fallback` | Fallback selector | `div.ProseMirror[contenteditable]` |
| `selector.fetch_patterns` | URL patterns for Fetch.enable | `["*claude.ai/api/*"]` |
| `selector.dom_selectors` | DOM fallback for response capture | `["div.font-claude-response"]` |
| `composer_type` | Typing strategy | `prosemirror` → maps to contenteditable |
| `send_method` | How to submit | `enter_key` (Claude), `button_click` (ChatGPT) |

**Never hardcode these in TypeScript.** The `COMPOSER_SELECTORS`, `SEND_BUTTON_SELECTORS`, and `CAPTURE_PATTERNS` maps in `provider-selectors.ts` and `conversation-manager.ts` are FALLBACKS only — used when the DB has no configuration for a provider.

## Key Files for Each Task Type

### Adding a new provider
- Read: `seeds/providers/<existing>.json` (template), `src/schema/provider-manifest.ts` (Zod schema)
- Modify: `seeds/providers/<new>.json`
- Verify: `bun run seed`, then `bun run devops discover-protocol <url>`

### Fixing a capture/composer issue
- Read: `src/engines/conversation-manager.ts:resolveHarnessMode()`, `src/executor/cdp-transport.ts:capture()`
- Modify: `seeds/providers/<slug>.json` endpoint selector section
- Verify: `bun run devops discover-protocol <url>`, then manual send test

### Adding a parser
- Read: `src/engines/stream-parser.ts`, an existing parser in `seeds/parsers/`
- Modify: `seeds/providers/<slug>.json` parsers section, or add inline parser JS
- Verify: `bun test tests/unit/engines/stream-parser.test.ts`

## Gotchas

1. **Fetch domain is required for modern SPAs.** Providers like Claude use `fetch()` for streaming — `Network.enable` alone won't capture these. Always include `fetch_patterns` in the endpoint selector config.

2. **SSE streaming means `Network.loadingFinished` fires late.** The response body isn't available until the stream closes. Use DOM fallback selectors for quick capture, or wire `StreamingProtocol` for progressive chunks.

3. **Enter-to-send vs button-to-send.** Discover this at runtime. Claude uses Enter key — no send button exists. ChatGPT has a send button. Always verify with `discover-protocol` before assuming.

4. **Chrome profiles and cookies.** If the provider shows a login page instead of chat, the profile has no cookies. Run the setup wizard first: `devops runtime-test setup --provider=<slug> --account=<email>`

5. **The Zod schema validates everything at seed time.** If you add a new field to the seed JSON, you MUST add it to `src/schema/provider-manifest.ts` or the seed will fail with a ZodError.
