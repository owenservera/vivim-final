# Cap-Store Audit — Comprehensive Findings

**Source:** `edge-pwa/cap-store/` (Bun + TypeScript, bun:sqlite)
**Audit Date:** 2026-07-11
**Files Scanned:** ~70 source files across 25+ subsystems

---

## 1. Architecture Overview

The cap-store is a **mature, production-hardened** local-first capability store with a Bun HTTP server, typed SQLite backend, and rich engine layer. It owns the canonical capability taxonomy, provider bindings, action programs, and adjacent metadata.

### Layer Stack
```
HTTP/WS Server (src/server/) — Bun.serve, REST + WebSocket
├── Router (src/router/) — Verb-based dispatch → binding resolution
├── CLI (src/cli/) — REPL, commands, diagnostics, chat engine
│
├── State Engine (src/state/) — Delta pipeline, state machines, checkpoints
│
├── Executor (src/executor/) — Chrome CDP execution, recipe runner, fleet
│   ├── Fleet Supervisor (fleet-supervisor.ts) — Slave lifecycle + circuit breaker
│   ├── CDP Client (cdp.ts) — WebSocket CDP proxy (621 LOC)
│   ├── Recipe Runner (recipe.ts) — Step-by-step action execution (441 LOC)
│   ├── Parser Ecosystem (parsers/, parsers.ts) — SSE + per-provider
│   ├── Capture Layer (stream-capture, network-capture) — Streaming + HTTP
│   ├── Turn Executor (turn-executor.ts) — Single-conversation-turn
│   ├── Launcher (launcher.ts) — Chrome spawn/kill (237 LOC)
│   └── Transfer System (transfer/generator.ts) — Cross-provider transfer
│
├── Confidence Engine (confidence.ts) — Multi-factor scoring (168 LOC)
├── Lifecycle Engine (lifecycle/index.ts) — Status ladder + promotion
├── Drift Monitor (drift.ts) — Success-rate degradation detection
├── Pattern Store (patterns.ts) — Repair pattern CRUD
├── Verify Gate (verify.ts) — Learning verification + escalation
│
├── Health Subsystem (src/health/) — Loops, probes, recovery, alerting (7 files)
├── Automation (src/automation/) — Scheduler
├── Alerting (src/alerting/) — Alerter, cooldown, dedup, webhook, window (6 files)
├── Learning Ledger (src/learnings/) — Append-only JSONL journal
│
├── Storage (src/storage/) — bun:sqlite wrapper, 11 batch files (v02-batch1..11)
├── Migration Engine (src/migrate/) — One-shot mirror data migrator (639 LOC)
├── Data Migrations (migrations/) — 41 sequential SQL files
│
├── Schema (src/schema/) — 12 files: core, provider, learning, transfer, chrome, routing, session, automation, streaming
├── Config (config.ts) — env-driven server config
├── Errors (errors.ts) — Typed hierarchy (77 LOC)
├── IDs (ids.ts) — Prefix-based ID derivation (107 LOC)
└── Barrel (index.ts) — Public exports
```

### Dependencies (Runtime)
- `zod` ^3.23.8 — validation
- `opencode-ai` ^1.17.15 — only external dep beyond Bun built-ins
- **Zero:** express, ws, sqlite3 packages — all Bun-native

---

## 2. Key Architecture Patterns (12 Findings)

### Finding 1: Layered Taxonomy Model (3-Layer Canonical)
**Files:** `src/schema/core.ts`, `src/storage/db.ts`, `src/lifecycle/index.ts`

The cap-store implements a clean 3-layer model fully mapped to SQLite tables:
- **Layer 0: TaxonomyGlobal** — Provider-agnostic capability definition (slug, affordances, gotchas)
- **Layer 1: ProviderBinding** — Binding of a taxonomy item to a specific provider (confidence, status, promotion history)
- **Layer 2: ActionProgram** — Executable steps that realize a binding (click/type/wait/navigate/arm)

**Status:** Fully implemented with CRUD, confidence scoring, promotion ladder, timeout guard.

**Vivim-Final Comparison:** vivim-final has the same 3-layer model in Prisma (`capability_global`, `capability_binding`, `capability_program`) but lacks the promotion ladder, timeout guard, and confidence gateway to `stable`. **Port:** `lifecycle/index.ts` + `confidence.ts` logic.

---

### Finding 2: Confidence Scoring System
**File:** `src/confidence.ts` (168 LOC)

