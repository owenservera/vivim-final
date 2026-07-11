# Audit: capability-lab — VIVIM Passive-Intercept CDP Lab

**Date:** 2026-07-11
**Scope:** `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa\capabilit-lab`
**Goal:** Identify architecture patterns, best practices, and portability opportunities for vivim-final

---

## Executive Summary

capability-lab is a **CDP-driven AI provider automation lab** that drives real browser UIs (Gemini, ChatGPT, Claude, DeepSeek, Qwen, Studio-AI, Z-AI) via Chrome DevTools Protocol. It has **no API keys, no token extraction, no reverse-engineered RPC** — just browser automation that types prompts, clicks send, and reads streaming responses off the wire.

**Key innovation:** READ/WRITE split architecture. WRITE channel uses trusted CDP Input events. READ channel injects a streaming harness BEFORE actions to capture 100% of tokens via fetch/XHR monkey-patching.

**Size:** ~30 source modules, ~560 lines of README, 7 provider recipe sets, 36 CLI commands. Runtime: Bun. Dependencies: only Zod.

---

## Architecture Overview

### Core Design Principle: READ/WRITE Split

```
WRITE Channel (CDP Input.* — Trusted Events)
  A11y Locator → Input.insertText → Input.dispatchKeyEvent → Input.dispatchMouseEvent

READ Channel (Passive Stream Intercept)
  Inject harness BEFORE action → Monkey-patch fetch + XHR → Clone response → Parse by provider
```

### Module Map

| Module | Path | Lines | Purpose |
|--------|------|-------|---------|
| **CDP Client** | `src/cdp/client.ts` | 340 | WebSocket CDP transport, auto-reconnect, Fetch/IO domain |
| **CDP Locator** | `src/cdp/locator.ts` | 207 | A11y tree rebuild, role+name matching, CSS-first fallback chain |
| **CDP Input** | `src/cdp/input.ts` | 138 | Trusted input dispatch (isTrusted=true), ProseMirror Enter handling |
| **CDP Network** | `src/cdp/network.ts` | 171 | Network domain traffic collection, stream subscription |
| **Recipe Executor** | `src/recipe/executor.ts` | 624 | Full locate→act→observe pipeline with 3-layer stream capture |
| **Recipe Schema** | `src/recipe/schema.ts` | 85 | Zod validation for ActionRecipe JSON |
| **Content Pipeline** | `src/content/pipeline.ts` | 183 | Provider-dispatch: SSE vs batchexecute routing |
| **Content Blocks** | `src/content/blocks.ts` | 64 | Canonical block model (13 block types) |
| **Stream Harness** | `src/content/harness.ts` | 272 | In-page fetch/XHR monkey-patch, SPA navigation survival |
| **SSE Parser** | `src/parsers/sse.ts` | 125 | Line-framer, per-provider delta extraction |
| **Gemini Parser** | `src/parsers/gemini.ts` | 140 | batchexecute envelope decoder, WrbFrame parser |
| **Artifacts** | `src/parsers/artifacts.ts` | 73 | Code fence, antArtifact, thinking block extraction |
| **Provider Registry** | `src/providers/registry.ts` | 104 | Declarative config table (7 providers) |
| **Browser Launcher** | `src/browser/launcher.ts` | 159 | Chrome launch with persistent profiles, offscreen mode |
| **Profile Registry** | `src/browser/registry.ts` | 87 | Profile pool with LRU eviction (max 6) |
| **Confidence Governor** | `src/learn/confidence.ts` | 138 | 5-factor confidence scoring + drift radar + barrier-breaking |
| **Outcomes** | `src/learning/outcomes.ts` | 181 | Outcome recording, pattern store, replay-verify gate |
| **Healing Portfolio** | `src/healing/portfolio.ts` | 456 | Multi-strategy selector management, health scoring |
| **Healing Classifier** | `src/healing/classifier.ts` | 296 | Failure type classification (5 types) with signal extraction |
| **Healing Engine** | `src/healing/healer.ts` | 250 | Parallel healing with semaphore, timeout, strategy selection |
| **Health Monitor** | `src/healing/monitor.ts` | 302 | Real-time regression detection, trend analysis |
| **Auto-Demotion** | `src/healing/demotion.ts` | 236 | Strategy promotion/demotion pipeline with cooldown |
| **Healing CDP** | `src/healing/cdp-integration.ts` | 248 | Healing locator wrapping CDP with fallback strategies |
| **Prediction** | `src/prediction/predictor.ts` | 108 | Cross-provider strategy prediction, transfer influences |
| **Optimizer** | `src/prediction/optimizer.ts` | 60 | Strategy ranking, optimization suggestions |
| **Promotion Ladder** | `src/promotion/ladder.ts` | 127 | Status state machine with auto-promote/demote |
| **Promotion Scorer** | `src/promotion/scorer.ts` | 117 | Multi-factor scoring for promotion decisions |
| **Promotion Gate** | `src/promotion/gate.ts` | 122 | Oversight queue, approve/reject/modify workflow |
| **Action Registry** | `src/action-registry/registry.ts` | 181 | Portable DSL: guards → steps → verify, expression builders |
| **Discovery Scanner** | `src/discovery/scanner.ts` | 77 | Viewport sweep, common candidate generation |
| **Discovery Prober** | `src/discovery/prober.ts` | 99 | Interactivity probing, auto-registration |
| **Discovery Registrar** | `src/discovery/registrar.ts` | 68 | Pipeline orchestration: scan → probe → register |

