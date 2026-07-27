---
name: provider-onboard-explorer
description: Agent-as-explorer (APOP-AX) provider onboarding workflow. The agent IS the orchestrator with creative license to autonomously discover ANY new LLM provider's UI surface, capture streaming responses, generate parsers, and seed everything to DB. Use when onboarding any new provider that doesn't yet have a working parser.
---

# Provider Onboarding — Agent-as-Explorer (APOP-AX)

## Overview

You are given a high-level objective like "onboard Grok at https://x.com/i/grok" and a toolbox of capabilities. You decide what to try, in what order, retrying with different strategies based on what you discover. There is no fixed pipeline — you ARE the runtime.

**This skill works for ANY new provider** — DeepSeek, Grok, Mistral, or any future provider not yet in the system. The provider-specific notes below are starting points, not constraints. Every provider is different; your job is to discover how it works.

## How to Think: Problem-Solving Culture

**Before you run any tool or script, think.** The tools are a last resort, not a first instinct. Your LLM brain is the primary problem-solving engine. The scripts just do the mechanical parts you can't do from text (CDP capture, DB writes).

### The Mindset

1. **Observe first, act second.** Before clicking anything, look at the page. Read the DOM. Understand the structure. What kind of app is this? React? Vue? Plain HTML? What framework conventions does it follow?

2. **Use what you know.** You've seen hundreds of web apps. ChatGPT, Claude, Gemini, Mistral — they all follow similar patterns. If you've never seen a provider before, reason from what you know about web app architecture. Where is the input field likely to be? Where does streaming output appear?

3. **Try the obvious first.** Before invoking `SelectorRefiner` or `FormatClassifier`, try the obvious selectors yourself: `textarea`, `[contenteditable="true"]`, `#prompt-textarea`. You can read a page's DOM. You don't need an LLM to tell you what's there.

4. **Reason about failure.** When something doesn't work, don't just try the next thing in a list. Think about WHY it failed. Is the selector wrong? Is the button hidden? Did the page change state? What would you do if you were a human using this app?

5. **Adapt to the provider.** Every provider has quirks:
   - Quill editors (`.ql-editor`) need different handling than ProseMirror (`.ProseMirror`) or contenteditable
   - Some providers use Enter to send, others require clicking a button
   - Some hide the send button until text is entered
   - Some require model selection before the input area appears
   - Some use OAuth popups that redirect the page
   - Some have anti-automation detection (Cloudflare, webdriver checks)

6. **Find the path of least resistance.** If a provider blocks automation (Cloudflare challenge, webdriver detection), can you work around it? Can you use a different CDP method? Can you intercept the network layer instead of the DOM?

7. **Think about edge cases.** What if the provider has multiple chat modes? What if it requires a "new conversation" click first? What if it uses a different composer for different models?

8. **Don't get stuck.** If you're looping (trying the same thing 3+ times), STOP. Step back. Re-examine the page from scratch. Take a screenshot. Read the accessibility tree. The answer is usually obvious once you look at the right thing.

### What NOT to Do

- **Don't blindly follow a checklist.** This is a creative exploration task, not a validation pipeline.
- **Don't run tools you don't understand.** If you're calling `FormatClassifier.classify()`, know what it does and why you're using it.
- **Don't give up after one failure.** Try at least 3 different approaches before escalating.
- **Don't ignore what you see.** If the page shows you something (a model selector, a settings panel), use that information. The page is telling you things.

## Your Toolbox

