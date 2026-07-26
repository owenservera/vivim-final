# SOTA-10 — Autonomous Provider Onboarding (Agent-as-Explorer)

**Status:** DRAFT — Design Proposal
**Priority:** P1 — Provider Expansion Pipeline
**Epic:** CAP-003 (Provider Onboarding Automation)
**Date:** 2026-07-26
**Extends:** `04-merged-engines.md` (ProtocolDiscoveryEngine, StreamingResponseAnalyzer, ProviderRegistrar), `06-merged-seeds.md` (Provider Manifests + Parser Seeds), `sota-02-shape-agnostic-registration.md` (ProviderDiscoveryEngine, ManifestInferenceEngine), `chrome-setup-wizard.ts` (account registration — used directly)

---

## 1. Feature Name

**Autonomous Provider Onboarding — Agent-as-Explorer (APOP-AX)**

An agent (running in opencode/Claude Code) is given a high-level objective like "onboard Grok" and autonomously explores the provider's web surface — discovering selectors, testing interactions, capturing network traffic, analyzing wire formats, and seeding everything to the DB — with the same curiosity, adaptability, and creative license a human engineer would have. The "pipeline" is not a fixed sequence of phases: it is a toolkit of capabilities the agent wields as it sees fit.

---

## 2. Epic

- **Parent Epic:** CAP-003 — Provider Onboarding Automation
- **Architecture Baseline:** `02-merged-architecture.md` (Governor Canon, 13-engine architecture, vivim-runtime pattern)
- **Engine Baseline:** `04-merged-engines.md` (ProtocolDiscoveryEngine, StreamingResponseAnalyzer, ProviderRegistrar)
- **SOTA Baseline:** `sota-02-shape-agnostic-registration.md` (ProviderDiscoveryEngine, ManifestInferenceEngine), `sota-09-harness-protocol-engine.md` (ResponseExtractor)
- **Pattern Baseline:** `vivim-runtime` skill — agent IS the runtime; drives its own dev loop
- **Previous Work:** `devops/onboard-controller.ts` (existing 8-phase pipeline), `devops/runtime-test/setup` (ChromeSetupWizard), `src/engines/protocol-discovery.ts`, `src/engines/streaming-response-analyzer.ts`

---

## 3. Goal

### Problem

Adding a new web-based LLM provider to cap-store currently requires manual effort across five domains:

1. **Account registration** — Creating a Chrome profile, logging in, persisting the session for ChromeGovernor
2. **Manifest authoring** — Writing the provider manifest JSON with endpoints, selectors, models, and capabilities requires examining the provider's web UI by hand
3. **Parser authoring** — Creating the `logic_code` for stream response parsing requires capturing a real streaming response, analyzing its wire format, and hand-writing parser logic
4. **DB seeding** — The parser and capabilities must be seeded into the database via seed files
5. **Verification** — Each phase must be independently validated

The existing `onboard-controller.ts` provides a fixed 8-phase pipeline but it is brittle — every new provider has unique UI quirks (React SPA, Quill editor, ProseMirror, custom RPC formats, anti-automation measures) that don't fit a one-size-fits-all phase map. The pipeline has a single "discover → infer → test" path that breaks on any deviation.

### Solution — Agent-as-Explorer

Instead of a fixed pipeline, an agent (like the one reading this document) is given:

1. **A toolkit** of reusable functions — `AccountRegistrar.register()`, `ProtocolDiscoveryEngine.discover()`, `StreamingResponseAnalyzer.analyze()`, `LiveCaptureEngine.capture()`, `ProviderRegistrar.seedProvider()`, and more
2. **A high-level objective** — "Onboard Grok at https://x.com/i/grok for send_message capability"
3. **Creative license** — The agent decides the order, tries approaches, fails fast, retries with different strategies, and adapts based on what it discovers in the browser

The agent is CURIOUS. It:
- Takes screenshots and reads page text to understand the UI
- Probes for composers with multiple selector strategies
- Clicks buttons and observes what happens
- Inspects network traffic via CDP to find streaming endpoints
- Tries sending messages and watches for responses in the DOM
- Analyzes captured wire formats and generates parsers iteratively
- Seeds to the DB when confident, or discards and retries

This is the **vivim-runtime** pattern: the agent IS the runtime of its own dev loop.

### Design Tenets

| Tenet | Rule |
|-------|------|
| **T1 — Governor Canon** | All CDP goes through `CdpSender` narrow interface. No engine imports CDP directly. |
| **T2 — Agent-as-Runtime** | The agent orchestrates tools, not a fixed pipeline. The agent decides what to try next based on results. |
| **T3 — Idempotent** | All DB writes are upserts. Re-running overwrites parser + manifest rows, never duplicates. |
| **T4 — Zero manual setup** | Account registration is built in. The agent handles profile allocation, Chrome launch, login waiting. |
| **T5 — DB-only parser storage** | Generated parsers are upserted into `ProviderParser` rows with `logic_type=inline`. |
| **T6 — Fail fast, retry smart** | Failed selectors → try LLM-healed alternatives. Failed parsers → re-capture + re-analyze. Never retry the same thing. |

---

## 4. User Journey