---

## Key Patterns Worth Porting

### 1. Recipe System (JSON-Driven Capabilities)

**Source:** `recipes/` directory + `src/recipe/schema.ts` + `src/recipe/executor.ts`

Recipes are **JSON files** that define complete provider interactions. No code changes to add new capabilities.

```json
{
  "name": "send-text",
  "provider": "claude",
  "label": "Send a text prompt to Claude",
  "url": "https://claude.ai/",
  "steps": [
    {
      "id": "type-prompt",
      "locate": {
        "role": "textbox",
        "strategy": "css-first",
        "fallbackSelectors": [
          "div[contenteditable='true']",
          "div.ProseMirror",
          "fieldset textarea"
        ]
      },
      "act": { "verb": "type", "text": "{{prompt}}" }
    },
    {
      "id": "submit",
      "locate": { "skipLocate": true },
      "act": { "verb": "submit", "submit": "enter" },
      "observe": { "method": "POST", "urlPattern": "claude.ai/api", "streaming": true, "settleMs": 60000 }
    }
  ]
}
```

**Key features:**
- `when` clauses: preconditions (exists, visible, url, not) — skip step if unmet, not failure
- `locate.strategy`: `ax-first` | `css-first` | `css-only` — controls locate order
- `locate.fallbackSelectors`: CSS selectors tried before AX tree
- `locate.skipLocate`: bypass locate for submit-after-type steps
- `act.verb`: click | type | submit | upload | navigate | wait | menu-select
- `observe.settleMs`: how long to wait for stream response
- `{{prompt}}` template variable substitution

**Port effort:** 2 hours. Zod schema + loader. JSON files map directly.

---

### 2. 3-Layer Stream Capture Architecture

**Source:** `src/recipe/executor.ts:87-624`

The executor uses THREE layers to capture streaming responses, falling through each:

```
Layer 1: CDP Binding (fastest, push-based)
  → __vivimBlock binding fires for each ContentBlock
  → Falls through if binding not supported

Layer 2: Fetch Domain Interception (authoritative, full body)
  → Fetch.requestPaused catches completion URL
  → getResponseBody retrieves full SSE body after stream ends
  → Replaces live blocks with authoritative full-body parse

Layer 3: CDP Network Collector (injection-proof, nav-proof)
  → collectTraffic() arms Network domain BEFORE any step
  → fetchBodies() pulls response bodies after loadingFinished
  → Works even when page bypasses fetch monkey-patch
```

**Also:** In-page harness (`BLOCK_HARNESS_JS`) monkey-patches `window.fetch` and `XMLHttpRequest` for SSE providers, with SPA navigation survival (re-arms on URL change).

**Key insight:** "Arm observe before act" — inject harness BEFORE clicking send so zero tokens are lost.

**Port effort:** 4 hours. CDP client + harness + pipeline integration.

---

### 3. Confidence Governor (5-Factor Scoring)

**Source:** `src/learn/confidence.ts:54-81`

