# INVARIANTS.md — Architectural Boundary Conditions

**Status:** ACTIVE — enforced by `bun run devops invariants check`
**Date:** 2026-07-18
**Purpose:** Non-negotiable constraints that govern all planning and development. Violations are tiered: architectural (Category B) are hard blocks, quality (Category D) are soft warnings.

---

## Enforcement Model

| Category | Violation Type | Effect |
|----------|---------------|--------|
| **A: Ground Truth** | Hard block | Unit cannot proceed until satisfied |
| **B: Architectural** | Hard block | Unit cannot proceed until satisfied |
| **C: Planning** | Hard block | Unit cannot proceed until satisfied |
| **D: Quality** | Soft warning | Logged in report, gate passes, human decides |
| **E: Goals** | Soft / linked | No hard gates — `bun run devops goals drift` detects drift (see Category E) |

**Hard block** = `bun run devops invariants check --unit <id>` returns non-zero, gate fails.
**Soft warning** = logged, gate passes, appears in compliance report.

---

## Category A: Ground Truth Invariants

Research-first workflow. No implementation without truth verification.

### A1: Research Report Required

**Rule:** No unit may transition from `pending` to `in_progress` without a research report.

**Enforcement:** `devops/invariants.ts` checks that `docs/roadmap/RESEARCH-REPORT.md` exists and contains an entry for the unit before `in_progress` is allowed.

**Check:**
```
docs/roadmap/RESEARCH-REPORT.md must exist
Entry for unit ID must be present with classification
```

### A2: Classification Before Implementation

**Rule:** Research must classify each unit as DONE / PORT / CREATE / FIX before implementation begins.

**Enforcement:** `devops/invariants.ts` splits `RESEARCH-REPORT.md` on `### <Name>` section headers (the report uses prose section headers, not `### N.N` numeric headers) and verifies the unit's section contains a `classification:` field. The unit is located by its id appearing in the section body.

**Check:**
```
RESEARCH-REPORT.md section for unit must have classification field
```

### A3: Vivim-Final Source Is Truth Before Porting

**Rule:** The source of truth is always vivim-final source code + the atomic spec. When classifying a unit as PORT (exists in vivim-final core, needs adaptation), the relevant vivim-final file must be read and its interface extracted. Prior-art repos (cap-store / vivim-app-og) are advisory references only and never a harvest mandate.

**Enforcement:** Research report section for PORT units must include `vivimRef` (path in `src/`) and `vivimLines` fields. `capStoreRef` is optional and advisory only.

**Check:**
```
If classification = PORT, vivimRef and vivimLines must be present
```

> **A4 (Truth Score ≥ 0.8 hard block) — REMOVED.** The TRUTH-GAPS report scored 58%, which made A4 a live contradiction blocking all new unit work. Truth confidence is now tracked as an **outcome key result** in `docs/goals/GOALS.md` (zero-cloud / truth-score axis) and drift-checked by `bun run devops goals drift`, not enforced as an invariant gate.

---

## Category B: Architectural Invariants

Hard boundaries that define the system's architecture. Violations break the architecture.

### B1: Governor Canon — Single I/O Authority

**Rule:** No engine except `ChromeGovernor` may import `BunCdpClient` or reference CDP directly.

**Enforcement:** `devops/invariants.ts` scans `src/engines/*.ts` for imports of `BunCdpClient`, `cdp.js`, or other CDP transport modules. The `cdp-discovery` module is a pure protocol *descriptor* (static catalog + parser, no socket) and is exempt. Engines that need a CDP client receive it **injected** as a narrow local interface (e.g. `CdpSender`) rather than importing the transport.

**Check:**
```
grep -r "BunCdpClient\|from.*cdp" src/engines/
Must return zero matches (except chrome-governor.ts and cdp-discovery.ts)
```

### B2: Store Contract Isolation

**Rule:** Engines depend only on store contracts (`src/storage/contracts/*.ts`), never on concrete implementations (`src/storage/impl/*.ts`).

**Enforcement:** `devops/invariants.ts` scans `src/engines/*.ts` for imports containing `-impl` or `src/storage/impl`.

**Check:**
```
grep -r "storage/impl\|-impl" src/engines/
Must return zero matches
```

### B3: Seeds Not Code

**Rule:** All provider configuration lives in seed files (`seeds/providers/*.json`), not in TypeScript source.

**Enforcement:** `devops/invariants.ts` checks that no engine file contains hardcoded provider names as string literals in configuration objects.

**Check:**
```
grep -r "DEFAULT_PROVIDER_CONFIGS\|provider-config" src/engines/
Must return zero matches
```

