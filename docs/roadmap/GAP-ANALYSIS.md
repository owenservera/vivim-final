# VIVIM Gap Analysis Engine

**Status:** BASELINE — ready for deep-dive interviews
**Date:** 2026-07-10
**Purpose:** Map what we HAVE vs what we NEED vs what's MISSING, per capability

---

## How to Use This System

### Status Markers
| Marker | Meaning |
|--------|---------|
| `[✓]` | **REAL** — Working implementation, not a stub |
| `[~]` | **STUB** — Interface exists but implementation is placeholder |
| `[✗]` | **MISSING** — No code exists |
| `[!]` | **CRITICAL** — Blocks other capabilities |

### Navigation
- Each domain has a **summary** (this file) and **details** (line anchors in source)
- Say **"deep dive on [domain]"** to expand that area
- Say **"mark [domain] done"** to update status
- Say **"what's next"** to see priority order

### Interview Protocol
When you say "deep dive on X":
1. I read the relevant source files
2. I present: what's REAL, what's STUB, what's MISSING
3. I ask clarifying questions about target state
4. I update this file with findings
5. Context stays in this file — no re-reading needed

---

## Domain Map

| # | Domain | Status | Blocks | Priority |
|---|--------|--------|--------|----------|
| D1 | Chrome Automation (CDP) | `[!] STUB` | Everything | P0 |
| D2 | Chrome Process Management | `[!] STUB` | D1, D3 | P0 |
| D3 | Conversation Pipeline | `[~] STUB` | D5, D6 | P0 |
| D4 | Selector System | `[✓] REAL` | D3 | P1 |
| D5 | API Layer | `[~] STUB` | Frontend | P1 |
| D6 | Engine Wiring | `[~] STUB` | All | P0 |
| D7 | Storage Layer | `[✓] REAL` | — | Done |
| D8 | CLI | `[~] REAL` | Testing | P2 |
| D9 | Frontend | `[✗] MISSING` | Product | P2 |
| D10 | Tests | `[~] REAL` | Quality | P2 |

---

## D1: Chrome Automation (CDP) — `[!] STUB`

**What we HAVE:**
- `src/executor/cdp.ts` — 21 lines, pure stub (connect/send/disconnect are no-ops)
- `src/engines/chrome-governor.ts` — 572 lines, REAL structure but spawn/kill/ensureRunning are stubs
- `CDPTransport` interface defined in chrome-governor.ts:116 — methods: send, capture, getPageState, captureScreenshot

**What we NEED (from cap-store):**
- `cap-store/src/executor/cdp.ts` — 542 lines, REAL WebSocket CDP client
  - Auto-reconnection with exponential backoff
  - Session management (Target.attachToTarget)
  - Per-command timeouts
  - Event listener registration
  - Session re-attach after reconnect
- `cap-store/src/executor/launcher.ts` — 205 lines, REAL Chrome launcher
  - Cross-platform Chrome path detection
  - Profile isolation via --user-data-dir
  - Headless/hidden/offscreen modes
  - Process lifecycle (spawn, check, terminate)
- `cap-store/src/executor/fleet.ts` — 55 lines, Chrome path detection
- `cap-store/src/executor/port-reaper.ts` — 181 lines, orphan cleanup

**Gap:** ~960 lines of real code to port
**Interview Q:** Should we port verbatim or refactor to match our interface signatures?

---

## D2: Chrome Process Management — `[!] STUB`

**What we HAVE:**
- `ChromeGovernor.spawn()` — creates ChromeSlave record, no Chrome launch (chrome-governor.ts:498)
- `ChromeGovernor.kill()` — sets status to stopped, no process kill (chrome-governor.ts:529)
- `ChromeGovernor.ensureRunning()` — sets status to running, no health check (chrome-governor.ts:544)
- `ChromeGovernor.reapOrphanedPorts()` — emits event only (chrome-governor.ts:581)
- `ChromeGovernor.seedAccounts()` — emits event only (chrome-governor.ts:576)
- `deriveProfile()` — returns /tmp path, not real profile dir (chrome-governor.ts:561)
- `allocatePort()` — sequential increment, no scan (chrome-governor.ts:565)