| Tool | File | Purpose | When to Use |
|------|------|---------|-------------|
| `onboard-provider` | `devops/onboard-provider.ts` | **Start here.** Seeds provider def, launches Chrome, returns `debugPort` | Always — Step 0 |
| `LiveCaptureEngine` | `src/engines/live-capture-engine.ts` | Send test message + capture streaming response via CDP | Step 2 — after you know the selectors |
| `StreamingResponseAnalyzer` | `src/engines/streaming-response-analyzer.ts` | Classify format + generate parser (try this FIRST) | Step 3 — try before FormatClassifier |
| `FormatClassifier` | `src/engines/format-classifier.ts` | LLM fallback when analyzer confidence < 0.7 | Step 3 — only if StreamingResponseAnalyzer fails |
| `ProtocolDiscoveryEngine` | `src/engines/protocol-discovery.ts` | Probe DOM for composers, buttons, network patterns | Step 1 — only if you can't find selectors yourself |
| `SelectorRefiner` | `src/engines/selector-refiner.ts` | LLM fallback when probes yield low confidence | Step 1 — only if ProtocolDiscoveryEngine fails |
| `ProviderRegistrar` | `src/engines/provider-registrar.ts` | Upsert full manifest to DB | Step 4 — after you have everything |
| `onboard-verify` | `devops/onboard-verify.ts` | Post-onboarding verification (7 DB checks) | Step 5 — always |
| Session logger | `devops/llm-testing/session-logger.ts` | Log findings that survive context compaction | Any time you discover something |

## Step-by-Step Flow

### Step 0: Account Registration

```bash
bun run devops runtime-test onboard-provider --provider=<slug> --url=<url> --account=owservera
```

Returns JSON: `{ ok, debugPort, profileDir, instructions }`

**If Chrome fails to launch:**
- Kill stale Chrome: `Get-Process chrome | Stop-Process -Force`
- Delete SingletonLock in profile dir
- Retry

**If login timeout (5 min):**
- User didn't log in. Re-run — Chrome re-opens at login page.

### Step 1: Attach CDP + Explore UI

**Think first.** Before calling any tool, ask yourself:
- What kind of app is this? (SPA? Next.js? Plain HTML?)
- What framework is it using? (React? Vue? Angular?)
- What pattern does the chat UI likely follow?
- Does it have a model selector? Feature toggles? Settings?

**Then explore.** Use CDP to read the page:

1. **Take a screenshot** — see what the page looks like to a human
2. **Read the accessibility tree** — find textboxes, buttons, landmarks
3. **Check the DOM yourself** — look for `textarea`, `[contenteditable]`, known selectors
4. **Try known patterns:**
   - `textarea` — most common
   - `#prompt-textarea` — ChatGPT pattern
   - `[contenteditable="true"]` — Claude/Gemini pattern
   - `.ql-editor` — Quill editor (some providers)
   - `.ProseMirror` — ProseMirror (Claude)
5. **Check for model selectors** — some providers require selecting a model before the input appears
6. **Check for feature toggles** — search mode, code mode, canvas mode
7. **Check shadow DOM or iframes** — some providers embed editors this way

**If you can't find selectors manually:**
- Use `ProtocolDiscoveryEngine.discover()` — it probes DOM with multiple selector strategies
- Use `SelectorRefiner` with a page snapshot — LLM suggests selectors from the DOM

**If no send button found:**
- Type text first — buttons may be hidden until text is entered
- Look for `aria-label*="send"`, `data-testid*="send"`
- Try Enter key instead (common for contenteditable)
- Check if the button is a `<button>` with no text (icon-only)

### Step 2: Capture Streaming Response

```typescript
const engine = new LiveCaptureEngine(cdpClient, sessionId)
const result = await engine.captureResponse({
  composerSelector: 'textarea',   // ← your discovered selector
  sendMethod: 'enter',             // ← your discovered method
  testMessage: 'Hello',
  captureTimeoutMs: 30_000,
})
```

**If capture returns empty body (0 bytes):**
1. Check `Network.requestWillBeSent` events — find the actual streaming URL
2. Try broader `streamUrlPattern` override
3. Provider may use WebSocket — check CDP for WebSocket frames
4. Try different send method (Enter vs button click)
5. Dispatch `click()` with `{bubbles: true, cancelable: true}`