```typescript
confidence = status_ladder_weight × 0.35    // prospect=0, test-N=0.3+N*0.2, stable=0.95
           + success_rate_weight  × 0.25    // oks/(oks+fails)
           + recency_weight       × 0.15    // 14-day linear decay
           + replay_verify_boost  × 0.15    // +0.15 if verified
           + drift_penalty                  // -0.2 if drift detected
           + pattern_hit_bonus    (max +0.10)  // +0.02 per hit, capped

escalate() returns true when confidence < threshold (default 0.65)
```

**Also includes:**
- `scanDrift()`: scans observations for intended-vs-actual divergence
- `findSafeBannerAccept()`: auto-dismiss cookie consent banners

**Port effort:** 1 hour. Pure functions, zero dependencies. Identical to cap-store's formula but simpler.

---

### 4. Action Registry (Portable DSL)

**Source:** `src/action-registry/` — `types.ts` + `registry.ts`

Actions are **declarative programs** with guards, opcodes, and postconditions:

```typescript
interface ActionImpl {
  when?: Predicate[];     // preconditions (all must hold)
  steps: Step[];          // opcode sequence
  verify?: Predicate[];   // postconditions (failure = false positive → flaky)
  status: string;         // auto-advanced by execution
  runs: number; oks: number; fails: number; falsePos: number; streak: number;
}
```

**Step opcodes:** click | type | wait | navigate

**Expression builders** generate pure JS that runs in page context:
- `clickExpr(text?, selector?)` — finds button by text, scrolls, clicks
- `typeExpr(text, into?, selector?, submit?)` — handles contenteditable + textarea
- `presentExpr(loc)` — checks element existence
- `predExpr(p)` — evaluates predicates (urlIncludes, exists, absent)

**Status auto-advancement:** `advanceStatus()` promotes based on streak, demotes on failure. `markFalsePositive()` demotes to flaky.

**Port effort:** 2 hours. Expression builders are page-context JS, directly portable.

---

### 5. Self-Healing Selector System

**Source:** `src/healing/` — 8 files, ~2000 lines total

A complete self-healing system for selector failures:

#### 5a. Portfolio Generator (`portfolio.ts`)
Generates 5 fallback strategies per capability:
1. **Primary** — original selector (confidence 0.8)
2. **Role+Name** — `[role="X"][aria-label~="Y"]` (confidence 0.7)
3. **ARIA Variant** — `[aria-label="Y"]` (confidence 0.6)
4. **Text-based** — `text~"Y"` (confidence 0.5)
5. **Structural** — `X:nth-of-type(1)` (confidence 0.4)

Health score = average of (successRate × confidence) across strategies.

#### 5b. Failure Classifier (`classifier.ts`)
Classifies failures into 5 types:
- `selector_not_found` — element missing
- `element_changed` — stale element
- `dom_restructured` — page reloaded/changed
- `timing_issue` — timeout
- `wrong_capability` — ambiguous selector

Each type maps to suggested healing strategies. Classification uses regex pattern matching on error messages with weighted scoring.

#### 5c. Parallel Healer (`healer.ts`)
Tries healing strategies in parallel with:
- **Semaphore** — max concurrent attempts (default 5)
- **Timeout** — per-strategy timeout (default 3s)
- **Strategy selection** — prioritizes suggested types, falls back to all strategies sorted by confidence × successRate

#### 5d. Health Monitor (`monitor.ts`)
- Per-strategy health: successRate, trend (improving/stable/declining), regression detection
- Overall health: healthy (≥0.8), degraded (≥0.5), critical (<0.5)
- Regression detection: successRate drop > threshold (default 0.2) with minimum samples

#### 5e. Auto-Demotion Pipeline (`demotion.ts`)
- Demote: successRate < 0.3 AND regression detected
- Promote: successRate > 0.7 AND confidence < successRate
- Cooldown: 1 hour between decisions
- Minimum samples: 10 before any decision

#### 5f. CDP Integration (`cdp-integration.ts`)
`HealingLocator` wraps the CDP locator:
1. Try primary locator (CSS + AX tree)
2. On failure → classify failure
3. Select strategies based on classification
4. Try healed strategies in parallel
5. Return winning strategy or report failure

**Port effort:** 8 hours. The healing system is the most complex module but highly valuable for robustness.

---

### 6. Provider Config Registry (Data, Not Code)

**Source:** `src/providers/registry.ts`

