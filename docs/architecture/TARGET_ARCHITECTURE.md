---
title: Target Architecture
status: forensic-evidence (uncommitted)
companion_to: REPOSITORY_FORENSIC_AUDIT.md, SOTA_GAP_ANALYSIS.md
date: 2026-08-26
author: forensic investigation (opencode/text-prime)
related: ARCHITECTURAL_DECISIONS.md, ARCHITECTURAL_ERAS.md
---

# Target Architecture

This document defines the target architecture for vivim-final, derived from the forensic audit (`REPOSITORY_FORENSIC_AUDIT.md`), the reconstructed architectural decisions (`ARCHITECTURAL_DECISIONS.md`), the SOTA gap analysis (`SOTA_GAP_ANALYSIS.md`), and the identified architectural problems (`SOTA_IDENTIFICATION.md`).

The target architecture is NOT a complete rewrite. It is a refined, verified, and documented version of the current architecture, with specific improvements drawn from the gap analysis.

---

## 1. System Identity

Vivim-final is a **local-first AI conversation platform** that connects to external LLM providers via Chrome DevTools Protocol (CDP) and exposes capabilities through a unified registry (`UnifiedCapability` / `CapabilityEngine`). It runs as:

- A **Bun backend** (API, engines, storage, provider control).
- A **React/Next.js frontend** (UI, canvas, chat surface).
- A **Tauri V2 desktop shell** (sidecar supervisor, bundled binary).

The architecture is strictly linear (no divergent branches), healthy (`git fsck` reports only 2 benign dangling objects), and based on the verified `v0.1.0` (`77c332c`) baseline.

---

## 2. Architectural Boundaries

Every boundary below answers: **Why should this be a boundary?**

### 2.1 ChromeGovernor / CDP Boundary (Governor Canon)

**Boundary**: Only `ChromeGovernor` (`src/engines/chrome-governor.ts`) touches `BunCdpClient` / CDP.

**Why**: CDP sessions are expensive (browser process, memory, connection overhead). Centralizing access prevents resource conflicts (multiple engines opening separate sessions to the same browser instance) and ensures a consistent provider lifecycle (setup, navigation, capture, teardown). It simplifies the mental model for provider setup and enables the system to enforce singleton profiles per (provider, account) (ProfileAllocator invariant).

**Evidence**: Invariant 1 (`AGENTS.md`), `ARCHITECTURAL_DECISIONS.md` Decision 5 (`b23813f` / `e1952fc`), `REPOSITORY_FORENSIC_AUDIT.md` Era 3.

### 2.2 Capability Registry / Single Entry Point (UnifiedCapability)

**Boundary**: All system behavior is expressed as `UnifiedCapability` rows in the DB (`CapabilityBinding` / `CapabilitySnapshot`), bound to NL patterns (`catalog.ts`), and executed via `/api/interpret` → `/api/capabilities/:id/execute`.

**Why**: The capability registry eliminates surface fragmentation (CLI vs UI vs API vs MCP). It ensures that any new feature appears consistently everywhere, reducing cognitive load and duplication. It enables the `devops verify-cross-surface` script to validate parity automatically.

**Evidence**: Invariant 11 (`AGENTS.md`), `ARCHITECTURAL_DECISIONS.md` Decision 2 (`39bb583` / `5277ba1`), `SOTA_IDENTIFICATION.md` Problem 4.

### 2.3 DB Split Boundary (System / User)

**Boundary**: System metadata (`prisma/system/`) and user data (`prisma/user/`) live in separate SQLite DBs, accessed via separate PrismaClient singletons (`SYSTEM_DATABASE_URL` / `USER_DATABASE_URL`).

**Why**: The split enforces data ownership separation: framework-managed data (providers, capabilities, routing, telemetry, config) must not be accidentally corrupted by user operations (deleting conversations, modifying nodes, etc.). It prevents the reverse-tenant issue (user deletes their data and wipes the system registry). It allows different backup, migration, and access policies for each database.

**Evidence**: `ARCHITECTURAL_DECISIONS.md` Decision 3 (`24576ce`), `SOTA_GAP_ANALYSIS.md` Problem 5, `REPOSITORY_FORENSIC_AUDIT.md` §7.5.

### 2.4 Cross-Boundary Storage Layer

**Boundary**: Engine code that touches user data must declare the boundary via the `cross-boundary` storage layer (`src/storage/snapshot.ts`, `cross-boundary-cache.ts`, `db-health.ts`).

**Why**: The dual-DB split requires an explicit contract. Without it, an engine could accidentally write system data through the user DB client (or vice versa), violating the boundary invariant. The storage layer provides `readUserData()` / `readSystemData()` helpers and cross-boundary snapshot functions that enforce the contract at the code level.

