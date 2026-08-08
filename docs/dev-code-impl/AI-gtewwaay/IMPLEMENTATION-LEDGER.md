# IMPLEMENTATION-LEDGER — AI Gateway (`src/ai/`)

The per-file decision record for turning the pristine design
(`docs/dev-code-impl/AI-gtewwaay/`) into the landed implementation (`src/ai/`).
One row per design file. Statuses: `adopted-as-is` · `adjusted` · `deferred` ·
`rejected`. Each non-adopted row records the why + assessment reference.

**Pristine spec:** `docs/dev-code-impl/AI-gtewwaay/` (git-committed, never mutated
during implementation).
**Landing spot:** `src/ai/` (layout per `ARCHITECTURE.md` §5).

---

## Layout Reconstruction (P0 — before any file lands)

The design's `index.ts` imports subdirectory paths (`./core/types`,
`./execution/manager`, ...) but the root files are **flat**. Every file's `@module`
tag declares its home. P0 must reconstruct:

```
src/ai/
  core/
    types.ts          ← from root types.ts
    errors.ts         ← from root errors.ts
    invariants.ts     ← from root invariants.ts
  execution/
    types.ts          ← MISSING at root — only in mnt/ (see below)
    manager.ts        ← from root manager.ts
  protocol/
    adapter.ts        ← from root adapter.ts
  routing/
    router.ts         ← from root router.ts
  policy/
    policy.ts         ← from root policy.ts
  registry/
    registry.ts       ← from root registry.ts
  runtime/
    resources.ts      ← from root resources.ts
    supervisor.ts     ← from root supervisor.ts
  tools/
    orchestrator.ts   ← from root orchestrator.ts
  plugins/
    manager.ts        ← MISSING at root — only in mnt/ (see below)
  events/
    bus.ts            ← from root bus.ts
  gateway/
    gateway.ts        ← from root gateway.ts
  index.ts            ← from root index.ts
```