```typescript
export const PROVIDERS: Record<string, ProviderConfig> = {
  chatgpt: {
    provider: 'chatgpt',
    landingUrl: 'https://chatgpt.com/',
    readySelector: '#prompt-textarea, .ProseMirror',
    streamUrlPattern: 'backend-api/conversation',
    streamTransport: 'sse',
    streamTerminal: '[DONE]',
    sseFormat: 'openai',
    composerSelector: '#prompt-textarea',
    composerIsContentEditable: false,
  },
  claude: {
    provider: 'claude',
    landingUrl: 'https://claude.ai/new',
    readySelector: 'div[contenteditable="true"], fieldset textarea',
    streamUrlPattern: 'claude.ai/api',
    streamTransport: 'sse',
    streamTerminal: 'message_stop',
    composerSelector: 'div[contenteditable="true"]',
    composerIsContentEditable: true,
    locale: 'en',
    localeVariants: { 'New chat': 'Nueva conversación' },
  },
  gemini: {
    provider: 'gemini',
    streamTransport: 'batchexecute',
    streamTerminal: '[["e"',
  },
  // ... deepseek, studio-ai, z-ai, qwen
};
```

**Key insight:** A provider UI change = one config edit. Core executor never changes.

**Port effort:** 30 min. Data-only, directly portable.

---

### 7. Content Block Model (13 Block Types)

**Source:** `src/shared/blocks.ts` (re-exported via `src/content/blocks.ts`)

```typescript
type ContentBlock =
  | TextBlock        // { kind: 'text', format: 'markdown', content: string }
  | ThinkingBlock    // { kind: 'thinking', content: string }
  | CodeBlock        // { kind: 'code', language: string, code: string }
  | ArtifactBlock    // { kind: 'artifact', type: string, content: string, attrs: Record<string, string> }
  | ImageBlock       // { kind: 'image', url: string, alt?: string }
  | FileBlock        // { kind: 'file', url: string, mimeType: string, name: string }
  | CitationBlock    // { kind: 'citation', text: string, url: string, title?: string }
  | ToolUseBlock     // { kind: 'tool_use', toolName: string, input: unknown, output?: unknown }
  | ChartBlock       // { kind: 'chart', chartType: string, data: unknown }
  | SearchResultBlock // { kind: 'search_result', query: string, results: unknown[] }
  | MetaBlock        // { kind: 'meta', key: string, value: unknown }
  | ErrorBlock       // { kind: 'error', code: string, message: string, recoverable: boolean }
```

**Type guards:** `isTextBlock()`, `isCodeBlock()`, etc.

**Port effort:** 30 min. Type definitions + guards.

---

### 8. CDP Client (Full-Featured)

**Source:** `src/cdp/client.ts`

Features beyond basic CDP:
- **Auto-reconnect** with exponential backoff (1s → 16s, configurable)
- **Fetch domain** — `enableFetch()`, `fulfillRequest()`, `continueRequest()`, `takeResponseBodyAsStream()`
- **IO domain** — `ioRead()`, `ioClose()` for streaming response bodies
- **Page domain** — `screenshot()`, `navigate()`, `armDocumentStart()` (inject without immediate execution)
- **Runtime domain** — `addBinding()` for CDP binding callbacks
- **DOM domain** — `getDocument()`, `querySelector()`, `getOuterHTML()`
- **Event system** — `on()`, `once()`, `off()` with listener cleanup

**Key method: `armDocumentStart()`** — arms a script for document-start execution on future page loads WITHOUT running immediately. Critical for fetch-capture races.

**Port effort:** 2 hours. WebSocket CDP transport + all domains.

---

### 9. A11y Locator with Fallback Chain

**Source:** `src/cdp/locator.ts`

```
locateElement(client, targetId, role, name, nth, fallbackSelectors, localeVariants):
  1. CSS-first fast path: try fallbackSelectors via document.querySelector
  2. AX tree path: getFullAXTree → findByRole → findByName
  3. Locale variants: try locale-specific names before original
  4. Fail loud: return LocateResult { found: false, error: LabError }
```

**Key features:**
- `rebuildTree()` — rebuilds hierarchy from flat CDP node list (fixes 500-cap bug)
- Cap raised to 10,000 nodes (from 500)
- Locale variants for multilingual providers
- `findByName()` supports exact string or regex pattern

