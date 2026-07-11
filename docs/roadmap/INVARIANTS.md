# INVARIANTS.md — Architectural Boundary Conditions

**Status:** ACTIVE — enforced by `bun run devops invariants check`
**Date:** 2026-07-11
**Purpose:** Non-negotiable constraints that govern all planning and development. Violations are tiered: architectural (Category B) are hard blocks, quality (Category D) are soft warnings.

---

## Enforcement Model

| Category | Violation Type | Effect |
|----------|---------------|--------|
| **A: Ground Truth** | Hard block | Unit cannot proceed until satisfied |
| **B: Architectural** | Hard block | Unit cannot proceed until satisfied |
| **C: Planning** | Hard block | Unit cannot proceed until satisfied |
| **D: Quality** | Soft warning | Logged in report, gate passes, human decides |

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

**Enforcement:** The research report entry must include `classification: DONE|PORT|CREATE|FIX`.

**Check:**
```
RESEARCH-REPORT.md entry for unit must have classification field
```

### A3: Vivim-Final Source Is Truth Before Porting

**Rule:** The source of truth is always vivim-final source code + the atomic spec. When classifying a unit as PORT (exists in vivim-final core, needs adaptation), the relevant vivim-final file must be read and its interface extracted. Prior-art repos (cap-store / vivim-app-og) are advisory references only and never a harvest mandate.

**Enforcement:** Research report entry for PORT units must include `vivimRef` (path in `src/`) and `vivimLines` fields. `capStoreRef` is optional and advisory only.

**Check:**
```
If classification = PORT, vivimRef and vivimLines must be present
```

### A4: Truth Score Threshold

**Rule:** The domain's truth score must be ≥ 0.8 before new units in that domain can start.

**Enforcement:** `devops/invariants.ts` reads `docs/roadmap/TRUTH-GAPS.md` and checks the truth score for the unit's domain.

**Check:**
```
TRUTH-GAPS.md truth score for domain ≥ 0.8
```

---

## Category B: Architectural Invariants

Hard boundaries that define the system's architecture. Violations break the architecture.

### B1: Governor Canon — Single I/O Authority

**Rule:** No engine except `ChromeGovernor` may import `BunCdpClient` or reference CDP directly.

**Enforcement:** `devops/invariants.ts` scans `src/engines/*.ts` for imports of `cdp.js`, `cdp.ts`, or `BunCdpClient`.

**Check:**
```
grep -r "BunCdpClient\|from.*cdp" src/engines/
Must return zero matches (except chrome-governor.ts)
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

### B4: Relational First

**Rule:** No JSON-in-TEXT columns for queryable data. All relationships are foreign keys with cascading deletes.

**Enforcement:** Schema-level check in `prisma/schema.prisma` — no `Json` type on columns that are queried.

**Check:**
```
prisma/schema.prisma must not have Json type on queryable columns
Enforced by schema review, not automated (schema is static)
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

**Rule:** Every frontend UI action MUST be registered in the shared `ActionRegistry`
(`web/ui`) and executed ONLY through `dispatch(actionId, params)`. No interactive
affordance may perform side-effecting work via a handler that bypasses the registry.
An `AgentBridge` MUST expose the registry to AI agents over the backend WS command
channel (`agent:command` / `agent:result`), with Zod-validated params and an
introspectable catalog (`agent:discover`). Human UI and agent MUST share the identical
dispatch path. Driving the frontend via CDP/Playwright selectors is forbidden as a
primary mechanism (allowed only for visual E2E validation).

**Enforcement:** `devops/invariants.ts` checks:
- `web/ui/src/actions/registry.ts` exists and exports `ActionRegistry` with `registerAction`, `dispatch`, `listActions`.
- `web/ui/src/actions/agent-bridge.ts` exists and exports `AgentBridge`.
- `web/sandbox` and `web/app` import `@ui/actions`.
- `src/server/websocket.ts` handles `agent:command` and `agent:discover` message types.

**Check:**
```
grep "agent:command" src/server/websocket.ts  → must match
grep "agent:discover" src/server/websocket.ts → must match
```
Heuristic (soft warning): UI `onClick` handlers performing side effects MUST reference `@ui/actions`.

### B9: Encryption Required for At-Rest Data

**Rule:** All user data at rest (conversation history, knowledge base, exported data, sync payloads) MUST be encrypted using AES-256-GCM via `EncryptionEngine`. No plaintext user data may be written to SQLite without encryption wrapping.

**Enforcement:** `devops/invariants.ts` checks that `src/engines/encryption.ts` exists and that Phase 20 storage writes go through encryption layer.

**Check:**
```
src/engines/encryption.ts must exist and export EncryptionEngine
Phase 20 storage writes must use encrypt() before INSERT
grep -r "\.create\|\.upsert" src/storage/impl/ | grep -v "encrypt" in sovereign-data files → warning
```

### B10: HITL Gate for Destructive Actions

**Rule:** Any autonomous action that modifies external state (delete, send, publish, deploy) MUST pass through a Human-in-the-Loop gate. The `AutonomousExecutionEngine` must pause and await explicit human approval before executing destructive operations.

**Enforcement:** `devops/invariants.ts` checks that `src/engines/hitl-gates.ts` exists and that `AutonomousExecutionEngine` routes destructive actions through HITL.

**Check:**
```
src/engines/hitl-gates.ts must exist and export HitlGateSystem
AutonomousExecutionEngine must call hitlGates.check() before destructive ops
grep -r "delete\|send\|publish\|deploy" src/engines/autonomous-execution.ts → must have HITL gate call
```