**Root-file gaps confirmed:** `execution/types.ts` and `plugins/manager.ts` exist
ONLY under `docs/dev-code-impl/AI-gtewwaay/mnt/user-data/outputs/vivim-ai-gateway/
src/ai/{execution,plugins}/`. They must be sourced from the `mnt/` snapshot (the
design's own generated-output layout), and the root folder should gain a `README`
note pointing at the split (see ledger entry for `index.ts`).

---

## Per-File Ledger

### 1. `types.ts` → `src/ai/core/types.ts`
- **Status: adopted-as-is**
- A1 §2: data-only IR, no collisions with `src/schema/streaming.ts` `ContentBlock`
  (different domain: provider-capture vs IR-neutral). A2 §2: name-space under `ai/core`,
  keep separate from `ContentBlock`.
- Note: imports are extensionless (`'./types'`); repo requires `.js` suffix → this is
  the **MECHANICAL adjustment applied to every file at staging** (A2 §5), not a
  semantic change. Tracked once here.

### 2. `errors.ts` → `src/ai/core/errors.ts`
- **Status: adopted-as-is**
- A2 §2: `VivimAIError` coexists with `EngineError` (`src/errors.ts`) — do NOT merge.
  Expose `isVivimAIError` from `src/ai/index.ts`. `.js`-suffix adjustment.

### 3. `invariants.ts` → `src/ai/core/invariants.ts`
- **Status: adopted-as-is**
- A2 §2: cheap guards, no conflict with `harness-repair-engine.ts`. `.js`-suffix
  adjustment. `assertNotMutated` is load-bearing for adapter safety (A4).

### 4. `manager.ts` → `src/ai/execution/manager.ts`
- **Status: adopted-as-is**
- A1: `IExecutionManager` is the core persistence-shaped contract; `AIExecution`
  table is the DB home (A1 §4.1). `.js`-suffix adjustment.

### 5. `execution/types.ts` (from `mnt/`) → `src/ai/execution/types.ts`
- **Status: adopted-as-is**
- This is the execution model (`ExecutionState`, `EXECUTION_TRANSITIONS`,
  `AIExecution`, `ExecutionEvent`, `ExecutionHandle`). A1 §4.1 maps it to the
  `AIExecution`/`AIExecutionEvent` tables. Source of truth = `mnt/` snapshot.
  `.js`-suffix adjustment.

### 6. `adapter.ts` → `src/ai/protocol/adapter.ts`
- **Status: adopted-as-is**
- A2 §2: the ONE provider execution contract; existing `ApiProviderAdapter` /
  `LocalModelAdapter` become candidate impls later, never replacements now.
  `.js`-suffix adjustment.

### 7. `router.ts` → `src/ai/routing/router.ts`
- **Status: adopted-as-is**
- A2 §3.1: keep separate from `ProviderMuxEngine` (different request shapes); do not
  merge routers. `.js`-suffix adjustment.

### 8. `policy.ts` → `src/ai/policy/policy.ts`
- **Status: adopted-as-is**
- A4 §2.2: evaluator/enforcer split is stricter than `ExecutionPolicyEngine` —
  keep both. `.js`-suffix adjustment.

### 9. `registry.ts` → `src/ai/registry/registry.ts`
- **Status: adopted-as-is**
- A1 §3.1: in-memory `IProviderRegistry`/`IModelRegistry`; DB mapping keeps gateway
  providers in a separate identity namespace (do NOT fold into `ProviderDefinition`).
  `.js`-suffix adjustment.

### 10. `resources.ts` → `src/ai/runtime/resources.ts`
- **Status: adopted-as-is**
- A1 §4.2: `ResourceLease` DB table is OPTIONAL (in-memory M2 acceptable). `.js`-suffix
  adjustment.

### 11. `supervisor.ts` → `src/ai/runtime/supervisor.ts`
- **Status: adopted-as-is**
- A2 §2: TS-side contract for a Rust/Tauri boundary; do NOT map to `ChromeGovernor`.
  A5 §7: stub supervisor returns `in-process` connections until M5. `.js`-suffix.

### 12. `orchestrator.ts` → `src/ai/tools/orchestrator.ts`
- **Status: adopted-as-is**
- A4 §2.1: 4-stage pipeline is net-new; no bypass path. `.js`-suffix adjustment.

### 13. `plugins/manager.ts` (from `mnt/`) → `src/ai/plugins/manager.ts`
- **Status: adopted-as-is**
- A4 §2.3: trust model (signed ≠ safe). `PluginRegistry` table = DB home (A1 §3.10).
  Source of truth = `mnt/` snapshot. `.js`-suffix adjustment.

### 14. `bus.ts` → `src/ai/events/bus.ts`
- **Status: adopted-as-is**
- A1 §3.11: persist to `EventRecord` via adapter (`source='ai-gateway'`).
  A5 §5: mirror via `CapabilityEventBus` outbox pattern. `.js`-suffix adjustment.

### 15. `gateway.ts` → `src/ai/gateway/gateway.ts`
- **Status: adopted-as-is**
- A3 §2: the ONE public entry point; exposed as `cap:ai:*` capabilities, never a
  second transport. `.js`-suffix adjustment.

### 16. `index.ts` → `src/ai/index.ts`
- **Status: adjusted (mechanical)**
- As-shipped, `index.ts` imports `./core/types` etc. which resolve ONLY after layout
  reconstruction. Adjust = correct relative paths for the reconstructed layout (no
  semantic change). Add a doc note that VIVIM Core imports ONLY this barrel (design
  invariant 1). `.js`-suffix adjustment.

### 17. `ARCHITECTURE.md` → `src/ai/README.md` (or keep at `src/ai/ARCHITECTURE.md`)
- **Status: adjusted (location only)**
- Keep as the package doc. Content is the canonical architecture; do not rewrite.
  Consider a short addendum pointing at `docs/dev-code-impl/AI-gtewwaay/` as the
  pristine spec + this ledger.

### 18. `tsconfig.json` (design's own) → align with repo
- **Status: adjusted (mechanical)**
- Repo is `strict` + `noUncheckedIndexedAccess` + `.js` import suffix. Design ships its
  own tsconfig; verify it matches repo settings so `src/ai` type-checks under the repo
  root tsconfig (A2 §5). If the repo build covers `src/**`, the design tsconfig is
  unnecessary — delete it and rely on the root one.

### 19. `DB-IMPACT.md`, `A2..A5-*.md` (assessment docs) → keep at `docs/dev-code-impl/AI-gtewwaay/`
- **Status: adopted (docs stay in the spec folder, NOT copied into `src/ai/`)**
- Assessments live beside the pristine spec; `src/ai/` carries only code + README.
  This keeps the landing spot clean and the spec folder the single assessment home.

### 20. `CONVERGENCE-PLAN.md` → keep at `docs/dev-code-impl/AI-gtewwaay/`
- **Status: adopted (docs stay with the spec, NOT copied into `src/ai/`)**
- Defines how the gateway converges with existing engines (C1–C5: adapters → policy →
  tools → plugins/events → surface consolidation + review). Bounded-coexistence rows
  (registry namespaces, supervisor, routing seam) are decisions, not gaps.
- **Sequencing:** convergence does not begin until P3 ships; C1 depends on P3; C5 has a
  fixed date + CEO gate on the duplication report. This plan is part of the same commit
  bundle as the spec + assessments so the strategy is locked before P0.

### 21. `DEEP-AUDIT.md` → keep at `docs/dev-code-impl/AI-gtewwaay/`
- **Status: adopted (docs stay with the spec, NOT copied into `src/ai/`)**
- Repo-evidence verification of CONVERGENCE-PLAN C1–C5. Verdict: strangler-fig
  direction + gate discipline sound; **four plan premises reference surfaces that do not
  match runtime reality** → 12 required revisions (R-1..R-12) must be folded into the plan
  before P0:
  - R-4 (C3): `ToolUseProtocolImpl.executeTool` has **zero** prod call sites; the real
    tool-execution path is `McpClientAdapter.callTool` (6 sites / 4 engines). The C3
    no-bypass gate must grep `\.callTool\(`, and the bridge must be a callTool-level
    facade the 4 engines inject.
  - R-6/R-7 (C4): `PluginManagerImpl` is latent (never instantiated); three
    "plugin/registry" systems exist and the live one is `config/provider-registry.ts`
    (a config cache, not a plugin engine).
  - R-8 (C5): a **third** router (`src/router/router.ts`, RouterStore-backed) sits between
    `IRouter` and `ProviderMuxEngine` and is the one wired at boot.
  - R-9 (C5): `OpenCodeSupervisor` IS a TS-layer process spawner (`Bun.spawn` of
    `opencode serve`) — a third supervisor boundary the plan's "never spawns" framing missed.
  - R-1 (C1): `IPolicyEnforcer` egress DoA must scope to LLM provider-execution only;
    ~40 pre-existing non-adapter `fetch(` egress points exist across telemetry/CDP/MCP/update.
- Full revision list: DEEP-AUDIT.md §6. These are fold-in items for CONVERGENCE-PLAN.md,
  executed as an amendment to the plan before P0 begins.

---

## Adjustment Buckets (grouped)

| Bucket | Files | Notes |
|---|---|---|
| Mechanical (`.js` suffix + layout paths) | all 16 `.ts` | Single pass at P0 staging; no semantic change |
| Source remap (from `mnt/`) | `execution/types.ts`, `plugins/manager.ts` | Missing at root; pull from `mnt/` snapshot |
| Doc location | `ARCHITECTURE.md` → `src/ai/` | Content frozen |
| Config | `tsconfig.json` | Align to repo; likely dropped in favor of root |
| Rejected | none | No design file rejected outright at assessment time |
| Deferred | `execution/types.ts` naming/casing of `ExecutionState` vs `AIExecution.state` | No change needed; noted for M2 impl review |

---

## Gate Discipline

- Every file is staged in P0 with the **mechanical** adjustments ONLY.
- No **semantic** adjustment happens without a new ledger row citing the assessment
  (A1–A5) that justifies it.
- Re-run `verify-cross-surface` + `invariants check` after every phase (P0–P3).