Multi-factor confidence formula:
```
score = statusWeight(0.35) + successRate(0.25) + recency(0.15) + replayBonus(0.15) + driftPenalty(-0.20) + patternHits(0.10)
```
- `computeFullConfidence()` queries DB for windowed outcomes + tier weight
- `windowedConfidence()` — rolling 30-outcome window
- `strategyConfidence()` — confidence broken down by selector strategy
- `computeConfidenceWithTier()` — tier-weighted (free/starter/pro/enterprise)

**Vivim-Final Comparison:** vivim-final has no confidence scoring at all — bindings have a `confidence` column but no code fills it. **Port:** Entire `confidence.ts` module (pure functions, zero Bun-specific deps).

---

### Finding 3: Lifecycle Promotion State Machine
**File:** `src/lifecycle/index.ts` (169 LOC)

- 7-state ladder: `prospect → test-1 → test-2 → stable ↔ flaky ↔ broken → retired`
- Valid transition matrix enforces legal moves
- `autoStatus()` — auto-advance based on observed oks/fails
- `checkTimeoutGuard()` — time-based promotion (test-1 >24h, test-2 >7d)
- `appendPromotionHistory()` — immutable record keeping

**Vivim-Final Comparison:** vivim-final uses `BindingStatus` enum in Prisma but no code manages transitions. **Port:** Entire `lifecycle/index.ts` module.

---

### Finding 4: Drift Detection
**File:** `src/drift.ts` (96 LOC)

- Compares recent (10) vs older (10-20) outcome success rates
- Classifies severity: low/medium/high/critical via threshold table
- `DriftMonitor` interface — `scan()`, `listEvents()`, `resolveEvent()`, `checkBinding()`

**Vivim-Final Comparison:** No drift detection. **Port:** `drift.ts` as a new engine.

---

### Finding 5: Chrome Fleet Supervisor
**File:** `src/executor/fleet-supervisor.ts` (581 LOC)

- State machine: stopped/starting/running/unhealthy/restarting/error/circuit_open
- Circuit breaker integration (CircuitOpenError with retryAfterMs)
- Async mutex for per-provider exclusive access
- Health probes, reconnection, keepalive pings
- ProfileAllocator, AccountRegistry integration
- Delta emission on state changes

**Vivim-Final Comparison:** vivim-final's `ChromeGovernor` manages Chrome lifecycle per-session. The fleet supervisor pattern (pool of Chrome instances per provider) is a different abstraction — useful for multi-account provider management but not a direct port.

---

### Finding 6: Per-Provider Parser Ecosystem
**Files:** `src/executor/parsers.ts` (155 LOC), `src/executor/parsers/claude.ts`, `chatgpt.ts`, `gemini.ts`, `claude-blocks.ts`, `sse.ts`

- Line-buffered SSE parser (`createSSEParser()`) — handles `event:`, `data:`, `id:`, `retry:` fields
- Per-provider `extractEvents()` extractors (ChatGPT delta, Claude content blocks, Gemini batchexecute)
- `StreamDetector` module — per-provider completion signals (`[DONE]`, `message_stop`, `["e"`)
- 8 provider entries in STREAM_COMPLETION_CONFIGS table

**Vivim-Final Comparison:** vivim-final's `StreamParserEngine` has seed parsers (SSE frames, deltas) but no per-provider extraction. **Pattern to adopt:** Provider-specific completion detector + delta extractor.

---

### Finding 7: Production Hardening (6 Features)
**Files scattered across `src/server/index.ts`, `src/storage/db.ts`**

| Feature | File | LOC |
|---------|------|-----|
| Pre-migration DB backup (keep last 5) | `db.ts:573-608` | 36 |
| Crash report writer (uncaughtException/Rejection) | `server/index.ts:616-654` | 39 |
| Port lock file (`.mirror-port`) | `server/index.ts:452-473` | 22 |
| Graceful shutdown handler (10s fallback) | `server/index.ts:588-611` | 24 |
| Auth gate (bearer token) | `server/index.ts:534-538` | 5 |
| Production error scrubbing | `server/index.ts:550-554` | 5 |

**Vivim-Final Comparison:** vivim-final has a `config.ts` auth gate but no backup, crash reports, portfile, or graceful shutdown with checkpoint. **High-value quick wins.**

---

### Finding 8: Delta Pipeline + State Mirror
**Files:** `src/state/delta-pipeline.ts`, `src/state/accumulator.ts`, `src/state/events.ts`