```
User: "Onboard Grok"

  1. User runs:
     bun run devops onboard-provider grok --url=https://x.com/i/grok

  2. The agent (opencode) takes over:

  ┌────────────────────────────────────────────────────────────────────────┐
  │ AGENT AUTONOMOUSLY:                                                     │
  │                                                                          │
  │  1. Account Registration (using existing ChromeSetupWizard)             │
  │     ├─ Check if ProviderDefinition exists in DB — seed from template     │
  │     ├─ Allocate profile dir under chrome-profiles/grok/owservera/        │
  │     ├─ Launch Chrome, navigate to x.com/i/grok                           │
  │     ├─ WAIT for user to log in manually (poll cookies, up to 5 min)      │
  │     └─ Save ProviderAccount row to DB                                    │
  │                                                                          │
  │  2. UI Exploration (curious probing)                                     │
  │     ├─ Screenshot the page — what does the composer look like?            │
  │     ├─ Run ProtocolDiscoveryEngine probes (composers, buttons, DOM)      │
  │     ├─ Try typing in candidate composer elements                         │
  │     ├─ Click candidate send buttons, observe network traffic             │
  │     ├─ If selectors have low confidence, try LLM-healed alternatives     │
  │     └─ Build a confidence-weighted DiscoveredProtocol                    │
  │                                                                          │
  │  3. Live Capture                                                         │
  │     ├─ Enable Network domain in CDP                                      │
  │     ├─ Type test message ("Hello") into discovered composer              │
  │     ├─ Click send (or press Enter)                                       │
  │     ├─ Capture all network response bodies from streaming endpoints      │
  │     ├─ Wait for completion (DOM stabilization or timeout)                │
  │     └─ Save raw capture to .runtime/onboard-<slug>-capture.txt           │
  │                                                                          │
  │  4. Format Analysis + Parser Generation                                  │
  │     ├─ Run StreamingResponseAnalyzer on captured body                    │
  │     ├─ If confidence ≥ 0.7: use generated logic_code                     │
  │     ├─ If confidence < 0.7: invoke LLM FormatClassifier                  │
  │     ├─ Refine path if parser produces empty output                       │
  │     └─ Save analysis to .runtime/onboard-<slug>-analysis.json            │
  │                                                                          │
  │  5. Parser Seeding + Validation                                          │
  │     ├─ Upsert parser to DB via ParserStore                               │
  │     ├─ Wire fallback chain (provider/001 → generic/001 → system/001)     │
  │     ├─ Send a second test message, parse it through the new parser       │
  │     └─ If validation fails (< 0.5 confidence), re-capture + re-analyze   │
  │                                                                          │
  │  6. Manifest Registration                                                │
  │     ├─ Build full provider manifest from discovered protocol             │
  │     ├─ Upsert via ProviderRegistrar (definitions, endpoints, models)     │
  │     └─ Register capabilities (send_message, select_model, etc.)          │
  │                                                                          │
  │  7. Cross-Surface Verification                                           │
  │     ├─ CLI: verify provider appears in command list                      │
  │     ├─ API: test /api/capabilities resolves for this provider            │
  │     └─ DB: verify all rows exist (ProviderDefinition, endpoints, caps)   │
  │                                                                          │
  │  8. Report                                                               │
  │     └─ Print summary: what worked, what was inferred, confidence levels  │
  └────────────────────────────────────────────────────────────────────────┘

  3. Output: "✓ grok fully onboarded. send_message + select_model ready."
           "  Profile: chrome-profiles/grok/owservera/"
           "  Parser: grok/001_streaming (confidence 0.92)"
           "  Manifest: seeded with 2 endpoints, 2 models, 1 capability"
```

---

## 5. Architecture

### 5.1 Philosophy — Agent Controls the Tools, Not Vice Versa

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT (opencode / Claude Code)                    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Given: "Onboard Grok at https://x.com/i/grok"                      │ │
│  │                                                                      │ │
│  │  The agent calls tools as needed, in any order, retrying on failure │ │
│  │                                                                      │ │
│  │  Toolbox (all existing + proposed utilities):                        │ │
│  │                                                                      │ │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │ │
│  │  │ ChromeSetupWizard  │  │ ProtocolDiscovery  │                     │ │
│  │  │ (account reg —     │  │ Engine (CDP DOM    │                     │ │
│  │  │  used directly)    │  │  probes)            │                     │ │
│  │  └────────────────────┘  └────────────────────┘                     │ │
│  │                                                                      │ │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │ │
│  │  │ LiveCaptureEngine  │  │ StreamingResponse   │                     │ │
│  │  │ (CDP Network +     │  │ Analyzer (format    │                     │ │
│  │  │  DOM input)        │  │  classification)     │                     │ │
│  │  └────────────────────┘  └────────────────────┘                     │ │
│  │                                                                      │ │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │ │
│  │  │ FormatClassifier   │  │ ParserStore        │                     │ │
│  │  │ (LLM fallback)     │  │ (DB upsert)        │                     │ │
│  │  └────────────────────┘  └────────────────────┘                     │ │
│  │                                                                      │ │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │ │
│  │  │ ProviderRegistrar  │  │ ProfileAllocator   │                     │ │
│  │  │ (multi-table       │  │ (profile dir mgmt) │                     │ │
│  │  │  DB upsert)        │  │                     │                     │ │
│  │  └────────────────────┘  └────────────────────┘                     │ │
│  │                                                                      │ │
│  │  ┌────────────────────┐  ┌────────────────────┐                     │ │
│  │  │ ChromeGovernor     │  │ Launcher (spawn    │                     │ │
│  │  │ (FleetSupervisor   │  │  Chrome with args) │                     │ │
│  │  │  + CDP session)    │  │                     │                     │ │
│  │  └────────────────────┘  └────────────────────┘                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│                    Agent-specific capabilities:                           │
│                     • CDP Browser (Playwright or native)                  │
│                     • Bun shell (run DB queries, launch tests)            │
│                     • File system (read/write captures, manifests)        │
│                     • Network fetch (API calls)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Agent Decision Tree (guidance, not mandate)

The agent is given the following as a *suggested* path, but is free to deviate based on what it discovers:

```
START: "Onboard {provider} at {url}"

   ↓
   ┌────────────────────────────────────┐
   │ 0. Account Registration             │
   │    • Check DB for provider def     │
   │    • Allocate profile              │
   │    • Launch Chrome + wait for login│
   │    • Save ProviderAccount row      │
   └────────────┬───────────────────────┘
                │ cookies detected?
                ↓
   ┌────────────────────────────────────┐
   │ 1. UI Exploration                  │
   │    • Screenshot page               │
   │    • Read DOM structure            │
   │    • Run ProtocolDiscovery probes  │
   │    • Try clicking / typing         │
   │    • Observe DOM response areas    │
   └────────────┬───────────────────────┘
                │ composer + send button found?
                ↓ yes              ↓ no
   ┌────────────────────┐   ┌────────────────────────────┐
   │ 2. Live Capture    │   │ Try LLM-healed selectors   │
   │    • Type message  │   │ (SelectorRefiner)          │
   │    • Click send    │   │ OR try different URL path  │
   │    • Capture stream│   │ OR report: manual help     │
   └────────┬───────────┘   └────────────────────────────┘
            │ body captured?
            ↓ yes              ↓ no
   ┌────────────────────┐   ┌──────────────────────────┐
   │ 3. Format Analyze  │   │ Try alternate send method│
   │    • Run analyzer  │   │ (Enter key vs button)    │
   │    • If low conf:  │   │ OR check other network   │
   │      LLM classifier│   │ patterns (WebSocket?)    │
   └────────┬───────────┘   └──────────────────────────┘
            │ parser generated?
            ↓ yes              ↓ no
   ┌────────────────────┐   ┌──────────────────────────┐
   │ 4. Seed + Validate │   │ LLM generates parser     │
   │    • Upsert parser │   │ from raw sample           │
   │    • Send 2nd msg  │   │                          │
   │    • Verify output │   │                          │
   └────────┬───────────┘   └──────────────────────────┘
            │ validation passes?
            ↓ yes              ↓ no
   ┌────────────────────┐   ┌────────────────────────────┐
   │ 5. Register        │   │ Re-capture + re-analyze    │
   │    • Manifest      │   │ (different path/body may   │
   │    • Capabilities  │   │  reveal correct data path) │
   │    • Models        │   │                            │
   └────────┬───────────┘   └────────────────────────────┘
            │ all seeded?
            ↓
   ┌────────────────────┐
   │ 6. Verify          │
   │    • CLI resolves  │
   │    • API resolves  │
   │    • DB rows exist │
   └────────┬───────────┘
            │ all pass?
            ↓ yes
   DONE: Report summary
```

### 5.3 Existing Infrastructure — What We Already Have

| Component | Location | Status | What It Does |
|-----------|----------|--------|-------------|
| `ChromeSetupWizard` | `src/engines/chrome-setup-wizard.ts` | ✅ Existing | **Account registration** — allocate profile, launch Chrome, poll for login, save `ProviderAccount`. Used directly by agent (no wrapper needed). |
| `ProfileAllocator` | `src/executor/profile-allocator.ts` | ✅ Existing | Profile dir management (`chrome-profiles/<slug>/<account>/`), `isAuthenticated()` cookie check |
| `Launcher` | `src/executor/launcher.ts` | ✅ Existing | `launchChrome()` / `launchProfile()` — spawn Chrome with args, wait for debug port |
| `ProtocolDiscoveryEngine` | `src/engines/protocol-discovery.ts` | ✅ Existing | DOM probes (composers, buttons, response containers), network pattern collection via CDP, manifest draft generation |
| `StreamingResponseAnalyzer` | `src/engines/streaming-response-analyzer.ts` | ✅ Existing | Classify SSE/batchexecute/JSON streaming, infer data path, generate `logic_code` parser |
| `ProviderRegistrar` | `src/engines/provider-registrar.ts` | ✅ Existing | Multi-table upsert (definitions, endpoints, parsers, capabilities, configs, models) via `ProviderStore` contract |
| `ProviderStore` | `src/storage/contracts/provider-store.ts` | ✅ Existing | Data access interface for all provider tables |
| `onboard-controller.ts` | `devops/onboard-controller.ts` | ✅ Existing | 8-phase pipeline (replaced by agent-as-explorer but individual modes reusable) |
| `discover-protocol.ts` | `devops/runtime-test/discover-protocol.ts` | ✅ Existing | CLI entry for protocol discovery via CDP |
| `devops/index.ts` (runtime-test setup) | `devops/index.ts:989` | ✅ Existing | Existing `setup` subcommand wires `ChromeSetupWizard` for profile + login |

**Frontend Onboarding (Two Distinct Systems):**

| Component | Location | Status | What It Does |
|-----------|----------|--------|-------------|
| `OnboardFlow` | `frontend/src/features/onboard-flow.tsx` | ✅ Existing | 3-step provider setup wizard: Pick provider → Launch Chrome → Auto-poll login → Register account + create conversation. Triggered when `checkNeedsSetup()` returns true (no accounts on disk). Calls `/api/setup/launch-visible`, `/api/setup/verify`, `/api/setup/complete`, `/api/setup/kill`. |
| `OnboardingTour` | `frontend/src/components/canvas/OnboardingTour.tsx` | ✅ Existing | 5-step interactive UI walkthrough: welcome → workspace-switcher → surface-tabs → shell-card → command-palette. Dismissible, re-triggerable from settings. Uses `OnboardingStore` contract (memory impl). |
| `shared/onboarding.ts` | `frontend/src/shared/onboarding.ts` | ✅ Existing | `OnboardingStep` interface + `ONBOARDING_STEPS` array (5 steps) + `OnboardingState` type |
| `OnboardingStore` | `frontend/src/storage/contracts/onboarding-store.ts` | ✅ Existing | Contract: `get`, `completeStep`, `dismiss`, `reset` per userId |
| `MemoryOnboardingStore` | `frontend/src/storage/impl/memory-onboarding-store.ts` | ✅ Existing | In-memory Map impl of `OnboardingStore` |
| API routes | `frontend/src/app/api/onboarding/{state,complete,dismiss,reset}/route.ts` | ✅ Existing | 4 Next.js route handlers for tour state management |
| `useFirstRun` | `frontend/src/hooks/use-first-run.ts` | ✅ Existing | localStorage-based first-run detection (`vivim.onboarding.seen`) |
| Page wiring | `frontend/src/app/page.tsx:176` | ✅ Existing | `OnboardFlow` shows when `needsSetup` is true; `OnboardingTour` always rendered (checks state on mount) |

**Gap:** `OnboardFlow` (provider setup) and `OnboardingTour` (UI walkthrough) are disconnected — `OnboardFlow` completes by creating a conversation but never triggers the tour. The tour fires independently on mount if state exists.

**New Components to Build:**