### B4: Relational First (scoped)

**Rule:** Structured data MAY be JSON-serialized in TEXT columns **only when it is a self-contained, non-relational blob** (config, metadata, context, override, state, serialized Node data/edges — the real `NodeEdge` FK table handles relational edges). Any data that participates in a relationship (foreign key, join, cascade) MUST be a real table/column — **never embedded JSON**. SQLite has no native JSON type, so serialization blobs are necessary; this invariant forbids using JSON to *fake a relationship* that should be a foreign-key edge table.

**Enforcement:** `devops/invariants.ts` scans `prisma/schema.prisma` for JSON-backed columns whose name denotes an array of foreign keys (e.g. `...Ids`, `...IdList`, `...RefIds`, `...ChildIds`, `...ParentIds`, `...RelatedIds`, `...LinkIds`). High-precision pattern — it does not flag the ~130 legitimate serialization columns.

**Check:**
```
JSON column whose name ends in an id-list pattern → must be a real edge/relation table
```

### B5: Config Authority

**Rule:** All engine configuration flows through `ConfigManager`. No engine reads config from environment variables or files directly.

**Enforcement:** `devops/invariants.ts` scans `src/engines/*.ts` for `process.env` or direct file reads for config.

**Check:**
```
grep -r "process\.env\|readFile.*config" src/engines/
Must return zero matches (except config-manager.ts)
```

### B6: Server-Side Harness

**Rule:** `HarnessRuntime` runs server-side (Node.js/Bun). No execution logic is injected into Chrome's page context.

**Enforcement:** `devops/invariants.ts` checks that `src/engines/harness-runtime.ts` does not use `Page.addScriptToEvaluateOnNewDocument` or `Runtime.evaluate` for execution.

**Check:**
```
harness-runtime.ts must not contain Page.addScriptToEvaluateOnNewDocument
```

### B7: Error Classes

**Rule:** All custom errors extend from `src/errors.ts`. No raw `new Error()` in engine code.

**Enforcement:** `devops/invariants.ts` scans `src/engines/*.ts` for `new Error(` (excluding comments).

**Check:**
```
grep -r "new Error(" src/engines/
Must return zero matches
```

### B8: Agent-Addressable UI Actions

**Rule:** Every frontend UI action MUST be registered in the shared `ActionRegistry` (`frontend`) and executed ONLY through `dispatch(actionId, params)`. No interactive affordance may perform side-effecting work via a handler that bypasses the registry. An `AgentBridge` MUST expose the registry to AI agents over the backend WS command channel (`agent:command` / `agent:result`), with Zod-validated params and an introspectable catalog (`agent:discover`). Human UI and agent MUST share the identical dispatch path. Driving the frontend via CDP/Playwright selectors is forbidden as a primary mechanism (allowed only for visual E2E validation).

**Enforcement:** `devops/invariants.ts` checks:
- `frontend/src/actions/registry.ts` exists and exports `ActionRegistry` with `registerAction`, `dispatch`, `listActions`.
- `frontend/src/actions/agent-bridge.ts` exists and exports `AgentBridge`.
- `web/sandbox` and `web/app` import `@ui/actions`.
- `src/server/websocket.ts` handles `agent:command` and `agent:discover` message types.

**Check:**
```
grep "agent:command" src/server/websocket.ts  → must match
grep "agent:discover" src/server/websocket.ts → must match
```

### B9: Encryption Required for At-Rest Data — NOT ACTIVE DURING MVP

**Rule (target state):** All user data at rest (conversation history, knowledge base, exported data, sync payloads) MUST be encrypted using AES-256-GCM via `EncryptionEngine`. No plaintext user data may be written to SQLite without encryption wrapping.

**Status:** `src/engines/encryption.ts` exists, but this invariant is **NOT ACTIVE during the MVP development phase**. Enforcement is deferred until sovereign-data work begins (Phase 20). It is intentionally NOT run by `devops/invariants.ts` while MVP development is ongoing.

**Check (post-MVP):** `src/engines/encryption.ts` exports `EncryptionEngine`; storage writes go through `encrypt()` before INSERT.

### B10: HITL Gate for Destructive Actions

**Rule:** Any autonomous action that modifies external state (delete, send, publish, deploy) MUST pass through a Human-in-the-Loop gate. The destructive step is paused and awaits explicit human approval before executing.