**If capture timeout (30s):**
1. Shorter test message
2. Check if provider requires model selection before sending
3. Provider may need feature toggle (e.g. "Search" vs "Chat")

### Step 3: Analyze Format

```typescript
const analyzer = new StreamingResponseAnalyzer()
const analysis = analyzer.analyze(result.rawBody)
```

**If confidence >= 0.7:** Use `analysis.logicCode` directly.

**If confidence < 0.7:** Use `FormatClassifier`:
```typescript
const classifier = new FormatClassifier(llmClient)
const classification = await classifier.classify(result.rawBody)
const parserCode = await classifier.generateParser(result.rawBody, classification, 'grok')
```

**If parser produces empty blocks:**
1. Wrong `dataPath` — examine raw body yourself
2. Re-capture with longer timeout
3. Body may have XSSI prefix (`)]}'`) that needs stripping
4. Try `FormatClassifier.generateParser()` with raw body

### Step 4: Seed to DB

Build manifest from discovered data + existing template in `seeds/providers/manifests.ts`:

```typescript
const registrar = new ProviderRegistrar(providerStore)
await registrar.seedProvider(slug)
```

Or manually upsert via `ProviderStore`:
- `upsertDefinition()` — provider metadata
- `upsertEndpoint()` — landing + chat + login URLs with selectors
- `upsertModel()` — discovered models
- `upsertParser()` — generated logic_code
- `upsertCapability()` — send_message binding

### Step 5: Verify

```bash
bun run devops runtime-test onboard-verify --provider=<slug>
```

All 7 checks must pass:
- `provider_definition` ✓
- `provider_account` ✓
- `profile_directory` ✓
- `provider_endpoints` ✓
- `provider_models` ✓
- `provider_parser` ✓
- `provider_capabilities` ✓

## Where to Store Discovered Protocols & Findings

### 1. Session Log (Append-Only JSONL)

**Location:** `.runtime/llm-testing/session-log.jsonl`

This is your primary findings log. Append entries as you discover things. Each line is a JSON object.

**Three entry types:**

```bash
# Log a finding (selector, format, gotcha, etc.)
bun run devops llm-testing-log finding --provider=<slug> --severity=P0 --category=<cat> --detail="..."

# Log a phase result (pass/fail/skip)
bun run devops llm-testing-log phase --provider=<slug> --phase=<name> --status=pass --durationMs=1234

# Log a decision (why you chose one approach over another)
bun run devops llm-testing-log decision --provider=<slug> --decision="Use Enter key" --rationale="Provider hides send button until text entered"
```

**Categories for findings:**
| Category | Use For |
|----------|---------|
| `chrome-launch` | Chrome startup, profile, CDP connection issues |
| `selector` | Composer, send button, response container discoveries |
| `parser` | Wire format analysis, parser generation results |
| `capability` | Capability registration, binding issues |
| `api` | API endpoint issues |
| `frontend` | UI rendering, parity issues |
| `edge-case` | Provider-specific quirks and gotchas |
| `performance` | Latency, timeout issues |

**Why this matters:** Context compaction loses your findings. The log persists everything. When you resume after compaction, read the log to recover state.

### 2. Provider Manifest (seeds/providers/manifests.ts)

**Location:** `seeds/providers/manifests.ts`

After onboarding, add/update the provider manifest with:
- `slug` — provider identifier
- `displayName` — human-readable name
- `landingUrl`, `chatUrl`, `loginUrl` — entry points
- `selectors` — discovered composer, send, response selectors
- `streamPatterns` — streaming URL patterns
- `models` — discovered model list
- `capabilities` — provider-bound capability slugs

**This is the source of truth for provider protocol definitions.** It feeds `ProviderRegistrar.seedProvider()` which upserts to DB.

### 3. Provider Endpoints + Parsers (Database)

**Location:** `ProviderEndpoint` + `ProviderParser` Prisma tables