| Component | Location | Status | What It Does |
|-----------|----------|--------|-------------|
| ~~`AccountRegistrationEngine`~~ | ~~`src/engines/account-registration.ts`~~ | ⚠️ **REDUNDANT** | ~~Wrap `ChromeSetupWizard` + `ProfileAllocator` + `ProviderStore` into one atomic tool~~ — **Already exists:** `ChromeSetupWizard.runSetup()` handles profile allocation, Chrome launch, login polling, and DB save. Agent calls it directly with a provider seeding step first. |
| `LiveCaptureEngine` | `src/engines/live-capture-engine.ts` | 🆕 CREATE | CDP Network domain capture: type into composer, click send, accumulate body chunks via `Network.dataReceived` |
| `FormatClassifier` | `src/engines/format-classifier.ts` | 🆕 CREATE | LLM-driven fallback for unknown wire formats |
| `SelectorRefiner` | `src/engines/selector-refiner.ts` | 🆕 CREATE | LLM-driven selector healing when probes yield low confidence |
| `onboard-provider.ts` | `devops/onboard-provider.ts` | 🆕 CREATE | Entry point for the agent: seed provider def (if missing), call `ChromeSetupWizard.runSetup()`, print agent instructions + return toolkit context |
| Provider manifests (Grok + Mistral) | `seeds/providers/manifests.ts` | 🆕 MODIFY | Add manifests for new providers |

**Why `AccountRegistrationEngine` is redundant:**

The existing `ChromeSetupWizard` already does everything:
1. `allocate(providerSlug, accountId)` — creates profile dir via `ProfileAllocator`
2. `launchChrome()` — spawns Chrome with debug port
3. `pollForLogin()` — polls URL via CDP until login detected
4. `saveAccount()` — upserts `ProviderAccount` row to DB

The only missing piece is "seed provider definition if not in DB" — but this is a one-line check before calling `runSetup()`, not a new engine. The agent can do:
```typescript
// Before calling ChromeSetupWizard:
const def = await db.providerDefinition.findFirst({ where: { slug } })
if (!def) await db.providerDefinition.create({ data: { slug, displayName, websiteUrl } })
// Then call existing wizard:
const result = await wizard.runSetup(def.id, slug, accountId, { visible: true })
```

---

## 6. Tool Specifications

Each tool is a standalone function the agent can call. Tools are independent — the agent calls them in any order, with any parameters, retrying as needed.

### 6.1 Account Registration (existing `ChromeSetupWizard`)

**No new engine needed.** The existing `ChromeSetupWizard` handles everything. The agent calls it directly after seeding the provider definition.

**File:** `src/engines/chrome-setup-wizard.ts` (existing, 329 lines)

**What it already does:**
1. `allocate(providerSlug, accountId)` — creates profile dir via `ProfileAllocator`
2. `launchChrome()` — spawns Chrome with debug port
3. `pollForLogin()` — polls URL via CDP until login detected
4. `saveAccount()` — upserts `ProviderAccount` row to DB

**Agent flow (before calling wizard):**
```typescript
// 1. Seed provider definition if missing
const def = await db.providerDefinition.findFirst({ where: { slug } })
if (!def) {
  await db.providerDefinition.create({
    data: { slug, displayName: 'Grok', websiteUrl: 'https://x.com/i/grok' }
  })
}

// 2. Check if already authenticated (fast no-op)
const profileDir = await allocator.allocate(slug, accountId)
if (await allocator.isAuthenticated(profileDir)) {
  // Already logged in — skip Chrome launch
  return { ok: true, debugPort: existingPort, profileDir }
}

// 3. Launch Chrome + wait for login
const result = await wizard.runSetup(def.id, slug, accountId, { visible: true })
// result: { ok: true, debugPort, profileDir }
```

**Idempotent:** If `ProviderAccount` + cookies already exist, this is a fast no-op. Only launches Chrome if the profile dir lacks valid cookies.

---

### 6.2 LiveCaptureEngine

The agent uses this to send a test message and capture the streaming response body.

**File:** `src/engines/live-capture-engine.ts`

**Interface:**

```typescript
export interface LiveCaptureOptions {
  composerSelector: string
  sendButtonSelector?: string       // optional — agent may try Enter key instead
  sendMethod?: 'click' | 'enter'
  testMessage?: string              // default: "Hello"
  captureTimeoutMs?: number         // default: 30_000
  streamUrlPattern?: RegExp         // optional override for URL matching
}

export interface LiveCaptureResult {
  ok: boolean
  rawBody: string
  captureDurationMs: number
  networkUrl: string
  responseHeaders: Record<string, string>
  bytesCaptured: number
  detectedFormat: 'sse' | 'json_stream' | 'batchexecute' | 'websocket' | 'unknown'
  completionDetected: boolean
  error?: string
}

export class LiveCaptureEngine {
  constructor(
    private client: CdpSender,
    private sessionId: string,
  ) {}

  async captureResponse(opts: LiveCaptureOptions): Promise<LiveCaptureResult>
}
```

**Capture Flow:**

```
1. Enable Network domain (Network.enable)
2. Register listeners for:
   - Network.requestWillBeSent → URL matching against streaming patterns
   - Network.responseReceived → capture response headers
   - Network.dataReceived → accumulate body chunks
3. Type message into composer (Runtime.evaluate)
   - For textarea: element.value = message
   - For contenteditable: element.textContent = message + dispatch input event
   - For Quill: .ql-editor innerHTML = '<p>message</p>' + dispatch input
   - For ProseMirror: .ProseMirror innerHTML = '<p>message</p>' + dispatch input
4. Send message:
   - If sendMethod='click': element.click() on send button
   - If sendMethod='enter': dispatch KeyboardEvent('keydown', {key:'Enter'})
5. Wait for stream completion:
   - [DONE] marker (SSE)
   - finish_reason in JSON
   - DOM response container stabilizes (no new mutations for 2s)
   - OR captureTimeoutMs elapses
6. Return accumulated body
```

**Agent tip:** Call this with different `composerSelector` or `sendMethod` values if the first attempt returns empty. Grok might need Enter key instead of button click; Mistral might use a different textarea.

---

### 6.3 FormatClassifier (LLM-driven)

When `StreamingResponseAnalyzer` returns confidence < 0.7, the agent can call the LLM classifier with the raw body sample.

**File:** `src/engines/format-classifier.ts`

**Interface:**

```typescript
export interface FormatClassification {
  transport: 'sse' | 'json_stream' | 'batchexecute' | 'websocket' | 'polling' | 'unknown'
  eventName?: string
  providerHint?: string
  confidence: number
  dataPath?: string                 // e.g. 'choices[0].delta.content'
  schemaDescription: string
  rationale: string
}

export class FormatClassifier {
  constructor(
    private llmClient: { complete: (prompt: string) => Promise<string> },
  ) {}

  async classify(body: string): Promise<FormatClassification>

  /** Generate a parser logic_code from raw body + classification */
  async generateParser(
    body: string,
    classification: FormatClassification,
    providerSlug: string,
  ): Promise<string>
}
```