- In-memory state accumulator (mirrors DB state for fast frontend recovery)
- Delta JSONL logging to disk for replay
- Ingestion endpoint (`POST /api/ingest`) for CLI-batched deltas
- Snapshot endpoint (`GET /api/snapshot`) for frontend reconnection
- Bridge from local events.ts → WebSocket pipeline
- Sequence-numbered, causal ordering

**Vivim-Final Comparison:** vivim-final has no delta pipeline or state mirror. **New architecture decision needed** — useful for the frontend but not required for Phase 22.

---

### Finding 9: Autonomous Loops (3)
**File:** `src/health/loop.ts`

- **Health check loop** (5s default) — probes Chrome PIDs + CDP, classifies ok/zombie/crashed, emits deltas
- **Drift detection loop** (60s default) — runs drift monitor scan, emits drift events
- **Startup recovery** — restores sessions from checkpoint, marks cold profiles, cancels stale routes

**Vivim-Final Comparison:** No health/drift/cron loops. **Port:** `loop.ts` + `probe.ts` + `fail-counter.ts` as optional engines.

---

### Finding 10: Data Migration Engine (CapStore → Mirror)
**File:** `src/migrate/index.ts` (639 LOC)

- Reads capabilit-lab's flat JSON files (globals, actions, outcomes, patterns, holes, observations)
- Normalizes into cap-store schema with deterministic IDs for idempotent re-runs
- 7 data sources, each with configurable window
- Per-source migration log (records read/written/skipped + skip reasons)
- Dry-run mode

**Vivim-Final Comparison:** Not directly applicable (vivim-final uses Prisma seeds, not mirror migration). **Pattern note:** The deterministic ID generation + migration log pattern is well-designed.

---

### Finding 11: Schema Organization (12 Files)
**Directory:** `src/schema/`

```
core.ts        — TaxonomyGlobal, ProviderBinding, ActionProgram, Hole, Endpoint, RepairPattern, Outcome
provider.ts    — Provider, SelectorStrategy, LearningEvent, Rule
learning.ts    — BindingEvent, FailureClassification
transfer.ts    — TransferPattern, TransferCandidate, TransferAttempt
chrome.ts      — ChromeProfile
routing.ts     — RouteRequest, RouteTarget, RouteEvent
session.ts     — VivimSession, ProviderSession, ProfileSession, Conversation, StateTransition
automation.ts  — AlertCondition, AlertEvent, AutomationRun, AutomationSchedule, DiscoveryObjective
streaming.ts   — Stream event types
types.ts       — Barrel re-export
validators.ts  — Zod schemas (DispatchRequestSchema, etc.)
```

**Vivim-Final Comparison:** vivim-final's `src/schema/` is organized differently (per-engine Zod schemas + Prisma types). The cap-store pattern of separating core domain model from provider/session specifics is cleaner.

---

### Finding 12: Error Typing + HTTP Mapping
**File:** `src/errors.ts` (77 LOC)

```
CapStoreError (base)
├── NotFoundError       → 404
├── ValidationError     → 400
├── ConflictError       → 409
├── MigrationError      → 422
├── StorageError        → 500
└── InternalError       → 500
```

- `toJSON()` — serializable error payload
- `toHttpStatus()` — bijection to HTTP status codes
- `details` field for structured metadata

**Vivim-Final Comparison:** vivim-final's `src/errors.ts` has a similar but less mature hierarchy. **Port the HTTP mapping pattern.**

---

## 3. Data Flow

```
User/Agent
  │
  ├─ CLI (cap-store serve) ───────────────────┐
  ├─ HTTP (REST API)                           │
  └─ WebSocket (delta stream)                  │
       │                                       │
       ▼                                       │
  src/server/index.ts                          │
       │                                       │
       ├── Health → src/health/loop.ts         │
       ├── Dispatch → src/router/index.ts      │
       ├── Execute → src/executor/index.ts     │
       │               │                       │
       │               ├── Fleet Supervisor    │
       │               ├── CDP Client          │
       │               ├── Recipe Runner       │
       │               └── Stream Capture      │
       │                                       │
       ├── v0.2 Batch Delegates ───────────────┤
       │   (batch1..batch11)                   │
       │                                       │
       └── src/storage/db.ts ──────────────────┘
               │
               ▼
        bun:sqlite (capability-store.db)
        + 41 migration files
```

---

