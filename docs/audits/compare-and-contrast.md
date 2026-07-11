# Compare & Contrast: Three Original Codebases vs Vivim-Final

**Date:** 2026-07-07
**Purpose:** Prioritize harvesting from cap-store, capability-lab, and original Rust backend into vivim-final with minimal adjustments and zero fundamental design breakage.
**Scope:** 31 harvest candidates across 9 categories, 4 codebases compared

---

## Key Finding

**vivim-final's Prisma schema already has everything we need to harvest.**

- `CapabilityBinding.status` (String, default "prospect") — ready for 7-state ladder
- `CapabilityBinding.confidence` (Float, default 0.0) — ready for confidence formula
- `CapabilityBinding.promotionHistoryJson` (String, default "[]") — ready for promotion log
- `BindingStatusLog` — full audit trail model with from/to status, trigger, confidence at transition
- `StreamParserEngine` with `ContentBlock` union type (13 variants) — already richer than originals
- `SelectorStrategy` + `SelectorHealthHistory` — self-healing data model ready

**The gap is in the engine code, not the data model.** Every harvested feature maps to an existing Prisma field or model. Zero migrations required.

---

## Quick Reference

| Symbol | Meaning |
|--------|---------|
| ✓ | Fully implemented in that codebase (no harvest needed) |
| ~ | Schema exists, code is stub/incomplete (harvest fills the gap) |
| ✗ | Doesn't exist at all |
| P | Port directly (same language, minimal adaptation) |
| A | Adapt pattern (different abstraction, needs rethinking) |
| SKIP | Already implemented in vivim-final |

---

## Category 1: Binding Lifecycle & Confidence

| Feature | Cap-Store | Cap-Lab | Backend | Vivim-Final | Harvest? |
|---------|-----------|---------|---------|-------------|----------|
| Confidence formula | ✓ pure fn (168 LOC) | ✓ pure fn | ✗ | ~ schema has `confidence` field, 0 engines fill it | **P — 168 LOC, zero deps** |
| Status ladder (7-state) | ✓ lifecycle/index.ts (169 LOC) | ✓ promotion/ladder.ts | ✗ | ~ schema has `status` + `BindingStatusLog`, no engine enforces transitions | **P — 169 LOC** |
| Auto-promotion rules | ✓ autoStatus() (80 LOC) | ✓ advanceStatus() | ✗ | ~ `promotionHistoryJson` exists, no code writes it | **P — 80 LOC** |
| Timeout guard | ✓ checkTimeoutGuard() (60 LOC) | ✗ | ✗ | ✗ | **P — 60 LOC** |
| Promotion oversight queue | ✗ | ✓ gate.ts | ✗ | ✗ | **A — needs human-in-loop, add as optional gate** |
| Verify gate | ✓ verify.ts (89 LOC) | ✓ outcomes.ts | ✗ | ✗ no verify gate | **P — 89 LOC** |

### Analysis

The cap-store has the most mature lifecycle system with 7 states (`prospect → needsReview → review → approved → active → degraded → disabled`) and automatic timeout guards. Capability-lab has a similar 5-state ladder with human oversight gates. The original backend has no lifecycle management at all.

vivim-final's `CapabilityBinding` model already stores `status`, `confidence`, and `promotionHistoryJson`, and `BindingStatusLog` captures every transition. The schema is ready — we just need the engine code that enforces transitions and fills confidence scores.

**What to harvest:** Confidence formula (pure function, 168 LOC), status ladder (169 LOC), auto-promotion rules (80 LOC), timeout guard (60 LOC), verify gate (89 LOC). All pure functions with zero dependencies on cap-store's storage layer.

---

## Category 2: Discovery & Drift

| Feature | Cap-Store | Cap-Lab | Backend | Vivim-Final | Harvest? |
|---------|-----------|---------|---------|-------------|----------|
| Drift detection | ✓ drift.ts (96 LOC) | ✓ monitor.ts | ✓ provider_protocols.rs | ✗ | **P — 96 LOC** |
| Drift severity thresholds | ✓ 4-level | ✓ regression | ✓ | ✗ | **P — threshold table** |
| URL wildcard matcher | ✗ | ✗ | ✓ url_matches_pattern() (25 LOC) | ✗ | **P — 25 LOC, pure function** |
| Discovery scanner | ✗ | ✓ scanner.ts (viewport sweep) | ✗ | ~ ProviderDiscoveryEngine (in-memory stub) | **A — cap-lab's viewport sweep** |
| Discovery prober | ✗ | ✓ prober.ts (interactivity probe) | ✗ | ~ stub only | **A — cap-lab interactivity probe** |
| Discovery registrar | ✗ | ✓ registrar.ts (pipeline) | ✗ | ~ stub only | **A — cap-lab pipeline** |