**Evidence**: `ARCHITECTURAL_DECISIONS.md` Decision 3, `SOTA_GAP_ANALYSIS.md` Problem 5, `REPOSITORY_FORENSIC_AUDIT.md` §7.5.

### 2.5 Seeds-as-Truth / DB-Only Parser Logic

**Boundary**: The `seeds/` directory is the second source of truth (after code). Parser logic lives only in the DB (`parser_logic_code` with `logic_type=inline`). File-based parsers are rejected (`allowFileLogic` must be explicitly enabled). The `StreamParserEngine` loads parser logic from the DB, not from files.

**Why**: This prevents drift between the DB state and the file system. It ensures that parser updates are auditable (they are DB changes with version history) and that the DB can be reconstructed from seeds (`bun run devops ... reseed`). It supports the seeds-as-truth invariant (Invariant 4) and the parser logic invariant (Invariant 6).

**Evidence**: `ARCHITECTURAL_DECISIONS.md` Decision 4, `REPOSITORY_FORENSIC_AUDIT.md` §5, `AGENTS.md` Invariant 4 / 6.

### 2.6 Provider Protocol Generation (Static Protocol from DB)

**Boundary**: `bun run gen:protocol` reads the capability + seed runtime from the DB and produces `__generated__/provider-protocol.ts`. The hot loop reads this static file rather than querying the DB directly.

**Why**: The DB is the source of truth, but the hot loop (capability resolution, provider selection, parser fallback) must be fast. The static protocol allows the engine to resolve capabilities and select parsers without DB latency, improving performance. It also decouples the hot loop from the DB lifecycle, making the system more resilient to DB failures.

**Evidence**: `ARCHITECTURAL_DECISIONS.md` Decision 8, `SOTA_IDENTIFICATION.md` Problem 8, `REPOSITORY_FORENSIC_AUDIT.md` §7.4 (generated client hygiene, now untracked).

### 2.7 Harness Command Registry / Repair Engine

**Boundary**: The harness executor (`HarnessRuntime`) uses `StreamParserEngine.parse()` (full parser chain with fallback) to parse provider responses. Block metadata (`parserName`, `confidence`, `wireFormat`) is persisted as `blockMeta` JSON. The harness repair engine (`HarnessRepairEngine`) fixes LLM payload defects via versioned command schemas (`HarnessCommand` table) and repair helpers.

**Why**: The harness provides a declarative, DB-driven protocol for browser actions. It separates the protocol definition (seeds + DB) from the execution (engines). The repair engine ensures robustness against LLM output defects, which is critical for automated browser interaction.

**Evidence**: `ARCHITECTURAL_DECISIONS.md` Decision 6, `SOTA_IDENTIFICATION.md` Problem 9, `AGENTS.md` §13 (Harness Executor, DB-Driven Protocol).

### 2.8 Tauri V2 Desktop / Bun Sidecar

**Boundary**: The desktop binary (`vivim-desktop.exe`) is the Tauri V2 host; it supervises the Bun backend (`vivim-server-x86_64-pc-windows-msvc.exe`) via WebSocket over loopback. The Bun backend runs the API, engines, DB, and CDP slaves. The desktop layer provides the user-facing window, menu, and system tray.

**Why**: The desktop layer allows the system to be distributed as a native executable (NSIS installer) rather than a script. The sidecar pattern isolates the backend from the frontend, allowing independent updates. UPX compression (`-3 --no-lzma`) reduces the binary footprint from ~97 MB (uncompressed) to ~45.6 MB (compressed).

**Evidence**: `ARCHITECTURAL_DECISIONS.md` Decision 7, `REPOSITORY_FORENSIC_AUDIT.md` §280 (Desktop DevOps CLI), `AGENTS.md` §4 (Desktop Build Testing, Tauri V2 Config).

---

## 3. System Boundaries (Visual)

```
[User / Operator]
        |
        v
[Tauri V2 Desktop Shell]  (window, menu, system tray)
        |  (WebSocket / Loopback RPC)
        v
[Bun Sidecar]  (vivim-server-*.exe, compiled, UPX compressed)
        |  (API / HTTP / WS port 9420/9421)
        v
[API Layer]  (Next.js / Express / OpenAPI)
        |  (Single Entry Point: /api/interpret -> /api/capabilities/:id/execute)
        v
[Capability Registry]  (DB + NLCL + Catalog)
        |  (Capability ID resolution, Parser Fallback Chain)
        v
[ChromeGovernor]  (Only entity that touches CDP)
        |  (CDP session: setup, navigate, capture, parse, teardown)
        v
[Chrome CDP Slave]  (Logged-in provider profile)
        |  (Live provider UI surface: ChatGPT, Claude, Gemini, DeepSeek, Qwen, Grok)
        v
[Stream Parser]  (DB-only logic: inline logic_code, fallback chain: provider -> generic -> system)
        |  (Parse wire format -> ContentBlock[] -> BlockMeta: parserName, confidence, wireFormat)
        v
[Node Graph Storage]  (Dual SQLite: system DB / user DB, cross-boundary layer)
        |  (System: providers, capabilities, routing, telemetry, health, config)
        |  (User: conversations, nodes, memory, sessions, FSRS-6 schedules)
        v
[Memory / FSRS-6]  (Spaced repetition scheduling on user DB)
        |  (Emit cap-store.memory Nodes, update FSRS state, preserve version chain)
        v
[Seeds / DB Truth]  (Reconstruct DB from seeds: providers, parsers, capabilities, taxonomy)
```