## 4. Files by Category

| Category | Files | LOC (est) | Key File |
|----------|-------|-----------|----------|
| Schema | 12 | ~600 | `core.ts`, `provider.ts` |
| Storage | 14 | ~2500 | `db.ts` (the big one) |
| Executor | 21 | ~3000 | `cdp.ts` (621), `recipe.ts` (441), `fleet-supervisor.ts` (581) |
| Server | 15 | ~1200 | `index.ts` (672) |
| State | 14 | ~800 | `delta-pipeline.ts`, `accumulator.ts` |
| CLI | 16 | ~1000 | `index.ts`, `repl.ts`, `chat.ts` |
| Health | 7 | ~500 | `loop.ts`, `probe.ts`, `startup-recovery.ts` |
| Alerting | 6 | ~400 | `alerter.ts`, `dedup.ts` |
| Conf/Lifecycle | 3 | ~350 | `confidence.ts`, `lifecycle/index.ts`, `drift.ts` |
| Router | 9 | ~400 | `index.ts`, `executor.ts` |
| Misc | 8 | ~400 | `errors.ts`, `ids.ts`, `config.ts`, `patterns.ts`, `verify.ts` |
| **Total** | **~125** | **~11500** | |

---

## 5. Comparison: Cap-Store vs Capabilit-Lab vs Vivim-Final

| Feature | Cap-Store | Capabilit-Lab | Vivim-Final |
|---------|-----------|---------------|-------------|
| Runtime | Bun + bun:sqlite | Bun + file JSON | Bun + Prisma/PostgreSQL |
| Taxonomy (L0) | Full CRUD | File-based JSON | Prisma model |
| ProviderBinding (L1) | Full CRUD + confidence + promotions | File-based JSON | Prisma model (no confidence) |
| ActionProgram (L2) | Full CRUD | File-based JSON | Prisma model |
| Confidence Scoring | ✓ weighted formula + tier | ✓ basic | ✗ **missing** |
| Lifecycle Ladder | ✓ 7-state + timeout guard | ✓ basic | ✗ **missing** |
| Drift Detection | ✓ monitor + severity | ✗ | ✗ **missing** |
| CDP Client | ✓ Bun WebSocket | ✓ full-featured | ✓ ChromeGovernor |
| Fleet Management | ✓ Supervisor + breaker | ✓ basic | ✓ ChromeGovernor |
| Stream Parsing | ✓ per-provider parsers | ✓ per-provider | ✓ seed parsers |
| Migration Engine | ✓ mirror data migrator | N/A | ✓ Prisma migrations |
| HTTP Server | ✓ Bun.serve (672 LOC) | N/A | ✓ Bun.serve |
| WebSocket | ✓ client broadcast | N/A | ✓ event bus bridge |
| CLI | ✓ full interactive REPL | N/A | CLI planned |
| Health Loops | ✓ 3 autonomous loops | N/A | ✗ **missing** |
| Alerting | ✓ Alerter + dedup + webhook | N/A | ✗ **missing** |
| Crash Reports | ✓ JSON crash dumps | N/A | ✗ **missing** |
| Production Hardening | ✓ backup, portfile, auth, shutdown | N/A | Partial (auth only) |
| Test Coverage | ~17% | ~50% | ~35% |
| MCP Server | ✗ **missing** | ✗ | Planned (Phase 22) |

---

## 6. Quick Win Implementation Plan (Priority Order)

### Tier 1: High Value, Low Effort (< 200 LOC each)
1. **Port confidence scoring** — `src/engines/confidence-engine.ts` — pure function, no deps
2. **Port lifecycle ladder** — `src/engines/lifecycle-ladder.ts` — pure function, no deps
3. **Port error HTTP mapping** — extend `src/errors.ts` with `toHttpStatus()`
4. **Port drift detection** — `src/engines/drift-detector.ts` — pure function
5. **Add pre-migration backup** to Prisma migration workflow
6. **Add crash report handler** to server entry point

### Tier 2: Medium Value, Medium Effort (200–500 LOC each)
7. **Port health check loop** — `src/engines/health-loop.ts` — needs ChromeGovernor integration
8. **Port drift detection loop** — wraps drift detector with cron
9. **Port per-provider parsers** — extend `StreamParserEngine` with stream detector config
10. **Add production hardening** — portfile, graceful shutdown, auth gate hardening