**LLM prompt template (classify):**

```
You are analyzing a raw streaming response body from an LLM provider's web UI.
Classify the wire format and identify the data path to extract text content.

Raw body (first 3000 chars):
{bodySample}

Answer with JSON only:
{
  "transport": "sse"|"json_stream"|"batchexecute"|"websocket"|"polling"|"unknown",
  "eventName": string or null,
  "providerHint": string or null,
  "confidence": 0.0-1.0,
  "dataPath": "JS accessor path to text content",
  "schemaDescription": "brief description of the format",
  "rationale": "why you chose this"
}
```

**LLM prompt template (generate parser):**

```
Given the raw streaming body and classification below, generate a JavaScript
parser module that:
- parse(rawBody) → array of {type, text} blocks
- detectCompletion(rawBody) → boolean
- getConfidence(rawBody) → 0.0-1.0

Classification: {JSON classification}
Raw body (first 5000 chars): {bodySample}

The parser must follow the seed parser contract:
exports.default = { name, version, providerId, parse, detectCompletion, getConfidence }

Return ONLY valid JavaScript code in a code block.
```

---

### 6.4 SelectorRefiner (LLM-driven)

When deterministic probes yield low-confidence composers/buttons, the agent can call this to get LLM-suggested selectors.

**File:** `src/engines/selector-refiner.ts`

**Interface:**

```typescript
export interface SelectorRefinement {
  composer: string
  sendButton: string
  responseContainer: string
  rationale: string
}

export class SelectorRefiner {
  constructor(
    private llmClient: { complete: (prompt: string) => Promise<string> },
  ) {}

  async refine(
    url: string,
    pageSnapshot: string,  // HTML or accessibility tree
    probeResults: { composers: unknown[]; buttons: unknown[] },
  ): Promise<SelectorRefinement>
}
```

---

### 6.5 StreamingResponseAnalyzer (existing — reused as-is)

The existing `src/engines/streaming-response-analyzer.ts` is called by the agent directly. No changes needed. The agent:

1. Captures a raw body via `LiveCaptureEngine`
2. Calls `analyzer.analyze(rawBody)` to get classification + generated `logic_code`
3. If confidence >= 0.7, uses the generated parser directly
4. If confidence < 0.7, falls back to `FormatClassifier`

---

### 6.6 ProviderRegistrar (existing — reused as-is)

The existing `src/engines/provider-registrar.ts` is called by the agent to:

1. `registrar.seedProvider(providerSlug)` — upsert all tables from the manifest
2. `registrar.register(manifest)` — upsert from a dynamically-built manifest

The agent builds the manifest from what it discovered during UI exploration plus any manifest template in `seeds/providers/manifests.ts`.

---

### 6.7 Account Registration (detailed flow)

The agent calls this FIRST. It ensures ChromeGovernor can later use this provider.

**No new engine needed** — use existing `ChromeSetupWizard` directly.

```
Agent flow:

  1. Check if ProviderDefinition('grok') exists in DB
     → If not: seed minimal definition { slug: 'grok', display_name: 'Grok', website_url: 'https://x.com/i/grok', provider_type: 'llm', auth_type: 'browser' }
     → The full manifest (endpoints, models, capabilities) will be seeded later by ProviderRegistrar

  2. ProfileAllocator.allocate('grok', 'owservera')
     → Creates chrome-profiles/grok/owservera/ + .profile-meta.json
     → Returns profileDir

  3. ProfileAllocator.isAuthenticated(profileDir)
     → Checks for Default/Network/Cookies (any Chrome profile subdir)
     → If cookies exist and have size > 0: skip login, return immediately
     → If no cookies: proceed

  4. ChromeSetupWizard.runSetup(providerDbId, 'grok', 'owservera', { visible: true })
     → Finds free debug port (9222-9332 range)
     → Launches Chrome: --user-data-dir=chrome-profiles/grok/owservera/ --remote-debugging-port=<port> https://x.com/i/grok
     → Polls every 2s: fetch /json/list, check current URL
     → User logs in manually (x.com may redirect to login flow)
     → Poll detects authenticated page URL → login success
     → Saves ProviderAccount to DB with loginState='logged_in', profileDir, debugPort
     → Returns SetupResult { ok: true, debugPort, profileDir }

  5. Agent now has debugPort to attach CdpSender and begin exploration
```

**What the agent has after Step 0:**
- A running Chrome instance at `ws://127.0.0.1:<debugPort>`
- A logged-in session with cookies persisted in the profile dir
- A `ProviderAccount` row in the DB
- The ability to attach CDP and start probing the provider's UI

---

## 7. Agent Toolkit — How the Agent Drives Discovery

The following section is written **for the agent** (the LLM reading this doc). It tells the agent what tools it has and how to use them creatively.

### 7.1 Your Tools

As the agent, you have:

| Tool | Purpose | Signature |
|------|---------|-----------|
| `ChromeSetupWizard.runSetup()` | Set up profile + login | `(providerDbId, providerSlug, accountId, opts?) → SetupResult { debugPort, profileDir }` |
| `ProfileAllocator.allocate()` | Create profile dir | `(providerSlug, accountId) → profileDir` |
| `ProfileAllocator.isAuthenticated()` | Check if profile has cookies | `(profileDir) → boolean` |
| `ProtocolDiscoveryEngine.discover()` | Probe DOM for composers, buttons, network patterns | `(url, CdpSender, sessionId) → DiscoveredProtocol` |
| `LiveCaptureEngine.captureResponse()` | Send message + capture streaming response | `(composerSelector, sendButtonSelector?) → { rawBody }` |
| `StreamingResponseAnalyzer.analyze()` | Classify format + generate parser code | `(rawBody) → StreamAnalysis { logicCode }` |
| `FormatClassifier.classify()` | LLM fallback for unknown formats | `(rawBody) → FormatClassification` |
| `SelectorRefiner.refine()` | LLM fallback for low-confidence selectors | `(pageSnapshot, probeResults) → { composer, sendButton }` |
| `ProviderRegistrar.seedProvider()` | Upsert full provider manifest to DB | `(manifest) → RegisterResult` |
| `ParserStore.upsertParser()` | Seed parser to DB | `(parserRow) → parserId` |
| `ParserStore.setParserFallback()` | Wire fallback chain | `(parserId, fallbackId) → void` |
| `ChromeGovernor` (via CDP) | Browser automation — navigate, click, type, screenshot | `send('Runtime.evaluate', ...)`, `send('Page.navigate', ...)` |
| `Bun shell` | Run tests, DB queries, file operations | `bun test ...`, `cat .runtime/...` |