Every arrow above represents an architectural boundary with a justification (see §2). The system is designed so that the user never needs to know about the internal layers: the desktop shell, the Bun sidecar, the capability registry, and the Chrome slaves are all invisible to the user. The user interacts with the desktop window (or CLI / API / MCP) and sees only the unified capability surface.

---

## 4. Security and Trust Boundaries

The architecture defines the following trust boundaries:

### 4.1 User → Desktop Shell
- **Boundary**: The desktop shell is a native executable (`vivim-desktop.exe`). It is installed via an NSIS installer (silent `/S` mode). The shell runs with user privileges.
- **Security**: The desktop layer uses CSP (`unsafe-eval`, `unsafe-inline`) for the Next.js static export. The updater is disabled (`tauri.conf.json`). No external update mechanism exists.
- **SOTA reference**: MCP spec §Security (user consent, data privacy, tool safety) applies to any user-facing interface; the desktop layer must ensure that user data is protected and that the user understands what actions are being taken.

### 4.2 Desktop Shell → Bun Sidecar
- **Boundary**: WebSocket over loopback (`localhost`). No external network access for the sidecar (except through the provider profiles, which are isolated Chrome CDP slaves).
- **Security**: The sidecar does not expose its API to external clients. It listens only on the loopback interface (port `9420`). The desktop toolkit verifies that the port owner PID matches the launched process (`pollReady()` in `devops/desktop/verify.ts`).
- **SOTA reference**: Playwright `CDPSession` event monitoring (`session.on('event')`) can detect unexpected events; the sidecar should use similar monitoring for security.

### 4.3 Bun Sidecar → API Layer
- **Boundary**: HTTP/WebSocket (`port 9420`). The API layer (`src/server/index.ts`) serves the OpenAPI spec and the capability execution endpoints.
- **Security**: The API uses Zod validation for input schemas (Era 7 security hardening). All capability execution requires a valid capability ID (no arbitrary code execution). The `ExecutionKernel` is optional (`VIVIM_EXECUTION_KERNEL` flag) and does not bypass the registry.
- **SOTA reference**: MCP spec §Security (explicit consent before invoking any tool) aligns with the capability execution model: the user must authorize actions through the NLCL or UI.

### 4.4 API Layer → ChromeGovernor
- **Boundary**: The Governor (`chrome-governor.ts`) is the only engine that imports `BunCdpClient`. No other engine may access CDP directly.
- **Security**: The ProviderRegistrar (`provider-registrar.ts`) enforces singleton profiles per (provider, account). The ProfileAllocator (`profile-allocator.ts`) checks cookie files (`Default/Network/Cookies` or `Profile N/Network/Cookies`) to determine authentication state. The `Relogin Ready` invariant (AGENTS.md §10) requires the agent to detect session expiry via `isAuthenticated()` and to suggest relogin to the user.
- **SOTA reference**: Playwright `CDPSession.detach()` provides clean session teardown; the Governor should implement automatic session cleanup on provider failure or timeout.

### 4.5 Chrome CDP Slave → Provider UI Surface
- **Boundary**: The Chrome slave (logged-in provider profile) is isolated from the user's local files. It operates in its own Chrome profile directory (`chrome-profiles/<providerSlug>/<accountId>/`).
- **Security**: The profile directory holds cookies, local storage, and session data. The profile is the source of truth for authentication (`ProfileAllocator.isAuthenticated()` checks cookie files). The profile does not share cookies with other providers or with the user's main browser.
- **SOTA reference**: Local-first architecture (local-first manifesto) requires that user data remains under the user's control; the isolated profile ensures that provider session data does not leak to other parts of the system.

---

## 5. Data Flow

### 5.1 User Interaction Flow