### Analysis

Drift detection exists in three of four codebases. The backend has the most sophisticated version with `check_protocol_consistency()` and `check_url_accessibility()`. Cap-store has a lighter pure-function approach with severity levels. Capability-lab focuses on regression detection (DOM changes between runs).

vivim-final has zero drift detection. The backend's Rust implementation can't be ported directly, but cap-store's `drift.ts` (96 LOC) is a pure TypeScript function that compares old vs new manifests and returns severity + recommendations.

The URL wildcard matcher from the backend (`url_matches_pattern()`, 25 LOC) is trivially portable — it's a single function that converts `*` to regex.

**What to harvest:** Drift monitor (96 LOC pure function), URL wildcard matcher (25 LOC pure function). The discovery scanner/prober/registrar from cap-lab need adaptation to vivim-final's ChromeGovernor CDP session model.

---

## Category 3: Streaming & Parsing

| Feature | Cap-Store | Cap-Lab | Backend | Vivim-Final | Harvest? |
|---------|-----------|---------|---------|-------------|----------|
| SSE line buffer | ✓ parsers/sse.ts (50 LOC) | ✓ parsers/sse.ts | ✗ | ~ built-in parser (partial) | **P — replace built-in with robust version** |
| Per-provider delta extractor | ✓ parsers/{claude,chatgpt,gemini}.ts | ✓ parsers/{sse,gemini,artifacts}.ts | ✓ parsers.rs | ~ seed parsers exist but simpler | **P — per-provider completion config** |
| Stream completion table | ✓ stream-detector.ts (155 LOC, 8 providers) | ✗ (hardcoded) | ✗ | ✗ no completion detector | **P — 8-entry config table** |
| ContentBlock model (13 types) | ✗ (simple) | ✓ blocks.ts (13 variants) | ✗ | ✓ **has ContentBlock union** | **SKIP — already done** |
| Parser module interface | ✓ ProviderParser | ✓ ProviderParser | ✓ ParserRegistry | ✓ **has ParserModule** | **SKIP — already done** |
| Stream capture (3-layer) | ✗ (basic) | ✓ executor.ts 3-layer | ✗ | ~ ChromeGovernor has basic | **A — cap-lab's 3-layer (Binding→Fetch→Network)** |

### Analysis

The stream completion detector from cap-store (`stream-detector.ts`, 155 LOC) is the highest-value harvest here. It's a pure config table mapping provider names to completion patterns (e.g., Claude uses `"message_stop"` and `"message_delta"`, ChatGPT uses `"[DONE]"`, Gemini uses `"turn_complete"`). vivim-final's `StreamParserEngine` has the parsing infrastructure but no completion detection — it parses blocks but doesn't know when a stream is done.

The SSE parser from cap-store (`parsers/sse.ts`, 50 LOC) is a more robust version of vivim-final's built-in. It handles edge cases: empty data fields, multi-line SSE data, reconnect markers, and keep-alive comments.