**Port effort:** 1 hour. A11y tree walk + fallback chain.

---

### 10. Prediction & Cross-Provider Transfer

**Source:** `src/prediction/`

- `extractPatterns()` — aggregates outcomes into per-provider, per-strategy-type patterns
- `predictStrategy()` — predicts success rate for a capability using provider patterns
- Cross-provider prediction: if no data for provider, uses weighted average from other providers (×0.85 confidence penalty)
- `loadTransferInfluences()` — reads transfer-patterns.jsonl for cross-provider learning
- `findOptimizationOpportunities()` — suggests strategy swaps when a better strategy exists

**Port effort:** 2 hours. Pattern extraction + prediction logic.

---

### 11. Promotion System with Oversight

**Source:** `src/promotion/`

Status ladder: `prospect → test-1 → test-2 → stable → broken/flaky → retired`

Auto-advance rules:
- `prospect → test-1`: first success
- `test-1 → test-2`: 2 consecutive successes
- `test-2 → stable`: 3 consecutive successes
- `stable → broken`: any failure
- `test-2 → prospect`: failure resets
- `broken/flaky → stable`: 3 consecutive recoveries

**Oversight gate:** Promotions to `stable` or `broken` require manual oversight when score ≥ 0.85. Oversight queue with approve/reject/modify workflow.

**Multi-factor scoring:**
```
success_rate × 0.35 + streak × 0.15 + status_ladder × 0.25 + recency × 0.15 + rerun_verification × 0.10
```

**Port effort:** 2 hours. State machine + scoring + oversight queue.

---

### 12. Discovery Pipeline

**Source:** `src/discovery/`

Three-phase pipeline:
1. **Scan** — viewport sweep using common candidates (textarea, button, dialog, menu, etc.)
2. **Probe** — test interactivity (textbox → type, button → click, listbox → select)
3. **Register** — count registered capabilities

Also: `executePipeline()` orchestrates all three phases.

**Port effort:** 1 hour. Simple pipeline with file-based persistence.

---

## What capability-lab Does NOT Have (Gaps)

| Gap | capability-lab | vivim-final Needs |
|-----|----------------|-------------------|
| **MCP Server** | None | Agent-callable tools |
| **Database** | File-based JSON/JSONL | Prisma + SQLite |
| **Multi-tenancy** | Single-user | Provider-level isolation |
| **Real-time streaming UI** | Mirror dashboard (separate) | Integrated chat UI |
| **Shape inheritance** | None | `extendsShape` for adapters |
| **Per-field confidence** | Single score | Field-level needsReview detection |
| **Plugin system** | Hardcoded providers | Pluggable adapter modules |
| **Version management** | None | Schema versioning + migration |

---

## Patterns to Avoid from capability-lab

| Pattern | Why |
|---------|-----|
| File-based JSON/JSONL persistence | Use Prisma (already in vivim-final) |
| In-memory Maps with manual file sync | Prisma handles concurrency |
| `import.meta.dir` for data paths | Use config-based paths |
| `queueMicrotask` for batch writes | Use Prisma transactions |
| Regex-based failure classification | Consider structured error codes |
| SPA navigation setInterval polling | Use CDP Page.frameNavigated event |
| Hardcoded provider URLs in harness | Use config-driven URL patterns |

---

## Quick Win Implementation Plan

| # | What | Source | Effort | Impact | Files to Create |
|---|------|--------|--------|--------|-----------------|
| 1 | Recipe JSON schema + loader | `src/recipe/schema.ts` | 2 hours | JSON-driven capabilities | `src/schema/recipe.ts` |
| 2 | Content Block model (13 types) | `src/shared/blocks.ts` | 30 min | Provider-agnostic blocks | `src/types/blocks.ts` |
| 3 | SSE parser + per-provider deltas | `src/parsers/sse.ts` | 1 hour | Reusable SSE parsing | `src/parsers/sse.ts` |
| 4 | Gemini envelope decoder | `src/parsers/gemini.ts` | 1 hour | Gemini stream support | `src/parsers/gemini.ts` |
| 5 | Confidence governor | `src/learn/confidence.ts` | 1 hour | 5-factor confidence | `src/engines/confidence.ts` |
| 6 | Status ladder + auto-promote | `src/promotion/ladder.ts` | 2 hours | Lifecycle management | `src/engines/lifecycle.ts` |
| 7 | Provider config registry | `src/providers/registry.ts` | 30 min | Data-driven providers | `src/config/providers.ts` |
| 8 | Action registry + expression builders | `src/action-registry/` | 2 hours | Portable action DSL | `src/engines/action-registry.ts` |
| 9 | Failure classifier | `src/healing/classifier.ts` | 1 hour | Structured failure analysis | `src/engines/failure-classifier.ts` |
| 10 | Selector portfolio generator | `src/healing/portfolio.ts` | 2 hours | Multi-strategy fallbacks | `src/engines/selector-portfolio.ts` |