```
User (Desktop Shell or CLI/API/MCP)
  → NL Shell (catalog.ts / command-registry.ts)
  → /api/interpret (Capability Resolution)
  → Capability Registry (DB + Snapshot)
  → Capability Execution (CapabilityEngine)
  → ChromeGovernor (if provider action requires CDP)
    → Chrome CDP Slave (provider profile)
    → Provider UI Surface
  → Stream Parser (wire format → ContentBlock[])
  → Node Capture (conversation-manager.ts → captureAsNode())
  → Node Storage (user DB)
  → Memory/FSRS Update (memory-engine.ts → recordMemory())
  → Response (stream or block)
  → Frontend Render (UI slot system)
```

Every step in this flow is mediated by a registered `UnifiedCapability`. No engine may bypass the registry (`ARCHITECTURAL_DECISIONS.md` Decision 2). No engine may access the user DB without declaring the cross-boundary (`ARCHITECTURAL_DECISIONS.md` Decision 5).

### 5.2 Data Ownership Flow

```
Seeds (seeds/ directory)
  → DB Initialization (seed scripts: providers, parsers, capabilities, taxonomy, harness commands)
  → System DB (system/schema.prisma: providers, capabilities, routing, telemetry, health, config)
  → User DB (user/schema.prisma: conversations, nodes, memory, sessions)
```

The seeds are the second source of truth (`ARCHITECTURAL_DECISIONS.md` Decision 4). The DB is reconstructed from seeds via the seed scripts (`src/storage/seeds.ts`, `capability-bootstrap.ts`). The seeds must be idempotent: running them multiple times produces the same DB state (`ARCHITECTURAL_ERAS.md` Era 5, `ARCHITECTURAL_DECISIONS.md` §Assumptions).

---

## 6. State Flow

### 6.1 Conversation State

- **Live state**: The conversation exists in the `ConversationManager` (`conversation-manager.ts`) as a session object, with the current message stream (`StreamBlockStore`) and the active provider session (`ProfileAllocator`).
- **Persisted state**: Each message is captured as a `Node` (`captureAsNode()`), linked via `NodeEdge` (`responds_to`), with a `contentHash`, `version`, and `securityLevel`. The conversation is rebuilt from nodes (`rebuildGraphFromNodes()`).
- **Version chain**: Every mutation to a message creates a new `NodeVersion`. The version history allows time-travel (`getNodeAtVersion()`) and rollback.

### 6.2 Memory State

- **Memory emission**: `recordMemory()` in the MemoryEngine emits a `cap-store.memory` Node with FSRS-6 initial state (ease factor, previous interval, recall quality).
- **FSRS scheduling**: The FSRS-6 algorithm determines the next review interval. The schedule is stored in the user DB and updated when the user reviews the memory.
- **Version preservation**: The FSRS state is preserved through the version chain. If a memory is edited, its FSRS state is carried forward (or reset, depending on the edit type).

### 6.3 Provider Session State

- **Profile allocation**: `ProfileAllocator` ensures one profile per (provider, account) (`ARCHITECTURAL_DECISIONS.md` §Decision 1). The profile directory (`chrome-profiles/<providerSlug>/<accountId>/`) is the source of truth for authentication.
- **Session lifecycle**: The ChromeGovernor manages the session: launch (lazy), navigate, capture, parse, teardown (`stop` command or session timeout). The session is cleaned up on provider failure (`ARCHITECTURAL_DECISIONS.md` §Decision 5).

---

## 7. Persistence Model

### 7.1 System DB (`prisma/system/`)

- **Schema**: `prisma/system/schema.prisma` (+2047 lines at `24576ce`).
- **Tables**: Providers, capabilities, routing rules, telemetry events, health probes, config parameters.
- **Access**: Read-only at runtime (system DB is not modified by user actions). Modifications occur only via seed scripts or the harness command registry.
- **Migration**: The system DB uses the `migrations/` directory (`0001_init`, `0002_agentic_backbone`, `20260805223404_wp10_upgrade`).

### 7.2 User DB (`prisma/user/`)

- **Schema**: `prisma/user/schema.prisma` (+1706 lines at `24576ce`).
- **Tables**: Conversations, nodes, memory (FSRS-6), sessions, user settings.
- **Access**: Mutable at runtime. All user actions (send, edit, delete, review memory) modify this DB.
- **Migration**: The user DB uses the same migration mechanism but requires separate migration scripts.

### 7.3 Cross-Boundary Storage Layer

- **Functions**: `crossBoundarySnapshot()`, `readUserData()`, `readSystemData()`, `getStats()`.
- **Contract**: Any engine that writes user data must declare the boundary (`ARCHITECTURAL_DECISIONS.md` §Decision 5). The layer provides a `snap()` function that captures the state of both DBs at a point in time.
- **Cache**: The `cross-boundary-cache` (`cross-boundary-cache.ts`) caches read results to reduce cross-DB query overhead.

---

## 8. Concurrency Model

### 8.1 ChromeGovernor Session Isolation