**Enforcement:** `devops/invariants.ts` verifies:
- `AutonomousExecutionEngine` (`src/engines/autonomous-execution.ts`) gates destructive/financial steps through `HitlGate` (persisted model) and sets task status to `waiting_approval` before executing.
- Other destructive surfaces (`export.ts`, `sync.ts`, `conversation-manager.ts`) route irreversible work through *some* approval gate rather than acting autonomously (heuristic warning if a destructive surface lacks any gate reference).

> **Note:** The gate logic lives **inside `AutonomousExecutionEngine` + the `HitlGate` Prisma model**, not a separate `hitl-gates.ts`. The original doc describing a `hitl-gates.ts` module was wrong — there is no such file and none is required.

**Check:**
```
AutonomousExecutionEngine must gate destructive steps (HitlGate + waiting_approval)
Destructive surfaces must reference an approval gate
```

### B11: Air-Gap Mode — No Outbound Calls — NOT ACTIVE DURING MVP

**Rule (target state):** When Air-Gap mode is enabled, VIVIM must make zero outbound network calls. All operations must be served from local data and local models. The air-gap engine must be the single authority for network access decisions.

**Status:** The engine is `src/engines/airgap.ts` (the original doc referenced a non-existent `airgap-engine.ts` — path corrected). This invariant is **NOT ACTIVE during the MVP development phase**. Enforcement is deferred until sovereign-data work begins (Phase 20).

**Check (post-MVP):** `src/engines/airgap.ts` exports the air-gap authority; engines route `fetch()`/`axios`/`http.request` through it.

### B12a: Egress Governance (Zero-Cloud Proof)

**Rule:** VIVIM must be able to prove it sends zero telemetry to external services. The egress audit engine must intercept and log **all** outbound network requests, persist the audit trail, and expose it for export/compliance review. Audit logs must be exportable.

**Enforcement:** `devops/invariants.ts` checks that `src/engines/telemetry-audit.ts` exists and (warning-level) that it exposes a `exportAuditLog()` surface and persists records (not in-memory only).

**Check:**
```
src/engines/telemetry-audit.ts must exist and export the audit engine
Audit trail must be persistable + exportable (warning if in-memory only)
```

### B12b: Capture Telemetry (Ingress Governance)

**Rule:** A centralized telemetry governance system must formally specify the **valuable signals captured from incoming user + provider conversation streams** — dates, timestamps, response model, tool-use, system — and from document metadata. Parsers and capture telemetry are designed together, not as an afterthought.

**Enforcement:** `devops/invariants.ts` checks (warning-level) that a capture-telemetry registry/schema exists (`telemetry-aggregator.ts`, `capture-telemetry.ts`, or `src/schema/telemetry-capture.ts`) so the ingress plan is concretely specified.

**Check:**
```
A capture-telemetry registry/schema must exist formalizing ingress signal capture
```

> **B12 split note:** The original single B12 ("Telemetry Audit") promised a `TelemetryAuditEngine` with `getAuditLog()`/`exportAuditLog()`. The real class is `TelemetryAudit` (passive, in-memory, different method names). B12 is split into **B12a (egress proof)** and **B12b (ingress capture plan)** to cover both sides of telemetry governance.

> **B13, B14 — REMOVED.** These were doc-only duplicates of B5 (Config Authority) and B2 (Store Contract Isolation), repeated verbatim for "upgrade engines." The base checks already cover all engines; separate duplicates added no enforcement value.

---

## Category C: Planning Invariants

Roadmap adherence. No unit proceeds without proper planning.

### C1: Phase Gate

**Rule:** Phase N cannot start until all units in phase N-1 are `[x]` (done).

**Enforcement:** `devops/invariants.ts` parses the tracker and checks that all units in the previous phase are done.

**Check:**
```
For unit in phase N, all units in phase N-1 must have state = done
```

### C2: Dependency Gate

**Rule:** A unit cannot start until all its dependencies are `[x]` (done).

**Enforcement:** `devops/invariants.ts` uses `devops/deps.ts` to load dependencies and checks that all are done.

**Check:**
```
For each dependency in atomic spec's **Depends:** line, tracker state must be done
```

### C3: Atomic Spec Required

**Rule:** Every unit must have an atomic spec file in `docs/atomic/phase-*/` before implementation.

**Enforcement:** `devops/invariants.ts` checks that a markdown file exists containing `# Unit <id>`.

**Check:**
```
docs/atomic/phase-*/*.md must contain a file with "# Unit <id>"
```

### C4: Design Doc Reference

**Rule:** Every unit must reference which design doc it implements (in its atomic spec).

**Enforcement:** Atomic spec must contain a `**Source:**` or `**Design Doc:**` field.