### Tier 3: Architecture Decision Required
11. **Delta pipeline + state mirror** — useful for frontend, needs ADR
12. **Alerting subsystem** — depends on alert condition model in Prisma
13. **Chrome Fleet Supervisor** — different abstraction from ChromeGovernor; needs architectural decision

---

## 7. Gaps vs Vivim-Final Requirements

| Cap-Store Feature | Missing in Vivim-Final | Critical for Phase 22? |
|-------------------|----------------------|----------------------|
| Confidence scoring | ❌ | Yes — MCP tools need confidence for manifest inference |
| Lifecycle promotion | ❌ | Yes — MCP tools promote bindings through test ladder |
| Drift detection | ❌ | No — Phase 22 focus is discovery, not monitoring |
| Health loops | ❌ | No — Phase 22 is agent-driven, not server-persistent |
| Crash reports | ❌ | No — nice-to-have |
| Pre-migration backup | ❌ | No — Prisma already has migration safety |
| Per-provider parsers | Partial | Yes — MCP tools can inspect streams in real-time |
| Error HTTP mapping | Partial | Yes — improves MCP error responses |

**Phase 22 must-haves from cap-store:** Confidence scoring, lifecycle promotion, per-provider parser configs.

---

## 8. Architectural Recommendations

1. **Model confidence + lifecycle as pure functions** — they have zero dependencies on bun:sqlite or the storage layer, making them trivially portable to Prisma-based vivim-final

2. **Adopt the `DriftMonitor` interface pattern** — clean separation of scan vs list vs resolve concerns

3. **Adopt the migration-log pattern** — record what was read/written/skipped for every data migration

4. **Do NOT adopt the batch v02 routing pattern** — lazy dynamic imports with 11 batch files is fragile. vivim-final's explicit route registration is cleaner.

5. **Do NOT adopt bun:sqlite for discovery sessions** — Phase 22 uses existing Prisma tables; raw SQLite would bypass invariants

6. **The per-provider stream detector config** should be merged into vivim-final's existing seed manifest system (`seeds/providers/*.json`) rather than creating a separate config map

---

## 9. Key Files Referenced

| File | Description |
|------|-------------|
| `src/confidence.ts` | Multi-factor confidence formula (PRIORITY PORT) |
| `src/lifecycle/index.ts` | 7-state promotion ladder + timeout guard (PRIORITY PORT) |
| `src/drift.ts` | Success-rate drift monitor |
| `src/patterns.ts` | PatternStore contract + impl |
| `src/verify.ts` | Pattern verification gate |
| `src/errors.ts` | Typed error hierarchy with HTTP mapping |
| `src/ids.ts` | Prefix-based ID derivation pattern |
| `src/config.ts` | Env-driven config pattern |
| `src/schema/core.ts` | 3-layer taxonomy model definition |
| `src/storage/db.ts` | Core storage layer (bun:sqlite) |
| `src/server/index.ts` | Full production server (672 LOC pattern) |
| `src/executor/index.ts` | executeBinding main entry point |
| `src/executor/cdp.ts` | Bun WebSocket CDP client (621 LOC) |
| `src/executor/recipe.ts` | Step-by-step action recipe runner (441 LOC) |
| `src/executor/fleet-supervisor.ts` | Fleet state machine + circuit breaker (581 LOC) |
| `src/executor/parsers.ts` | SSE parser + provider delta extractors |
| `src/executor/stream-detector.ts` | Per-provider completion detector |
| `src/executor/stream-capture.ts` | Self-contained streaming capture |
| `src/executor/turn-executor.ts` | Single conversation turn execution |
| `src/health/loop.ts` | Autonomous health/drift loops |
| `src/health/startup-recovery.ts` | Session recovery on boot |
| `src/state/delta-pipeline.ts` | Event-sourced state synchronization |
| `src/migrate/index.ts` | Mirror data migration engine (639 LOC) |
| `src/alerting/alerter.ts` | Alert evaluation + dispatch |
| `src/automation/scheduler.ts` | Cron-style task scheduler |
| `package.json` | Deps: zod + opencode-ai only |
| `tsconfig.json` | Bun + ESNext strict |
| `migrations/*.sql` | 41 sequential SQL migration files |

---

**Summary:** The cap-store is the most production-ready of the three vivim-org codebases (vs capabilit-lab, vs backend). It has 31 features/patterns worth porting, of which ~6 are high-priority for Phase 22 (confidence, lifecycle, per-provider parsers, error mapping, drift detection, pattern store).