- **Singleton session**: The ChromeGovernor manages a single active session per provider profile. Multiple concurrent actions on the same provider are serialized through the session (to prevent DOM conflicts).
- **Lazy startup**: Chrome slaves launch only when needed (`ProfileAllocator.isAuthenticated()` checks cookie files). The session is cleaned up on `stop` or timeout.
- **Auto-restart**: The session can be restarted (kill + relaunch) if the health probe (`health.ts`) detects failure (e.g., session timeout, page crash). The auto-restart is a planned enhancement (`SOTA_GAP_ANALYSIS.md` Problem 2) but not fully implemented.

### 8.2 Capability Execution

- **Sequential execution**: The capability registry executes capabilities sequentially (one at a time) through the `CapabilityEngine`. There is no parallel execution of capabilities on the same provider session.
- **Parallel engine operations**: The harness engine (`HarnessRuntime`) supports parallel and branch execution (`ARCHITECTURAL_ERAS.md` §Era 2), but these are for internal workflow steps, not concurrent provider interactions.

---

## 9. Error Handling

### 9.1 LLM Payload Repair

- **Repair engine**: The `HarnessRepairEngine` (`ARCHITECTURAL_DECISIONS.md` §Decision 6) fixes common LLM payload defects: missing commas, extra code fences, incorrect quoting, deprecated field names.
- **Alias remapping**: `repairString({aliases})` maps deprecated field names to current names (e.g., `name` → `title`).
- **Feedback coordination**: The `HarnessFeedbackCoordinator` escalates retry prompts with exponential backoff (`backoff + diff`) and never repeats the same prompt twice. The `RepairSession` table tracks repair attempts.

### 9.2 Session Failure

- **Health probes**: The `db-health.ts` and `health.ts` modules provide runtime health checks (`readyz`, `health`). The desktop toolkit (`devops/desktop/`) polls these endpoints (`pollReady()`).
- **Failure detection**: The ChromeGovernor detects session failure via `CDPSession.on('close')` (planned enhancement; not fully implemented). The `provider-health-kernel` (`ARCHITECTURAL_ERAS.md` §Era 1) monitors provider health.
- **Graceful degradation**: If Chrome is unavailable, the system should fall back to API-mode (use provider REST API instead of CDP-based UI automation). This graceful degradation is planned but not fully implemented.

---

## 10. Security Boundaries

### 10.1 User Consent

- **Consent engine**: The `consent-engine.ts` manages user consent for data access and actions. The MCP spec (§Security) requires explicit consent before invoking any tool.
- **Capability authorization**: The `CapabilityEngine` requires a valid capability ID; no arbitrary code execution is allowed.

### 10.2 Data Privacy

- **DB split isolation**: The system/user DB split prevents user data from corrupting system metadata (`ARCHITECTURAL_DECISIONS.md` §Decision 3).
- **Profile isolation**: Each provider account uses a separate Chrome profile (`ProfileAllocator` invariant: singleton profile per (provider, account)). Profiles do not share cookies or local storage.
- **Cross-boundary contract**: The storage layer ensures that user DB writes do not leak to the system DB and vice versa.

### 10.3 Tool Safety

- **Parser validation**: The `StreamParserEngine` validates parser logic against the DB (`parser_logic_code` must be `inline`). File-based parsers are rejected (`ARCHITECTURAL_DECISIONS.md` §Decision 4).
- **Capability execution**: The `ExecutionKernel` (optional) executes capabilities but does not bypass the registry (`ARCHITECTURAL_DECISIONS.md` §Decision 2).

---

## 11. Extension Mechanisms

### 11.1 Capability Extension

- **Registration**: New capabilities are registered via `makeCapability()` or `registerSessionCaps()` (see `ARCHITECTURAL_DECISIONS.md` §Decision 2). The `registerDefaultCapabilities()` function in `src/engines/*caps.ts` provides default capabilities.
- **Catalog binding**: NL patterns (`catalog.ts`) bind phrases to capability IDs. Adding a new capability requires adding the NL patterns and updating the DB.

### 11.2 Provider Extension

- **Manifest registration**: New providers are added via `seeds/providers/manifests.ts`. The manifest declares selectors, endpoints, parsers, and models.
- **Parser registration**: Parser logic is stored in `seeds/parsers/harvested/*.ts` and upserted into the DB via `seeds/parsers/harvest.seed.ts`.
- **Protocol generation**: `bun run gen:protocol` regenerates `__generated__/provider-protocol.ts` from the DB.

### 11.3 Harness Extension

- **Command registry**: New harness commands are added via `seeds/harness/commands.json` and seeded via `seedHarnessCommands()`.
- **Schema versioning**: Each `HarnessCommand` row has a `version` (semver) and a JSON schema. Schema evolution requires a new version and a migration step.