**What we NEED (from cap-store):**
- `cap-store/src/executor/profile-allocator.ts` — 133 lines, profile directory management
- `cap-store/src/executor/fleet-supervisor.ts` — 514 lines, fleet lifecycle
- `cap-store/src/executor/account-registry.ts` — 179 lines, account management
- `cap-store/src/executor/health-probe.ts` — 32 lines, liveness checks
- Port scanning (not sequential)
- Real Chrome process spawn via Bun.spawn

**Gap:** ~900 lines of real code to port + refactor Governor methods
**Interview Q:** Do we keep ChromeGovernor as the orchestrator and inject real implementations, or restructure?

---

## D3: Conversation Pipeline — `[~] STUB`

**What we HAVE:**
- `ConversationManager.send()` — 8-step pipeline (conversation-manager.ts:153)
  - Steps 1-4 (RESOLVE→SLAVE→LOCK→ENSURE): REAL logic, depends on stubs
  - Step 5 (SEND): Builds HarnessDAG, calls governor.cdp.executeHarnessPlan — STUB
  - Step 6 (CAPTURE): Calls governor.cdp.capture — STUB
  - Step 7 (PARSE): Calls StreamParserEngine — REAL
  - Step 8 (STORE+EMIT): Calls ConversationStore — REAL
- `StreamParserEngine` — 221 lines, REAL parser with builtin parsers
- `ConversationStore` — 194 lines, REAL Prisma impl

**What we NEED:**
- Real CDP transport (D1) to make Steps 5-6 work
- `cap-store/src/executor/conversation-driver.ts` — 221 lines, send/capture orchestration
- `cap-store/src/executor/slave-write.ts` — 87 lines, type/click/navigate
- `cap-store/src/executor/slave-read.ts` — 67 lines, DOM read/screenshot
- `cap-store/src/executor/stream-capture.ts` — 134 lines, streaming response capture

**Gap:** ~500 lines to port + wire D1 into Governor.cdp
**Interview Q:** Do we keep our 8-step pipeline or adopt cap-store's conversation-driver pattern?

---

## D4: Selector System — `[✓] REAL`

**What we HAVE:**
- `CapabilityShapeRegistry` — 307 lines, selector shapes for chat/code/search/canvas/dashboard
- `CapabilityEngine` — 230 lines, selector resolution with retry/fallback
- `ProviderDiscoveryEngine` — 272 lines, auto-discover interactive elements
- `ManifestInferenceEngine` — 135 lines, infer selectors from DOM
- `SelectorHealer` — 264 lines, LLM-powered selector repair
- Provider manifests with static selectors (claude.json, chatgpt.json, gemini.json)
- Recovery strategies: retry_selector, navigate_home, retry_with_fallback
- Drift detection: capability:selector_drifted events

**What's MISSING:**
- Integration with real CDP (selectors need real DOM access to test)
- Selector validation against live pages

**Gap:** Minimal — needs D1 to validate against real pages
**Status:** Can be marked DONE once D1 is working

---

## D5: API Layer — `[~] STUB`

**What we HAVE:**
- `src/server/index.ts` — 72 lines, Bun.serve with health, WebSocket, auth, conversation routes
- `src/server/conversation-router.ts` — 79 lines, basic CRUD routes
  - GET /api/providers — works (reads from DB)
  - GET /api/providers/:id — works
  - GET /api/fleet/status — returns [] (stub)
  - GET /api/conversations — returns [] (stub)
  - POST /api/conversations — works (creates in DB)
  - GET /api/conversations/:id/messages — works
  - POST /api/admin/seed — returns ok (stub)
- `src/server/websocket.ts` — 27 lines, basic WebSocket handler
- `src/server/auth-gate.ts` — 24 lines, Bearer token auth