### 7.2 Exploration Strategies (things to try)

**If you can't find the composer:**
1. Screenshot the page and look for input areas
2. Read the DOM/accessibility tree for textboxes, editors, contenteditable divs
3. Try known selectors: `textarea`, `[contenteditable="true"]`, `[role="textbox"]`, `#prompt-textarea`, `.ql-editor`, `.ProseMirror`
4. Check for shadow DOM or iframes the composer might live in
5. Use `ProtocolDiscoveryEngine` probes first, then `SelectorRefiner` if needed

**If you can't find the send button:**
1. Look for buttons with text like "Send", "Submit", "→", an arrow icon
2. Try `aria-label` selectors: `button[aria-label*="send" i]`
3. Try `data-testid` selectors: `[data-testid*="send" i]`
4. Check if the provider uses Enter key instead (common in contenteditable composers)
5. Try clicking candidate buttons and observe what happens

**If capture returns empty body:**
1. The network URL pattern might not match — check `Network.requestWillBeSent` events for the actual streaming URL
2. Try a broader URL filter (the capture engine tries known patterns first: `/backend-api/conversation`, `/batchexecute`, etc.)
3. The provider might use WebSocket instead of HTTP streaming — check CDP for WebSocket frames
4. Try clicking the send button more explicitly (dispatchEvent with all properties)
5. Try Enter key instead of button click (or vice versa)

**If parser produces empty output:**
1. The inferred dataPath might be wrong — examine the raw body yourself
2. Re-capture with a more complete body (longer timeout)
3. Try `FormatClassifier.generateParser()` with the raw body to get an LLM-written parser
4. The body might have XSSI prefix (`)]}'`) that needs stripping

**If validation fails:**
1. The second message might produce a different format than the first
2. Some providers (Gemini) use different RPC methods for different conversations
3. Try re-capturing with a different test message
4. Try the generic/001 or system/001 fallback parsers

### 7.3 Creative License

You are NOT limited to the steps above. If you discover something unexpected:

- **New RPC format you've never seen?** Capture it, inspect it, generate a parser for it
- **Composer is a custom Web Component?** Find its shadow root, probe inside it
- **Provider uses a popup/overlay for message input?** Close the overlay, find the real composer
- **Streaming uses Server-Sent Events over EventSource?** Capture the events from the browser's network log
- **Page uses aggressive anti-bot detection?** Try `--disable-blink-features=AutomationControlled`, set navigator.webdriver=false

Your goal is to get `send_message` working for this provider. How you get there is up to you.

---

## 8. New Provider Manifests (Grok + Mistral)

### 8.1 Grok (x.com/i/grok)

```typescript
{
  provider: {
    slug: 'grok',
    display_name: 'Grok',
    description: "xAI's Grok AI assistant",
    category: 'ai',
    provider_type: 'llm',
    website_url: 'https://x.com/i/grok',
    auth_type: 'browser',
    has_multi_account: false,
    profile_strategy: 'per_account',
    fleet_config: {
      port_range: [9412, 9440],
    },
    capabilities: [
      'send_message',
      'create_new_chat',
      'navigate_chat',
      'delete_chat',
    ],
  },
  // Note: selectors and format are INCOMPLETE — the agent will discover
  // these during exploration and update the manifest before seeding.
  // The composer_type, send_method, and parser fields are placeholders.
  endpoints: [
    { label: 'Landing', url: 'https://x.com/i/grok', endpoint_type: 'landing', is_default: true },
    { label: 'Chat', url: 'https://x.com/i/grok', endpoint_type: 'chat',
      selector: { composer: '', send_button: '' },
      composer_type: 'unknown', send_method: 'both', content_editable: false },
    { label: 'Login', url: 'https://x.com/i/flow/login', endpoint_type: 'login' },
  ],
  models: [
    { slug: 'grok-3', display_name: 'Grok 3', is_default: true, context_window: 131072, max_output_tokens: 8192, supports_streaming: true, supports_tools: true },
    { slug: 'grok-3-mini', display_name: 'Grok 3 Mini', context_window: 131072, max_output_tokens: 8192, supports_streaming: true },
  ],
  capabilities_config: [
    {
      global_capability_id: 'send_message',
      recovery_strategies: [{ type: 'retry_selector' }, { type: 'navigate_home' }],
      ui_component_override: 'text_input',
      ui_label_override: 'Send to Grok',
      ui_icon_override: 'arrow-up-circle',
      ui_position_override: 'composer',
      ui_priority_override: 'primary',
    },
  ],
  config: [{ key: 'base_url', value: 'https://x.com' }, { key: 'auth_type', value: 'x.com' }],
}
```

### 8.2 Mistral (chat.mistral.ai)

```typescript
{
  provider: {
    slug: 'mistral',
    display_name: 'Mistral',
    description: "Mistral AI's Le Chat assistant",
    category: 'ai',
    provider_type: 'llm',
    website_url: 'https://chat.mistral.ai',
    auth_type: 'browser',
    has_multi_account: false,
    profile_strategy: 'per_account',
    fleet_config: { port_range: [9442, 9470] },
    capabilities: ['send_message', 'select_model', 'create_new_chat', 'navigate_chat', 'delete_chat'],
  },
  endpoints: [
    { label: 'Landing', url: 'https://chat.mistral.ai', endpoint_type: 'landing', is_default: true },
    { label: 'Chat', url: 'https://chat.mistral.ai/chat', endpoint_type: 'chat',
      selector: { composer: '', send_button: '' },
      composer_type: 'unknown', send_method: 'both', content_editable: false },
  ],
  models: [
    { slug: 'mistral-large', display_name: 'Mistral Large', is_default: true, context_window: 131072, max_output_tokens: 32768, supports_streaming: true, supports_tools: true },
    { slug: 'mistral-medium', display_name: 'Mistral Medium', context_window: 32768, max_output_tokens: 8192, supports_streaming: true },
    { slug: 'codestral', display_name: 'Codestral', context_window: 32768, max_output_tokens: 8192, supports_streaming: true },
  ],
  capabilities_config: [
    {
      global_capability_id: 'send_message',
      recovery_strategies: [{ type: 'retry_selector' }, { type: 'navigate_home' }],
      ui_component_override: 'text_input',
      ui_label_override: 'Send to Mistral',
      ui_icon_override: 'arrow-up-circle',
      ui_position_override: 'composer',
      ui_priority_override: 'primary',
    },
  ],
  config: [{ key: 'base_url', value: 'https://chat.mistral.ai' }, { key: 'auth_type', value: 'email' }],
}
```