---

## 12. Observability

### 12.1 Telemetry

- **Telemetry aggregator**: The `TelemetryAggregator` (`ARCHITECTURAL_ERAS.md` §Era 2) collects event-driven telemetry from the system.
- **Health probes**: The `db-health.ts` and `health.ts` modules provide `readyz` and `health` endpoints.
- **Performance metrics**: The `CostOptimizer` (`ARCHITECTURAL_ERAS.md` §Era 3) optimizes provider economics; the `TelemetryAggregator` tracks usage.

### 12.2 Audit Trail

- **Audit events**: The `AuditTrail` (`ARCHITECTURAL_ERAS.md` §Era 3) records significant actions (capability executions, provider registrations, memory emissions, etc.).
- **Repair audit**: The `RepairSession` table records harness repair attempts (commit, payload, fix applied, success/failure).

---

## 13. Testing Strategy

### 13.1 Characterization Tests

- **Baseline characterization**: Before major migrations, establish that the `v0.1.0` (`77c332c`) baseline behaves as documented (e.g., 341 engine files, 2,088 tracked files, 1 SQLite schema, 10,661 initial lines). These tests establish the "observed behavior" for future comparison.
- **Current behavior**: The same characterization should be applied to the current HEAD (`fe1c220` or the latest master) to measure the delta.

### 13.2 Unit Tests

- **Engine tests**: Each engine (e.g., `StreamParserEngine`, `CapabilityEngine`, `MemoryEngine`) has unit tests with mocked store contracts.
- **Parser tests**: `tests/unit/engines/harvested-parser.test.ts` verifies that each parser (Claude, ChatGPT, Gemini, DeepSeek) parses its wire format correctly and that the fallback chain resolves correctly.
- **Repair tests**: `tests/unit/engines/harness-repair-engine.test.ts` verifies the repair helpers (`repairString`, `repairNumber`, `repairBoolean`) and the feedback coordinator.

### 13.3 Integration Tests

- **Engine interaction**: Tests that verify engine-to-engine interactions (e.g., `CapabilityEngine` → `StreamParserEngine` → `NodeGraphStorage`).
- **Cross-boundary tests**: Tests that verify that the storage layer enforces the boundary contract (e.g., a user DB write does not modify the system DB).
- **Desktop integration**: The `devops desktop` toolkit (`devops/desktop/`) provides smoke tests (`test smoke`) that verify process startup, `readyz` response, window creation, and screenshot capture.

### 13.4 E2E Tests

- **Provider onboarding**: The 8-phase onboarding pipeline (`discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge`) validates that a new provider works end-to-end.
- **Cross-surface parity**: `devops verify-cross-surface` validates CLI/API/MCP/UI parity for capabilities.

---

## 14. Deployment / Runtime Model

### 14.1 Development Environment

- **Backend**: `bun run dev` (starts backend on port 9420, kills stale processes, cleans `.runtime/`).
- **Frontend**: `bun run dev:frontend` (starts Next.js on port 3000).
- **Full stack**: `bun run dev` starts both in one process.
- **Cleanup**: `bun run stop` kills orphaned processes on ports 9420/3000 and cleans `.runtime/`.

### 14.2 Desktop Deployment

- **Build script**: `pwsh scripts/tauri/build.ps1` (full pipeline: sidecar + frontend static export + Tauri build + NSIS installer).
- **Sidecar build**: `pwsh scripts/tauri/build-sidecar.ps1` (Bun compile + UPX compression).
- **Version management**: `scripts/tauri/version.ts` reads `tauri.conf.json` + `Cargo.toml` and updates both.
- **Desktop toolkit**: `bun run devops desktop-loop run --version <v>` runs the 5-gate pipeline (Build → Install → Launch+Render → Capture → Report) with hash-gated rebuild detection (`dist/build-hashes.json`).

### 14.3 Runtime Requirements

- **Runtime**: Bun v1.x (v1.0.3+ for ESM, v1.1+ for workspace support).
- **Database**: SQLite 3.x (embedded, file-based).
- **Browser**: Chrome (CDP slave profiles under `chrome-profiles/`).
- **Desktop**: Windows (NSIS installer target). The `UPX` tool is required for binary compression (`winget install UPX.UPX`).
- **Dependencies**: The `package.json` defines the Bun dependencies; `prisma` is the ORM; `zod` is the validation layer; `ulid` provides ID generation; `fast-check` (not yet adopted) would provide property-based testing.

---

## 15. Migration Strategy (High-Level)

This section outlines the migration strategy from the current architecture (`HEAD` / `615d0c5`) to the target architecture (defined by the gap analysis recommendations). The full migration sequence is documented in `MIGRATION_PLAN.md` (Phase 13).