**Total: ~12 hours for major capability uplift.**

---

## Priority Recommendations

1. **Start with #2 (Content Blocks) + #3 (SSE Parser)** — enables streaming parser for all providers immediately
2. **Then #5 (Confidence) + #6 (Status Ladder)** — lifecycle management, pure functions
3. **Then #1 (Recipe Schema) + #7 (Provider Config)** — JSON-driven capability system
4. **Then #8 (Action Registry)** — portable action DSL with expression builders
5. **Then #9 (Failure Classifier) + #10 (Selector Portfolio)** — self-healing foundation
6. **Then #4 (Gemini Parser)** — Gemini-specific stream support

---

## Comparison: capability-lab vs cap-store (Previous Audit)

| Aspect | capability-lab | cap-store (capabilitity-vault) |
|--------|----------------|-------------------------------|
| **Language** | TypeScript (Bun) | TypeScript (Node) + Rust |
| **CDP Integration** | Full (client, locator, input, network) | None (harness injection only) |
| **Streaming** | In-page harness + CDP Network + Fetch domain | Harness injection only |
| **Self-healing** | Complete system (portfolio, classifier, healer, monitor, demotion) | Pattern tracking only |
| **Confidence** | 5-factor (identical formula) | 5-factor (identical formula) |
| **Status ladder** | prospect→test-1→test-2→stable→broken/flaky→retired | prospect→test-1→test-2→stable→flaky→broken→retired |
| **Promotion** | Auto-advance + oversight queue | Auto-promote via statusWeight |
| **Recipes** | JSON files with locate/act/observe steps | None (direct execution) |
| **Action Registry** | Portable DSL with guards/steps/verify | None |
| **Discovery** | Viewport sweep + probe + register pipeline | None |
| **Prediction** | Cross-provider pattern transfer | None |
| **Providers** | 7 providers (data-driven config) | 5 providers (hardcoded) |
| **Mirror/Dashboard** | Bun.serve HTTP + WebSocket | None |
| **CLI** | 36 commands | None |

**Key difference:** capability-lab is a **complete automation platform** while cap-store is a **capability registry**. capability-lab has the CDP integration, streaming capture, and self-healing that cap-store lacks. cap-store has the provider protocol registry, capability vault, and response parser registry that capability-lab lacks.

**Best of both:** Port capability-lab's CDP integration, streaming architecture, and self-healing system to vivim-final, combined with cap-store's provider protocol registry and capability vault.

---

## Data Flow Summary

```
User Request
  ↓
Recipe Loader (JSON → ActionRecipe)
  ↓
Executor (locate → act → observe)
  ↓
┌─ WRITE Channel ──────────────────────┐
│  CDP Locator (A11y tree + CSS)       │
│  CDP Input (trusted events)          │
└──────────────────────────────────────┘
  ↓
Provider Web App (gemini.google.com, chatgpt.com, claude.ai)
  ↓
┌─ READ Channel ───────────────────────┐
│  Layer 1: CDP Binding (push)         │
│  Layer 2: Fetch Domain (full body)   │
│  Layer 3: CDP Network (nav-proof)    │
│  In-page: fetch/XHR monkey-patch     │
└──────────────────────────────────────┘
  ↓
Content Pipeline (SSE / batchexecute dispatch)
  ↓
Content Blocks (13 types)
  ↓
┌─ Learning System ────────────────────┐
│  Outcomes → Patterns → Confidence    │
│  Healing → Portfolio → Demotion      │
│  Prediction → Optimization           │
│  Promotion → Oversight               │
└──────────────────────────────────────┘
```