---

## 9. Data Flow

### 9.1 File Artifacts (runtime)

The agent writes these during exploration (all idempotent — re-running overwrites):

| File | Purpose | Written When |
|------|---------|-------------|
| `.runtime/onboard-<slug>-account.json` | Account registration result (debugPort, profileDir) | After account registration |
| `.runtime/onboard-<slug>-probe.json` | Discovered protocol (composers, buttons, network patterns) | After UI exploration |
| `.runtime/onboard-<slug>-capture.txt` | Raw streaming response body | After live capture |
| `.runtime/onboard-<slug>-capture-2.txt` | Second raw body (for validation) | After second capture |
| `.runtime/onboard-<slug>-analysis.json` | Format analysis + parser logic_code | After format analysis |
| `.runtime/onboard-<slug>-manifest.json` | Final provider manifest (agent-verified) | Before DB seeding |
| `.runtime/onboard-<slug>-result.json` | Final summary | After verification |

### 9.2 DB Rows Written

| Table | Rows | Written When |
|-------|------|-------------|
| `provider_account` | 1 | Account registration |
| `provider_definition` | 1 | Manifest registration |
| `provider_endpoint` | 2-3 | Manifest registration |
| `provider_model` | 2-3 | Manifest registration |
| `provider_config` | 2 | Manifest registration |
| `provider_capability` | 1-2 | Capability registration |
| `provider_parser` | 1 | Parser seeding |
| `capability_binding` | 1-2 | Capability registration |

### 9.3 Key Invariant

The DB upserts are idempotent. Re-running the agent overwrites existing rows using Prisma `upsert` (matched by provider slug or parser name+version). The only non-idempotent operation is `ProfileAllocator.allocate()` which is guarded by an existence check (creates dir only if missing).

---

## 10. Implementation Plan

### Phase A: Core Tools (4 files, ~500 loc)

| # | File | Action | Purpose |
|---|------|--------|---------|
| ~~A0~~ | ~~`src/engines/account-registration.ts`~~ | ⚠️ SKIP | **Redundant** — `ChromeSetupWizard.runSetup()` already handles profile allocation, Chrome launch, login polling, DB save. Agent calls it directly after seeding provider definition. |
| A1 | `src/engines/live-capture-engine.ts` | CREATE | CDP Network domain: type into composer, click send, accumulate body chunks, detect completion |
| A2 | `src/engines/format-classifier.ts` | CREATE | LLM-driven format classification + parser generation (fallback when analyzer confidence < 0.7) |
| A3 | `src/engines/selector-refiner.ts` | CREATE | LLM-driven selector healing when probes yield low confidence |
| A4 | `devops/onboard-provider.ts` | CREATE | Entry point: seed provider def (if missing), call `ChromeSetupWizard.runSetup()`, print agent instructions + return toolkit context |

### Phase B: Provider Manifests (1 file, ~200 loc)

| # | File | Action | Purpose |
|---|------|--------|---------|
| B1 | `seeds/providers/manifests.ts` | MODIFY | Add Grok + Mistral manifests (with placeholder selectors — discovered during exploration) |

### Phase C: CLI Wiring (1 file, ~50 loc)

| # | File | Action | Purpose |
|---|------|--------|---------|
| C1 | `devops/index.ts` | MODIFY | Add `onboard-provider` subcommand: seed provider def, call `ChromeSetupWizard.runSetup()`, return agent instructions |

### Phase D: Verification Script (1 file, ~50 loc)

| # | File | Action | Purpose |
|---|------|--------|---------|
| D1 | `devops/onboard-verify.ts` | CREATE | Verify all DB rows, CLI resolution, API resolution for a given provider |

---

## 11. Provider-Specific Risks

| Provider | Risk | Mitigation |
|----------|------|-----------|
| **DeepSeek** | Low — standard textarea, known SSE format | Use OpenAI-compatible streaming analyzer; standard `textarea` + Enter key |
| **Grok** | Higher — x.com is a complex React SPA with anti-automation (`navigator.webdriver` checks, Cloudflare) | `--disable-blink-features=AutomationControlled`; anti-detection module; agent checks for login redirects |
| **Mistral** | Medium — chat.mistral.ai uses React, stream format unknown | If unknown format, LLM `FormatClassifier` handles; Check for CSP blocking CDP injection |
| **Grok login** | x.com may require SMS/2FA or email verification | Agent detects unauthenticated state via URL redirect to login flow; polls cookies; Chrome opened visibly for user interaction |
| **Mistral login** | Google OAuth popup | Agent detects popup, logs warning that manual login is needed in the visible Chrome window |

---

## 12. Agent-Facing Failure Recovery

This section is written **for the agent** — it tells you what to do when things go wrong.

### 12.1 Account Registration Fails

| Symptom | Likely Cause | Recovery |
|---------|-------------|----------|
| "Provider not found in DB, no template available" | No manifest in `seeds/providers/manifests.ts` | Create a minimal manifest manually, then retry `register()` |
| Profile allocation fails | Disk full, path conflict | Check `chrome-profiles/` directory, try different accountId |
| Login timeout (5 min) | User didn't log in | Re-run `register()` — Chrome will re-open at the same login page |
| Chrome crash on launch | Missing binary, corrupted profile | Kill stale Chrome processes, delete SingletonLock, retry |

### 12.2 UI Exploration Fails