The DB rows are the runtime source of truth. The manifest feeds them, but the DB is what engines read at runtime:
- `ProviderEndpoint` — landing + chat URLs with selectors, streaming patterns, auth mode
- `ProviderParser` — inline `logicCode` with format detection logic
- `ProviderCapability` — capability bindings (send_message, select_model)

### 4. Screenshots (Session Writer)

**Location:** `.runtime/llm-testing/sessions/screenshots/`

Screenshots taken during exploration. Use `SessionWriter.writeSession()` to persist them alongside session traces.

### 5. Session Traces (Session Writer)

**Location:** `.runtime/llm-testing/sessions/<sessionId>.json`

Full session trace with all test results, findings, and metadata. Use `SessionWriter` for structured writes.

### 6. Reports (Session Writer)

**Location:** `.runtime/llm-testing/reports/<sessionId>.markdown`

Human-readable markdown reports summarizing the session.

### Storage Summary

| What | Where | Format | When to Write |
|------|-------|--------|---------------|
| Findings, phases, decisions | `.runtime/llm-testing/session-log.jsonl` | JSONL (append) | Any time you discover something |
| Provider protocol definition | `seeds/providers/manifests.ts` | TypeScript | After onboarding complete |
| Runtime protocol rows | DB (ProviderEndpoint, ProviderParser, etc.) | Prisma | Via ProviderRegistrar |
| Screenshots | `.runtime/llm-testing/sessions/screenshots/` | PNG | During exploration |
| Full session trace | `.runtime/llm-testing/sessions/<id>.json` | JSON | After session ends |
| Summary report | `.runtime/llm-testing/reports/<id>.md` | Markdown | After session ends |

## Failure Recovery Quick Reference

| Symptom | Try |
|---------|-----|
| Composer not found | Screenshot → accessibility tree → known selectors → shadow DOM → SelectorRefiner |
| Send button not found | Type text first → aria-label → data-testid → Enter key → click candidates |
| Empty capture body | Check Network events → broader URL filter → WebSocket → different send method |
| Timeout waiting for stream | Shorter message → check model selection → check feature toggle |
| Unknown wire format | FormatClassifier.classify() → generateParser() |
| Parser empty output | Check dataPath → re-capture → strip XSSI prefix → try generic fallback |
| SelectorRefiner bad output | Re-run with more page context → try manual selectors → use ProtocolDiscoveryEngine |
| DB seeding fails | Check ProviderStore contract → verify Prisma schema → check for duplicate keys |
| Verify fails on parser | Parser needs logic_type='inline' + non-empty logic_code |
| Chrome launch fails | Kill stale processes → delete SingletonLock → check profile dir → retry |

## Provider-Specific Notes

| Provider | URL | Composer | Send | Stream Format | Gotcha |
|----------|-----|----------|------|---------------|--------|
| deepseek | chat.deepseek.com | `textarea` | Enter | SSE (OpenAI-compatible) | Standard — lowest risk |
| grok | x.com/i/grok | TBD | TBD | TBD | Anti-automation (`navigator.webdriver`), Cloudflare, complex SPA |
| mistral | chat.mistral.ai | TBD | TBD | TBD | Google OAuth popup for login, React SPA |

**These are starting points.** The agent's job is to discover the actual selectors and formats. The "TBD" entries are invitations to explore, not limitations.

## Key Invariants

- **Governor Canon:** All CDP through `CdpSender` interface. Never import `BunCdpClient`.
- **Idempotent DB writes:** Upserts matched by slug/name+version. Re-running overwrites safely.
- **DB-only parsers:** Generated `logic_code` goes into `ProviderParser.parserLogicCode` with `logic_type=inline`.
- **Profile = source of truth:** `ProfileAllocator.isAuthenticated()` checks cookie files, not DB loginState row.

## See Also

- `provider-testing` skill — old 8-phase pipeline (for reference)
- `sota-10-autonomous-provider-onboarding.md` — full design doc
- `docs/plans/sota-10-impl/` — planning artifacts (research, data model, contracts, tasks)