**What we NEED:**
- Wire ConversationManager into POST /api/conversations/:id/send (doesn't exist yet)
- Wire ChromeGovernor into GET /api/fleet/status
- Streaming WebSocket for response chunks
- Provider account management endpoints
- Error handling middleware

**Gap:** ~200 lines of wiring + new endpoints
**Interview Q:** Do we follow cap-store's hybrid REST+dispatch pattern or keep pure REST?

---

## D6: Engine Wiring — `[~] STUB`

**What we HAVE:**
- All 37 engines exist as classes with constructors
- No bootstrap/wiring code connects them
- Each engine depends on interfaces, not implementations

**What we NEED:**
- Bootstrap sequence: create stores → create engines → inject dependencies → boot
- `cap-store/src/executor/index.ts` — 246 lines, wiring example
- `cap-store/src/server/index.ts` — server bootstrap example

**Gap:** ~300 lines of bootstrap code
**Interview Q:** Should we create a dedicated bootstrap module or wire in server/index.ts?

---

## D7: Storage Layer — `[✓] REAL`

**What we HAVE:**
- 15 store implementations (all Prisma-backed)
- ConversationStore, GovernorStore, HealthStore, StreamBlockStore, etc.
- Contracts defined in src/storage/contracts/

**What's REAL:**
- All CRUD operations work
- Transactions where needed
- Proper error handling

**Gap:** None — this layer is complete
**Status:** DONE

---

## D8: CLI — `[~] REAL`

**What we HAVE:**
- 9 command files: admin, config, conversations, fleet, health, providers, system, telemetry, version
- Command registry, output formatter, pipeline engine
- Bridges to engine interfaces

**What's STUB:**
- Commands call engine methods that are stubs
- No real Chrome automation commands

**Gap:** Commands work once engines are wired
**Status:** Will be REAL once D1-D6 are done

---

## D9: Frontend — `[✗] MISSING`

**What we HAVE:**
- Nothing in vivim-final

**What we NEED (from vivim-app-og reference):**
- 138 React components (reference)
- 33 Zustand stores (reference)
- Tauri shell configuration
- Chat UI, provider selector, streaming renderer

**Gap:** ~3-4 weeks of frontend work
**Decision:** Build new, learn from vivim-app-og

---

## D10: Tests — `[~] REAL`

**What we HAVE:**
- 29 test files
- Unit tests with mocked stores
- E2E test stubs (claude-send, chatgpt-send, multi-turn)

**What's REAL:**
- ChromeGovernor tests (636 lines) — test structure, not real Chrome
- ConversationManager tests (313 lines) — test pipeline logic
- Store implementation tests — test Prisma queries

**What's MISSING:**
- Integration tests with real Chrome
- E2E tests against real providers

**Gap:** Tests are good for structure, need real integration tests after D1

---

## Critical Path (Build Order)

```
D1: Chrome Automation (CDP)         ← START HERE
    ↓
D2: Chrome Process Management       ← depends on D1
    ↓
D3: Conversation Pipeline           ← depends on D1, D2
    ↓
D6: Engine Wiring                   ← depends on D1, D2, D3
    ↓
D5: API Layer                       ← depends on D3, D6
    ↓
D8: CLI (real commands)             ← depends on D5
    ↓
D9: Frontend                        ← depends on D5
    ↓
D10: Integration Tests              ← depends on all
```

---

## Interview Log

### Session 1: 2026-07-10
- **Topic:** Initial gap analysis
- **Findings:** Chrome automation is the critical path — all stubs
- **Decision:** Port from cap-store, keep existing engine interfaces
- **Next:** Deep dive on D1 (Chrome Automation)

---

## Deep Dive Queue

| # | Domain | Status | Asked By |
|---|--------|--------|----------|
| 1 | D1: Chrome Automation | QUEUED | — |
| 2 | D2: Chrome Process Management | QUEUED | — |
| 3 | D3: Conversation Pipeline | QUEUED | — |
| 4 | D5: API Layer | QUEUED | — |
| 5 | D6: Engine Wiring | QUEUED | — |
| 6 | D9: Frontend | QUEUED | — |