**Check:**
```
Atomic spec must contain **Source:** or **Design Doc:** line
```

> **C5 (SOTA Priority Ordering) — REMOVED.** Documented as a hard block but never implemented in `devops/invariants.ts`. Phase ordering is already enforced by C1 (phase gate) and C2 (dependency gate).

---

## Category D: Quality Invariants

Code quality standards. Violations are warnings, not blocks.

### D1: Engine Unit Tests

**Rule:** Every engine should have unit tests with mocked stores.

**Enforcement:** `devops/invariants.ts` checks that `tests/unit/engines/<engine-name>.test.ts` exists for each engine.

**Check:**
```
For each src/engines/<name>.ts, tests/unit/engines/<name>.test.ts should exist
```

### D2: Type Safety

**Rule:** No `any` types in engine code. Storage layer `any` is confined to the Prisma accessor.

**Enforcement:** `devops/invariants.ts` scans `src/engines/*.ts` for `: any` or `as any`.

**Check:**
```
grep -r ": any\|as any" src/engines/
Must return zero matches
```

### D3: Gate Pass

**Rule:** `bun run devops gate` must pass (typecheck + lint + tests).

**Enforcement:** Already enforced by `devops/gate.ts`.

**Check:**
```
bun run typecheck → exit 0
bun run lint → exit 0
bun test → exit 0
```

### D4: Barrel Export

**Rule:** All public engine classes are exported from `src/index.ts`.

**Enforcement:** `devops/invariants.ts` checks that each engine class is re-exported from `src/index.ts`.

**Check:**
```
src/index.ts must contain export for each engine class
```

---

## Category E: Goals — Linked Tracking (no hard gates)

Goals are a progress-tracking + outcome-measurement artifact, not an invariant gate. There are **no hard blocks** in Category E. Instead, `bun run devops goals drift` cross-checks `docs/goals/GOALS.md` against the real atomic tracker and invariant state, and reports mismatches as **drift warnings** (not gate failures).

> **E1–E4 (goal alignment / targets / owners / unit linkage) — REMOVED from invariants.** These were documented as hard blocks but `docs/goals/GOALS.md` exists and none were implemented. Goal quality is now expressed through the outcome-key-result axis (below) and verified by `goals drift`.

### E5: Integration Test Parity — Real Chrome Execution Required

**Rule:** At least one capability-related unit must have passing integration tests with real Chrome (or fake Chrome mock) before the unit can be marked done.

**Enforcement:** `devops/invariants.ts` checks that `tests/integration/` contains tests for executor or capability modules when units 11.5–13.10 are in scope.

**Check:**
```
For units 11.5-13.10, check if tests/integration/executor/ or tests/integration/capabilities/ exists
If Chrome unavailable, fake Chrome mock tests satisfy this requirement
```

### Outcome Key Results (drift-checked)

Each goal carries a parallel **outcome axis** alongside the delivery (units-done) axis. These are verified by `bun run devops goals drift`:

| Outcome KR | Tied to invariant | Signal |
|------------|-------------------|--------|
| Zero-cloud proof passes | B12a | No non-provider egress |
| HITL coverage 100% of destructive actions | B10 | All destructive surfaces gated |
| p95 stream-parse latency budget | Parser system | Parse performance |
| Encryption-at-rest active (post-MVP) | B9 | Sovereign data |
| Agent-addressable UI = 100% of actions | B8 | Architecture promise |
| Truth score ≥ 80% | (formerly A4) | Research confidence |

---

## Usage

### Check all invariants for a unit
```bash
bun run devops invariants check --unit 11.5
```

### Check only architectural invariants
```bash
bun run devops invariants check --category B
```

### Generate compliance report
```bash
bun run devops invariants report
```

### Detect goal drift (no gate)
```bash
bun run devops goals drift
```

### Part of quality gate (automatic)
```bash
bun run devops gate  # now includes invariant check as final step
```

---

## Waivers

To waive an invariant for a specific unit:

1. Add a `**Waiver:**` field to the unit's atomic spec
2. Reference the invariant ID (e.g., `B1`)
3. Provide justification
4. Waiver must be approved by project owner

Example:
```markdown
## Waiver
- **B1 (Governor Canon):** Waived for unit 12.1 — ChromeGovernor stubs need direct CDP access for testing.
- **Approved:** 2026-07-10 by user
```

---

## Modification

To add or modify invariants:

1. Update this document
2. Update `devops/invariants.ts` with the new check
3. Update `tests/unit/devops/invariants.test.ts` with test
4. Update `AGENTS.md` summary section

All invariant changes require explicit approval before merging.