| Symptom | Likely Cause | Recovery |
|---------|-------------|----------|
| No composers found | Wrong URL, page not loaded, SPA hasn't rendered | Wait 5s for SPA to render, navigate to a sub-path, try `/new` or `/chat` |
| Composers found but can't type | Read-only, disabled, or hidden input | Try other selectors, check if input is inside shadow DOM or iframe |
| No send button | Hidden until text is typed | Type text first, then re-probe for send button |
| Low confidence on all selectors | Unknown framework or custom UI | Use `SelectorRefiner` with page accessibility tree |

### 12.3 Live Capture Fails

| Symptom | Likely Cause | Recovery |
|---------|-------------|----------|
| Empty body (0 bytes) | Network filter missed the streaming URL | Check `Network.requestWillBeSent` events manually, extract the URL, retry with explicit `streamUrlPattern` |
| Empty body with correct URL | Body not accumulated (stream not started) | Try different send method (Enter vs button click); wait longer |
| Capture timeout (30s) | Streaming URL not recognized, or provider didn't respond | Try shorter message; check if provider requires feature selection (model toggle) before sending |
| "No network activity after click" | Click missed the actual send button | Use `Runtime.evaluate` to dispatch `click()` with `{bubbles: true, cancelable: true}` |

### 12.4 Format Analysis Fails

| Symptom | Likely Cause | Recovery |
|---------|-------------|----------|
| confidence < 0.7 | Unknown wire format | Call `FormatClassifier.classify()` with the raw body |
| Parser produces empty blocks | Wrong dataPath | Check the raw body yourself — look for text content paths; try `FormatClassifier.generateParser()` |
| Parser throws errors | Malformed generated code | Re-capture a clean body; try shorter test message |

### 12.5 Validation Fails

| Symptom | Likely Cause | Recovery |
|---------|-------------|----------|
| Second message parses differently | Provider uses different RPC for continued conversation | Re-capture the first message's format (not the second); some providers stream differently on first vs subsequent messages |
| Low confidence on second parse | Different content structure | Use fallback parser (generic/001) |

---

## 13. Exit Criteria

### For the agent to declare "provider onboarded":

```
✓ ProviderAccount row exists (loginState='logged_in')
✓ Profile directory exists under chrome-profiles/<slug>/<account>/
✓ Profile cookies detected (isAuthenticated() returns true)
✓ ProviderDefinition row exists in DB
✓ ProviderEndpoint rows exist (landing + chat + login)
✓ ProviderModel rows exist (2+ models)
✓ ProviderParser row exists (logic_type='inline', logic_code non-empty)
✓ Parser validates against a second capture (confidence ≥ 0.5)
✓ ProviderCapability rows exist (send_message at minimum)
✓ CLI resolves the provider in command list
✓ API resolves /api/capabilities for this provider
```

### Provider coverage targets (Phase 1):

```
✓ deepseek — fully onboarded
✓ grok — fully onboarded
✓ mistral — fully onboarded
```

---

## 14. Open Questions

| # | Question | Proposed Answer |
|---|----------|----------------|
| Q1 | Should the pipeline auto-export the parser to `seeds/parsers/harvested/<slug>-<format>.ts`? | Yes — optional opt-in via the agent. The agent can write the generated `logic_code` to a seed file for permanence. |
| Q2 | How does the agent detect login state during account registration? | `ProfileAllocator.isAuthenticated()` checks cookie files in the profile directory. This is the canonical source of truth (AGENTS.md invariant FR-7). |
| Q3 | What if the provider uses Cloudflare/anti-bot? | The `launchChrome` args include `--disable-blink-features=AutomationControlled`. If still blocked, the agent detects this (page shows "Checking your browser" or captcha) and reports the issue. |
| Q4 | What LLM should `FormatClassifier` use? | The same configured LLM as the agent running the session (open code's model or ConfigManager's configured provider). |
| Q5 | Should account registration auto-create the ProviderDefinition if missing? | Yes — a minimal template with slug + display_name + website_url. The full manifest is loaded later by `seedProvider()`. |
| Q6 | What if cookies expire mid-session? | `isAuthenticated()` returns false, agent detects this during verification, re-runs account registration to get fresh cookies. |
| Q7 | How does the agent attach CDP after registration? | The registration result includes `debugPort`. The agent uses `CdpSender` with `ws://127.0.0.1:<debugPort>` to create a session. |
| Q8 | What test message should the live capture send? | "Hello" — minimal, fast, works universally. Configurable. |

---

## 15. Glossary Delta

| New Term | Definition |
|----------|-----------|
| **APOP-AX** | Autonomous Provider Onboarding Pipeline — Agent-as-Explorer. The agent autonomously drives provider onboarding using a toolkit of capabilities. |
| **Account Registration (Step 0)** | The first action: seed provider def (if missing), allocate profile, launch Chrome, wait for login, save `ProviderAccount` row. Uses existing `ChromeSetupWizard.runSetup()`. |
| **Agent-as-Runtime** | The agent IS the runtime of its own dev loop — decides what to do, calls tools, interprets results, adapts. No fixed pipeline. |
| **LiveCaptureEngine** | Tool that types a test message into a composer, clicks send, and captures the streaming response body via CDP Network domain. |
| **FormatClassifier** | LLM-driven fallback for classifying unknown wire formats and generating parsers. |
| **SelectorRefiner** | LLM-driven selector suggester when deterministic probing yields low confidence. |
| **Toolkit** | The set of standalone functions the agent can call in any order. |

---

## See also

- `04-merged-engines.md` — ProtocolDiscoveryEngine (§2.1), StreamingResponseAnalyzer (§3)
- `06-merged-seeds.md` — Provider manifest schema, parser seed contract
- `devops/onboard-controller.ts` — Existing 8-phase pipeline (individual modes reusable)
- `src/engines/protocol-discovery.ts` — Current discovery engine (reused as tool)
- `src/engines/streaming-response-analyzer.ts` — Current analyzer (reused as tool)
- `src/engines/chrome-setup-wizard.ts` — Account registration (used directly by agent, no wrapper needed)
- `src/executor/profile-allocator.ts` — Profile directory management
- `sota-02-shape-agnostic-registration.md` — ProviderDiscoveryEngine, ManifestInferenceEngine
- `sota-09-harness-protocol-engine.md` — ResponseExtractor (parser repair techniques)
- `vivim-runtime` skill (`.opencode/skill/vivim-runtime/SKILL.md`) — Agent-as-runtime pattern