### 15.1 Migration Principles

Every migration must:
- Be independently understandable (clear purpose, evidence, validation).
- Be independently testable (characterization tests or property-based tests).
- Be minimally invasive (small surface area, no unrelated changes).
- Be reversible where practical (can be rolled back without data loss).
- Be associated with a clear architectural reason (`ARCHITECTURAL_DECISIONS.md` reference).

### 15.2 Key Migration Areas (From `SOTA_GAP_ANALYSIS.md`)

| Area | Current State | Target Improvement | Migration Type | Confidence |
|---|---|---|---|---|
| SQLite Scale | SQLite + 2 DB split + `cross-boundary` layer | Add WAL mode tuning + optional `DuckDB` analytics layer; no DB replacement | ADAPT (tuning + optional enhancement) | HIGH |
| CDP Resilience | `ChromeGovernor` (no reconnect/restart) | Add session resilience (`detach()`, reconnect cycle, health heartbeat) + graceful degradation (API-mode fallback) | ADAPT (add resilience) | MEDIUM |
| FSRS Memory | FSRS-6 scheduling (no verification) | Add property-based tests for FSRS state preservation through version chain; fix if gaps found | RESEARCH + ADAPT (tests + fix if needed) | MEDIUM |
| Capability Registry | Lexical `catalog.ts` (static patterns) | Add embedding-based lookup (`nomic-embed-text` or `jina-embeddings-v3`) as supplementary mechanism | RESEARCH + ADD (embedding lookup) | MEDIUM |
| Cross-Boundary Layer | Convention-based enforcement | Add runtime assertions (`ensureSystemDb()` / `ensureUserDb()`) + `TLA+` model checking (future) | ADAPT (enforcement) | MEDIUM |
| Desktop Binary Size | UPX `-3 --no-lzma` (45.6 MB compressed) | Monitor `bkg` packager (Bun canary, ~20% reduction); adopt if stable | ADAPT (monitor + adopt if stable) | MEDIUM |
| MCP Adapters | Present but compliance unknown | Verify 1.0 compliance (Resources, Prompts, Tools, Sampling, Roots); fix gaps | RESEARCH (verify compliance) | LOW |
| Protocol Generation | `bun run gen:protocol` (full regeneration) | Add property-based tests (`fast-check`); research incremental generation | ADD (tests) + RESEARCH (incremental) | MEDIUM |
| Harness Repair | Repair helpers (no property tests) | Add property-based tests for repair helpers; research schema evolution patterns | ADD (tests) + RESEARCH (evolution) | MEDIUM |
| Provider Fallback Chain | Fixed chain (`provider -> generic -> system`) | Add format detection heuristics (CDP event analysis) as supplementary mechanism; keep fixed chain as primary | ADAPT (heuristic selection) | MEDIUM |

---

## 16. Migration Sequence (Conceptual)

The migration sequence (detailed in `MIGRATION_PLAN.md`) follows the master prompt's preferred order:

```
baseline (77c332c) → characterization tests → boundary extraction → SOTA adoption → optimization → hardening → cleanup → final validation
```

Key milestones (conceptual):

1. **Migration 001 — Characterization Tests** (`Phase 17`): Establish what the `v0.1.0` baseline does (test the 341 engine files, 2,088 tracked files, single SQLite DB, 10,661 initial lines). These tests become the reference for future migrations.
2. **Migration 002 — Reconstruction Branch** (`Phase 20`): Create `reconstruction-v010` branch from `77c332c`. All future work occurs on this branch.
3. **Migration 003 — Boundary Extraction** (`Phase 14-15`): Extract the `ChromeGovernor` boundary (verify no other engine touches CDP), the capability registry boundary (verify all capabilities registered), and the seeds-as-truth boundary (verify seed idempotency).
4. **Migration 004 — Cross-Boundary Enforcement** (`ARCHITECTURAL_DECISIONS.md` Decision 5): Add runtime assertions (`ensureSystemDb()` / `ensureUserDb()`) and document the contract.
5. **Migration 005 — Session Resilience** (`SOTA_GAP_ANALYSIS.md` Problem 2): Implement `detach()`, reconnect cycle, and graceful degradation (API-mode fallback) in the ChromeGovernor.
6. **Migration 006 — Protocol Generation Tests** (`SOTA_GAP_ANALYSIS.md` Problem 8): Add property-based tests (`fast-check`) for the protocol generator.
7. **Migration 007 — Memory Scheduling Verification** (`SOTA_GAP_ANALYSIS.md` Problem 3): Add property-based tests for FSRS-6 state preservation through version chain rebuilds.
8. **Migration 008 — Harness Repair Tests** (`SOTA_GAP_ANALYSIS.md` Problem 9): Add property-based tests for repair helpers.
9. **Migration 009 — Capability Registry Enhancement** (`SOTA_GAP_ANALYSIS.md` Problem 4): Add embedding-based lookup as supplementary mechanism (optional adoption).
10. **Migration 010 — Provider Fallback Enhancement** (`SOTA_GAP_ANALYSIS.md` Problem 10): Add format detection heuristics as supplementary mechanism.
11. **Migration 011 — SQLite Tuning** (`SOTA_GAP_ANALYSIS.md` Problem 1): Configure WAL mode, connection pooling, and optional `DuckDB` analytics layer.
12. **Migration 012 — Desktop Binary Optimization** (`SOTA_GAP_ANALYSIS.md` Problem 6): Monitor `bkg` packager; adopt if stable.
13. **Migration 013 — MCP Adapter Compliance** (`SOTA_GAP_ANALYSIS.md` Problem 7): Verify 1.0 compliance and fix gaps.
14. **Migration 014 — Final Validation** (`Phase 24`): Independent senior architect audit of reasoning discoverability.