Per-provider delta extractors from cap-store are simple config objects that map JSON paths to semantic meanings (e.g., Claude's `delta.stop_reason` → stop reason). vivim-final's seed parsers already do this for some providers, but cap-store covers 3 additional providers.

**What to harvest:** Stream completion detector (155 LOC config table), robust SSE parser (50 LOC), per-provider delta extractors (extend existing seeds). The ContentBlock model and ParserModule interface are already richer in vivim-final.

---

## Category 4: CDP & Chrome Management

| Feature | Cap-Store | Cap-Lab | Backend | Vivim-Final | Harvest? |
|---------|-----------|---------|---------|-------------|----------|
| CDP client (WebSocket) | ✓ cdp.ts (621 LOC) | ✓ client.ts (340 LOC) | ✗ | ✓ **ChromeGovernor has full CDP** | **SKIP — already done** |
| A11y locator + fallback | ✗ | ✓ locator.ts (207 LOC) | ✗ | ✓ **CDP has AX tree** | **SKIP — already done** |
| Fleet management | ✓ supervisor (581 LOC) | ✓ launcher + registry | ✗ | ✓ **ChromeGovernor** | **SKIP — different abstraction** |
| Circuit breaker | ✓ circuit-breaker.ts | ✗ | ✗ | ✓ **CircuitOpenError** | **SKIP — already done** |
| Recipe executor | ✓ recipe.ts (441 LOC) | ✓ executor.ts (624 LOC) | ✗ | ~ HarnessRuntime (exists) | **A — cap-lab's locate→act→observe** |
| Turn executor | ✓ turn-executor.ts (171 LOC) | ✗ | ✗ | ✗ | **P — lightweight, 171 LOC** |
| Trusted input dispatch | ✗ | ✓ input.ts (138 LOC) | ✗ | ✗ | **P — critical for ProseMirror** |

### Analysis

vivim-final's ChromeGovernor is the most complete CDP implementation across all four codebases — it handles page lifecycle, CDP session management, accessibility tree inspection, and protocol tracing. The cap-store and capability-lab CDP clients are subsets of what ChromeGovernor already does.

The two unique harvestable items are:

1. **Turn executor** (cap-store, 171 LOC): Executes a single turn (CDP commands → wait → check completion). Simple state machine: `awaitCompletion()` checks for `done` signal with configurable timeout. vivim-final has no equivalent — ChromeGovernor manages sessions but doesn't have a turn-level executor.

2. **Trusted input dispatch** (cap-lab, 138 LOC): Handles `Input.insertText` for ProseMirror contenteditable editors, `Input.dispatchKeyEvent` for keyboard shortcuts, and `Input.dispatchMouseEvent` for click simulation. vivim-final's CDP client can send raw CDP commands but doesn't have the trusted-input abstraction.

**What to harvest:** Turn executor (171 LOC, wire through ChromeGovernor's CDP session), trusted input dispatch (138 LOC, add to CDP client). Skip CDP client, A11y locator, fleet management, circuit breaker — all already done.

---

## Category 5: Production Hardening

| Feature | Cap-Store | Cap-Lab | Backend | Vivim-Final | Harvest? |
|---------|-----------|---------|---------|-------------|----------|
| Pre-migration backup | ✓ keeps last 5 (36 LOC) | ✗ | ✗ | ✗ | **P — 36 LOC** |
| Crash report writer | ✓ JSON crash dumps (39 LOC) | ✗ | ✗ | ✗ | **P — 39 LOC** |
| Port lock file | ✓ .mirror-port (22 LOC) | ✗ | ✗ | ✗ | **P — 22 LOC** |
| Graceful shutdown | ✓ 10s fallback (24 LOC) | ✗ | ✗ | has partial | **P — checkpoint + killAll** |
| Error→HTTP mapping | ✓ toHttpStatus() (8 LOC/class) | ✗ | ✗ | ✗ no mapping | **P — 8 lines per error class** |
| Production error scrubbing | ✓ isProduction check (5 LOC) | ✗ | ✗ | ✗ | **P — 5 lines** |
| Auth gate | ✓ Bearer token | ✗ | ✗ | ✓ **has checkAuth()** | **SKIP — already done** |

### Analysis

Cap-store is the only codebase with production hardening patterns. These are all small, self-contained utilities that don't depend on cap-store's storage layer. They're the easiest harvests in the entire audit.

The error→HTTP mapping is the most valuable for Phase 22: MCP server needs to return proper HTTP status codes for tool call errors. vivim-final's `src/errors.ts` has a rich error hierarchy (`VivimError`, `ConfigError`, `CircuitOpenError`, etc.) but no HTTP mapping. Adding `toHttpStatus()` to each error class is 8 lines per class.

**What to harvest:** All of them. Pre-migration backup (36 LOC), crash report (39 LOC), port lock (22 LOC), graceful shutdown (24 LOC), error→HTTP mapping (8 LOC/class), production error scrubbing (5 LOC). Total: ~134 LOC of pure utility code.

---

## Category 6: Autonomous Loops

| Feature | Cap-Store | Cap-Lab | Backend | Vivim-Final | Harvest? |
|---------|-----------|---------|---------|-------------|----------|
| Health check loop | ✓ 5s interval (probe.ts + loop.ts) | ✗ | ✗ | ✗ | **P — probe.ts + loop.ts** |
| Drift detection loop | ✓ 60s interval | ✗ | ✗ | ✗ | **P — wraps drift detector** |
| Startup recovery | ✓ session checkpoint | ✗ | ✗ | ✗ | **A — restore from checkpoint** |
| Scheduler | ✓ automation/scheduler.ts | ✗ | ✗ | ✓ **scheduler.js (ported)** | **SKIP — already exists** |
| Alerting | ✓ alerter + dedup + cooldown + webhook | ✗ | ✗ | ✓ **alerter.ts (ported)** | **SKIP — already exists** |

### Analysis

Cap-store has two autonomous loops that vivim-final lacks:

1. **Health check loop** (5s interval): Probes each registered provider's health endpoint, tracks response times, detects failures, and triggers circuit breaker. Uses cap-store's `HealthProbe` interface and `HealthCheckResult` type.

2. **Drift detection loop** (60s interval): Runs the drift detector from Category 2 on a timer, compares current manifests against stored baselines, and emits alerts when drift exceeds thresholds.

vivim-final already has `scheduler.js` and `alerter.ts` ported from cap-store, so those are skipped. The health check and drift loops are new capabilities that would run as background engines.

**What to harvest:** Health check loop (probe + loop, ~200 LOC), drift detection loop (~50 LOC wrapping the drift detector). Defer startup recovery — it requires checkpoint serialization which needs design thought.

---

## Category 7: Schema & Storage

| Feature | Cap-Store | Cap-Lab | Backend | Vivim-Final | Harvest? |
|---------|-----------|---------|---------|-------------|----------|
| DB/ORM | bun:sqlite (raw) | file JSON | file JSON | **Prisma + PostgreSQL** | **DON'T PORT** |
| Migration system | 41 SQL files | none | none | ✓ **Prisma migrations** | **SKIP — already done** |
| 3-layer taxonomy model | ✓ taxonomy→binding→program | ✓ similar | ✓ capability vault | ✓ **same model in Prisma** | **SKIP — already done** |
| Binding status log | ✓ promotion_history JSON | ✓ similar | ✗ | ✓ **BindingStatusLog model** | **SKIP — already done** |
| Selector strategies | ✓ SelectorStrategy table | ✓ portfolio system | ✗ | ✓ **SelectorStrategy model** | **SKIP — already done** |
| Provider manifest | ✗ | ✓ ProviderConfig | ✓ protocol entries | ✓ **ProviderManifestVersion** | **SKIP — already done** |
| Transfer system | ✓ transfer/ | ✓ prediction/transfer | ✗ | ✓ **TransferAccelerator engine** | **SKIP — already exists** |

### Analysis

**Nothing to harvest from this category.** vivim-final's Prisma schema is strictly superior to all three originals:

- Prisma provides type-safe queries, migrations, and connection pooling — raw SQLite and file JSON can't compete
- The 3-layer taxonomy→binding→program model is already implemented in Prisma
- All supporting models (BindingStatusLog, SelectorStrategy, SelectorHealthHistory, ProviderManifestVersion) exist
- The transfer system is already ported

The only thing from the originals worth noting is cap-store's migration backup strategy (keep last 5 databases), which is a production hardening utility (Category 5), not a schema pattern.

---

## Category 8: Self-Healing

| Feature | Cap-Store | Cap-Lab | Backend | Vivim-Final | Harvest? |
|---------|-----------|---------|---------|-------------|----------|
| Pattern store | ✓ patterns.ts | ✓ outcomes.ts | ✗ | ✓ **SelectorHealthHistory** | **SKIP — already done** |
| Failure classifier | ✗ | ✓ classifier.ts (296 LOC, 5 types) | ✗ | ~ SelectorHealer engine (exists) | **A — cap-lab's 5-type classifier** |
| Selector portfolio | ✗ | ✓ portfolio.ts (456 LOC, 5 strategies) | ✗ | ✗ | **A — 5-strategy fallback chain** |
| Parallel healer | ✗ | ✓ healer.ts (250 LOC, semaphore) | ✗ | ✗ | **A — semaphore + timeout** |
| Health monitor | ✗ | ✓ monitor.ts (302 LOC, trend + regression) | ✗ | ✗ | **A — trend + regression** |
| Auto-demotion pipeline | ✗ | ✓ demotion.ts (236 LOC, cooldown) | ✗ | ✗ | **A — cooldown + rules** |

### Analysis

Capability-lab has the most complete self-healing system. vivim-final has `SelectorHealer` and `SelectorHealthHistory` but they're minimal — the healer retries selectors but doesn't classify failures, manage portfolios, or run parallel healing.

The key adaptation challenge: cap-lab stores everything in file-based JSON (`data/healing/patterns.json`, `data/healing/outcomes.json`). vivim-final uses Prisma tables (`SelectorHealthHistory`, `SelectorStrategy`, `BindingEvent`). The algorithms are portable, but the storage layer needs to be swapped.

**What to harvest:** Failure classifier (296 LOC, adapt to use SelectorHealthHistory), selector portfolio generator (456 LOC, adapt to use SelectorStrategy), parallel healer (250 LOC, wire into SelectorHealer), health monitor (302 LOC, use existing tables), auto-demotion pipeline (236 LOC, use BindingStatusLog). Total: ~1,536 LOC of algorithms, storage layer swapped to Prisma.

---

## Category 9: MCP / Tooling (Phase 22 Focus)

| Feature | Cap-Store | Cap-Lab | Backend | Vivim-Final | Harvest? |
|---------|-----------|---------|---------|-------------|----------|
| MCP server | ✗ | ✗ | ✗ | ~ planned (Phase 22) | **IMPLEMENT from scratch** |
| Agent-callable tools | ✗ | ✗ | ✗ | ~ planned (Phase 22) | **IMPLEMENT from scratch** |
| Per-field confidence | ✗ | ✗ | ✗ | ✗ planned | **IMPLEMENT — needsReview detection** |
| Shape adapters | ✗ | ✗ | ✗ | ~ CapabilityAdapter interface exists | **IMPLEMENT — adapter seeds** |
| Plugin system | ✗ | ✗ | ✗ | ~ plugin-system.ts stub | **IMPLEMENT — 22.8 adapter seeds** |

### Analysis

None of the three originals have MCP tooling — this is net-new for vivim-final. The harvest value for Phase 22 is in the *algorithms* that MCP tools expose, not the MCP server itself:

- **confidence-score.ts** → `confidence_score` MCP tool
- **lifecycle-ladder.ts** → `check_status_transition` MCP tool
- **stream-detector.ts** → `detect_stream_completion` MCP tool
- **drift-monitor.ts** → `check_manifest_drift` MCP tool

The MCP server framework (`@modelcontextprotocol/sdk`) is a new dependency. The tools wrap harvested pure functions.

---

## PRIORITIZED HARVEST LIST

### Tier 0: Already Done in Vivim-Final (Don't Touch)

| Harvest Candidate | Reason to Skip |
|-------------------|----------------|
| CDP client (621/340 LOC) | ChromeGovernor already has full CDP |
| A11y locator (207 LOC) | ChromeGovernor already has AX tree |
| Fleet management (581 LOC) | ChromeGovernor is per-session, different abstraction |
| Circuit breaker | CircuitOpenError already exists |
| ContentBlock model (13 types) | StreamParserEngine already has the union type |
| Parser module interface | ParserModule already defined in stream-parser.ts |
| Prisma schema (all tables) | Already has binding, program, taxonomy, statusLog, strategies |
| Auth gate | Already has checkAuth() |
| Scheduler/alerter | Already ported in earlier phases |
| Transfer system | TransferAccelerator engine exists |
| Selector strategies | SelectorStrategy + SelectorHealthHistory exist |
| Provider manifest | ProviderManifestVersion exists |

**Total skipped: ~3,500+ LOC already implemented.**

---

### Tier 1: Pure-Function Harvest (Zero Architectural Impact)

These are self-contained pure functions. Add file, export. No changes to existing engines or schema. **Highest priority because they cost nothing to integrate.**

| # | What | Source | File to Create | LOC | Dependencies |
|---|------|--------|---------------|-----|--------------|
| 1 | Confidence formula | cap-store confidence.ts | `src/engines/confidence-score.ts` | 168 | None (pure math) |
| 2 | Status ladder + auto-promote | cap-store lifecycle/index.ts | `src/engines/lifecycle-ladder.ts` | 169 | None (state machine) |
| 3 | Stream completion detector | cap-store stream-detector.ts | `src/engines/stream-detector.ts` | 155 | None (config table) |
| 4 | Drift monitor | cap-store drift.ts | `src/engines/drift-monitor.ts` | 96 | None (diff function) |
| 5 | URL wildcard matcher | backend provider_protocols.rs | `src/utils/url-pattern.ts` | 25 | None (regex) |
| 6 | SSE parser (robust) | cap-store parsers/sse.ts | `src/parsers/sse.ts` | 50 | None (string parsing) |
| 7 | Verify gate | cap-store verify.ts | `src/engines/verify-gate.ts` | 89 | None (validation logic) |
| 8 | Error→HTTP mapping | cap-store errors.ts | extend `src/errors.ts` | 8/class | None (lookup table) |
| 9 | Timeout guard | cap-store lifecycle/index.ts | add to `lifecycle-ladder.ts` | 60 | None (timer) |

**Total Tier 1: ~820 LOC, ~2 hours. Zero design impact.**

---

### Tier 2: Schema-Aligned Hook Points (Fill Existing Gaps)

These harvests wire pure functions into existing vivim-final engines, filling known stub methods. **The schema is already ready — just add code.**

| # | What | Where to Wire | Impact |
|---|------|---------------|--------|
| 10 | Wire confidence into `CapabilityBinding.confidence` | `provider-discovery.ts` or new confidence job | Updates existing DB field, no migration |
| 11 | Wire status ladder → `BindingStatusLog` | `capability.ts` on program execution | Uses existing `BindingStatusLog` model |
| 12 | Wire stream completion into `StreamParserEngine` | `stream-parser.ts` `detectCompletion()` | Adds provider-specific early-resolve |
| 13 | Wire per-provider delta extractors | `parsers/` seed files | Reuses existing seed loader pattern |
| 14 | Wire URL matcher into manifest inference | `manifest-inference.ts` URL comparison | Reuses existing provider config |
| 15 | Wire error→HTTP in server response handler | `src/server/response.ts` | Already has `err()` helper, just add mapping |

---

### Tier 3: Adapt Patterns (Need Architectural Alignment)

These patterns exist in the originals but need adaptation to vivim-final's architecture.

| # | What | Source | Adaptation Required |
|---|------|--------|---------------------|
| 16 | Recipe JSON format | cap-lab executor.ts (624 LOC) | Adapt locate→act→observe pipeline to vivim's existing recipe format |
| 17 | Turn executor | cap-store turn-executor.ts (171 LOC) | Wire through ChromeGovernor's CDP session, not new connection |
| 18 | Trusted input dispatch | cap-lab input.ts (138 LOC) | Add `Input.insertText` + `Input.dispatchKeyEvent` to CDP client |
| 19 | Health check loop | cap-store probe.ts + loop.ts (~200 LOC) | Create as optional engine, config-gated, uses ChromeGovernor health probes |
| 20 | Drift detection loop | cap-store loop.ts (~50 LOC) | Create as optional engine wrapping Tier 1 drift monitor |
| 21 | Failure classifier | cap-lab classifier.ts (296 LOC) | Use SelectorHealthHistory + BindingEvent tables instead of file JSON |
| 22 | Selector portfolio generator | cap-lab portfolio.ts (456 LOC) | Use SelectorStrategy model instead of in-memory portfolio |
| 23 | Parallel healer | cap-lab healer.ts (250 LOC) | Wire into existing SelectorHealer engine |

---

### Tier 4: Production Hardening (One-Off Additions)

| # | What | Source | Effort | Lines |
|---|------|--------|--------|-------|
| 24 | Pre-migration backup | cap-store backup.ts | Add to seed/migration scripts | 36 |
| 25 | Crash report handler | cap-store crash-report.ts | Add to `src/server/index.ts` | 39 |
| 26 | Port lock file | cap-store port-lock.ts | Add to server startup | 22 |
| 27 | Graceful shutdown with checkpoint | cap-store graceful-shutdown.ts | Enhance existing shutdown | 24 |
| 28 | Production error scrubbing | cap-store errors.ts | Add isProduction guard to response handler | 5 |

---

## DECISION MATRIX: What to Harvest for Phase 22

| Feature | Tier | Phase 22 Req? | Harvest? | Effort |
|---------|------|---------------|----------|--------|
| Confidence formula | 1 | YES (manifest) | ✓ DO IT | 30 min |
| Status ladder | 1 | YES (validate) | ✓ DO IT | 30 min |
| Stream completion detector | 1 | YES (detect) | ✓ DO IT | 30 min |
| SSE parser (robust) | 1 | YES (parse) | ✓ DO IT | 15 min |
| Error→HTTP mapping | 1 | YES (MCP errs) | ✓ DO IT | 10 min |
| URL wildcard matcher | 1 | YES (match) | ✓ DO IT | 10 min |
| Drift monitor | 1 | no (nice-to-have) | defer | — |
| Verify gate | 1 | no | defer | — |
| Timeout guard | 1 | no | defer | — |
| Per-provider delta extract | 2 | YES (parse) | ✓ DO IT | 30 min |
| Wire confidence to DB | 2 | YES (store) | ✓ DO IT | 15 min |
| Wire completion to parser | 2 | YES | ✓ DO IT | 15 min |
| Turn executor | 3 | YES (probe) | ✓ ADAPT | 1 hour |
| Trusted input dispatch | 3 | YES (interact) | ✓ ADAPT | 1 hour |
| Recipe JSON format | 3 | nice-to-have | defer | — |
| Health loops | 3 | no | defer | — |
| Failure classifier | 3 | nice-to-have | defer | — |
| Selector portfolio | 3 | no | defer | — |

**Phase 22 harvest load: ~12 items, ~5 hours, zero schema changes, zero breaking changes.**

---

## CRITICAL: What NOT to Harvest

These patterns from the originals would **break vivim-final's fundamental design**:

| Original Pattern | Why BREAKS Vivim-Final |
|-----------------|------------------------|
| **bun:sqlite** — cap-store's raw SQLite | Vivim-final uses Prisma + PostgreSQL. Mixing ORMs breaks migration, type safety, invariants |
| **File-based JSON/JSONL** — cap-lab's persistence | Prisma is the single source of truth. File-based = drift |
| **Batch v02 routing** — cap-store's lazy import chain | Fragile, hard to debug. Vivim-final's explicit route registration is cleaner |
| **Per-provider Fleet Supervisor** — cap-store's pool | ChromeGovernor is per-session, not per-provider. Two different abstractions |
| **In-memory session map** — provider-discovery.ts currently | Should use Prisma (already have `discovery_session` table) |
| **setInterval polling** — cap-lab's SPA nav detection | Use CDP `Page.frameNavigated` event instead |
| **`Arc<RwLock<HashMap>>`** — backend's concurrency model | Prisma handles concurrency at the DB level |
| **`import.meta.dir` for data paths** | Use centralized `config.ts` path resolution |

---

## Summary Statistics

| Category | Items | LOC | Effort | Tier |
|----------|-------|-----|--------|------|
| Already done (skip) | 9 | ~3,500+ | 0 | Tier 0 |
| Pure functions (zero impact) | 9 | ~820 | ~2 hours | Tier 1 |
| Schema-aligned hooks | 6 | ~150 | ~1 hour | Tier 2 |
| Adapt patterns | 8 | ~2,036 | ~4 hours | Tier 3 |
| Production hardening | 5 | ~126 | ~30 min | Tier 4 |
| Don't harvest (breaks design) | 8 | — | — | Forbidden |
| **Total** | **45** | **~6,632** | **~7.5 hours** | |

### Phase 22 Specific

| Metric | Value |
|--------|-------|
| Items to harvest | 12 |
| Estimated LOC | ~1,200 |
| Estimated effort | ~5 hours |
| Schema changes | 0 |
| Breaking changes | 0 |
| New Prisma models | 0 |
| New dependencies | 1 (`@modelcontextprotocol/sdk`) |

### Design Invariant Preserved

All harvested code is **additive**. No existing engine, store contract, or Prisma model is modified — only files are created and new capabilities are wired into existing stub methods.

---

## Appendix: Source File Locations

| Codebase | Audit File | LOC Audited |
|----------|-----------|-------------|
| Original Rust backend | `docs/audits/original-vivim-app-discovery-audit.md` | ~3,000 (5 modules) |
| Capability-lab | `docs/audits/capability-lab-audit.md` | ~8,000 (30 modules) |
| Cap-store | `docs/audits/cap-store-audit.md` | ~11,500 (70+ files) |
| Vivim-final | `docs/audits/compare-and-contrast.md` (this file) | All of the above |