### B11: Air-Gap Mode — No Outbound Calls

**Rule:** When Air-Gap mode is enabled, VIVIM must make zero outbound network calls. All operations must be served from local data and local models. The `AirGapEngine` must be the single authority for network access decisions.

**Enforcement:** `devops/invariants.ts` checks that `src/engines/airgap-engine.ts` exists and that no engine makes direct `fetch()` or HTTP calls without going through `AirGapEngine.isAllowed()`.

**Check:**
```
src/engines/airgap-engine.ts must exist and export AirGapEngine
grep -r "fetch(" src/engines/ → must go through AirGapEngine
grep -r "axios\|http\.request\|https\.request" src/engines/ → must go through AirGapEngine
```

### B12: Telemetry Audit — Zero-Cloud Proof

**Rule:** VIVIM must be able to prove it sends zero telemetry to external services. The `TelemetryAuditEngine` must intercept and log all outbound network requests, providing a complete audit trail. Audit logs must be exportable for compliance review.

**Enforcement:** `devops/invariants.ts` checks that `src/engines/telemetry-audit.ts` exists and that all outbound requests are logged.

**Check:**
```
src/engines/telemetry-audit.ts must exist and export TelemetryAuditEngine
TelemetryAuditEngine must expose getAuditLog() and exportAuditLog()
All outbound requests must be logged with timestamp, destination, payload size
```

### B13: Config Through ConfigManager — No Direct Environment Reads

**Rule:** All engine configuration flows through `ConfigManager`. No engine reads config from environment variables or files directly. (Reinforced from B5 for upgrade engines.)

**Enforcement:** `devops/invariants.ts` scans upgrade engine files for `process.env` or direct file reads for config.

**Check:**
```
grep -r "process\.env\|readFile.*config" src/engines/ (upgrade engines only)
Must return zero matches
```

### B14: Store Contract Isolation — Upgrade Engines

**Rule:** Upgrade engines (Phase 14-20) depend only on store contracts (`src/storage/contracts/*.ts`), never on concrete implementations. (Reinforced from B2 for upgrade engines.)

**Enforcement:** `devops/invariants.ts` scans upgrade engine files for imports containing `-impl` or `src/storage/impl`.

**Check:**
```
grep -r "storage/impl\|-impl" src/engines/ (upgrade engines only)
Must return zero matches
```

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

### C5: SOTA Priority Ordering

**Rule:** SOTA priority ordering (P1 > P2 > P3 > P4) must be respected. P1 units cannot start if P0 units are incomplete.

**Enforcement:** `devops/invariants.ts` maps phases to SOTA priorities and checks ordering.

**Check:**
```
Phase 7-8 (SOTA P1-P2) cannot start if Phase 11 (executor porting) is incomplete
```

---

## Category D: Quality Invariants

Code quality standards. Violations are warnings, not blocks.

### D1: Engine Unit Tests

**Rule:** Every engine must have unit tests with mocked stores.

**Enforcement:** `devops/invariants.ts` checks that `tests/unit/engines/<engine-name>.test.ts` exists for each engine.

**Check:**
```
For each src/engines/<name>.ts, tests/unit/engines/<name>.test.ts must exist
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

## Category E: Goal Invariants

Goal alignment and OKR integrity. Ensures every decision and unit contributes to the project's goals.

### E1: Decisions Must Reference Goals

**Rule:** Every ADR option must have a `relatedGoals` or `goalAlignment` field set. Decisions without goal alignment cannot be approved.

**Enforcement:** `devops/invariants.ts` checks `docs/decisions/ADR-*.md` files for `goalAlignment` or `relatedGoals` on each option. If goals are defined in `docs/goals/GOALS.md`, missing alignment is a hard block.

**Check:**
```
For each option in an ADR, goalAlignment or relatedGoals must be present
If docs/goals/GOALS.md exists and has goals, this is a hard block
If no goals exist, this is a soft warning
```

### E2: Key Results Must Have Targets

**Rule:** Every key result must have a numeric `target` value greater than zero.

**Enforcement:** `devops/invariants.ts` parses `docs/goals/GOALS.md` and checks that all key results have `target > 0`.

**Check:**
```
For each key result in GOALS.md, target must be > 0
```

### E3: Goals Must Have Owners

**Rule:** Every goal must have an owner assigned.

**Enforcement:** `devops/invariants.ts` parses `docs/goals/GOALS.md` and checks that all goals have a non-empty owner field.

**Check:**
```
For each goal in GOALS.md, owner must be non-empty
```

### E4: Units Should Reference Goals

**Rule:** Atomic units should contribute to at least one key result (soft — informational only).

**Enforcement:** `devops/invariants.ts` checks if atomic unit IDs appear in any goal's `relatedUnits` lists. Unrelated units are logged as warnings.

**Check:**
```
For each unit in tracker, check if its ID appears in any key result's relatedUnits
Units not contributing to any goal → soft warning
```

### E5: Integration Test Parity — Real Chrome Execution Required

**Rule:** At least one capability-related unit must have passing integration tests with real Chrome (or fake Chrome mock) before the unit can be marked done.

**Enforcement:** `devops/invariants.ts` checks that `tests/integration/` contains tests for executor or capability modules when units 11.5-13.10 are in scope.

**Check:**
```
For units 11.5-13.10, check if tests/integration/executor/ or tests/integration/capabilities/ exists
If Chrome unavailable, fake Chrome mock tests satisfy this requirement
```

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