---

## 17. Key References (Authoritative Documentation)

The following references are used to ground the SOTA recommendations:

- **MCP specification** (`modelcontextprotocol.io/specification/2025-06-18`): Primary technical documentation for the MCP protocol (JSON-RPC 2.0, server/client features, security principles).
- **Playwright CDPSession API** (`playwright.dev/docs/api/class-cdpsession`): Authoritative documentation for CDP session management (`detach()`, `send()`, `on('close')`, `on('event')`).
- **FSRS algorithm** (`github.com/open-spaced-repetition/fsrs4anki`): Canonical explanation and reference implementation of FSRS-6. The Rust implementation (`github.com/open-spaced-repetition/fsrs`) provides the 100-line reference.
- **Tauri V1 guides** (`tauri.app/v1/guides/`): Official Tauri documentation (v1 guides; v2 guides at `v2.tauri.app`). The project uses Tauri V2 (`tauri.conf.json` has V2 config). The v1 docs confirm Tauri's app construction toolkit and features (desktop integration, build/distribution).
- **Local-first manifesto** (`inkandswitch.com/local-first/`): Foundational document defining local-first architecture (offline-first, user-controlled data, collaboration, security). The webfetch returned the page structure but no content; the manifesto is well-known in the engineering community.
- **SQLite official docs** (`sqlite.org`): Standard documentation for WAL mode, connection pooling, and embedded database best practices.
- **DuckDB official docs** (`duckdb.org`): Authoritative documentation for embedded analytical database (columnar storage, analytical queries).
- **TileDB official docs** (`tiledb.com`): Authoritative documentation for multidimensional array storage.
- **Bun docs / canary notes** (via `bun.sh` or Bun release notes): References to `bkg` (Bun Packager) for LZ4-compressed runtime decompression.
- **Nomic embed / Jina embeddings** (via `localhost:11434` or `jina.ai`): Reference implementations for embedding-based search.
- **Property-based testing** (`fast-check`, `quickcheck-js`): Reference libraries for property-based testing of repair helpers and protocol generation.

---

## 18. Unknowns Requiring Further Investigation

The following unknowns remain open (from `ARCHITECTURAL_DECISIONS.md` §Open Questions and the forensic audit):

1. **Era 3 checkpoint anomaly** (`1cae2a1`): Why does `git log` show a 0-commit range between `e1952fc` and `1cae2a1`? Was this an experiment, squash rebase, or remote-sync issue? Investigate `git fsck --unreachable` for hints.
2. **`intelligence-pack-acu-dcb-storage/`** (`ARCHITECTURAL_ERAS.md` §Era 5): What does this directory contain? Has it been wired into the API surface? Is it a research wrapper or a production feature?
3. **`claude-investigate/`** (dev signals directory): Should it be gitignored? It was committed in `3949aa5` but serves no user-facing purpose.
4. **`prd-merged/`**: What merge target existed? What is the purpose of this directory?
5. **DB split boundary validation under load**: Has the `system/user` split been validated with concurrent writes, cross-boundary reads, and failure scenarios?
6. **`H1-H15` documentation**: Where are the H1-H15 findings documented? Are they in `.opencode/memory/`, `docs/`, or `PROGRESS.md`?
7. **`447524c`** (pre-`edd8fa5`): What is the real story at this commit? It added `nlcl-otel` tests and port validation. Is there a documentation basis?
8. **Generated-client lifecycle**: The `src/generated/` files are regenerated at boot but untracked. Should they be tracked in `.gitignore` explicitly? Should the generation process include property-based tests?

These unknowns are tracked in `EVOLUTION_JOURNAL.md` (Phase 16) and should be investigated before major migrations.
