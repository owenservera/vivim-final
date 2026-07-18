# PRD-12: Active-Loop Bridge Wiring & Confidence Gates

**Phase:** 12 of N (integration track extension)
**Agent Assignment:** Agent B
**Depends On:** PRD-01 (ID Bridge), PRD-08 (Unified CLI)
**Blocks:** PRD-11 (Provider Onboarding Lifecycle)

---

## 1. Context

The six bridge modules (`speckit-bridge.ts`, `unified-gate.ts`, `research-bridge.ts`, `tracker-speckit-sync.ts`, `speckit-converge-bridge.ts`, `speckit-audit.ts`) exist and are accessible via `bun run devops speckit <subcommand>` (PRD-08). But the **active devops loops never call them**. Specifically:

- `devops runtime-test loop` (`orchestration.ts`) finishes without running `speckit converge`.
- `speckit sync` is not called after `implement` completes — tracker and `tasks.md` drift apart.
- The loop uses its own ad-hoc gates, never `speckit gate`.
- `discover-protocol` selector detection has no enforced confidence threshold — low-confidence selectors ship silently.

This PRD wires the bridge into the live loops and adds the two missing confidence gates (selector confidence, parser confidence).

## 2. User Stories

### US1 — Auto-Sync After Task Completion (P1)
**As an** agent running `implement`,
**I want** `speckit sync` to run automatically after each task is marked done,
**So that** the tracker and `tasks.md` never drift.

**Acceptance Scenarios:**
1. Given an `implement` run marking `T012` done, when it finishes, then `speckit sync` ran and the linked unit `2.1` shows done.
2. Given sync fails, when implement continues, then the failure is logged but does not abort implement.

### US2 — Auto-Converge After Implement Loop (P0)
**As an** agent completing a feature,
**I want** `speckit converge <featureDir>` to run at the end of the `runtime-test loop`,
**So that** spec/code/arch drift is caught before the feature is declared done.

**Acceptance Scenarios:**
1. Given a loop completing all phases, when it ends, then `speckit converge` ran and its report is attached to loop output.
2. Given converge finds gaps, when it appends tasks to `tasks.md`, then the loop reports "feature incomplete — N convergence tasks".

### US3 — Unified Gate in Standard Loop (P1)
**As an** agent running the build loop,
**I want** the loop to use `speckit gate --scope=phase` instead of ad-hoc checks,
**So that** there is one quality standard across SpecKit and DevOps.

**Acceptance Scenarios:**
1. Given a phase boundary in the loop, when reached, then `speckit gate --scope=phase` runs (typecheck+lint+test+invariants+audit+cross-surface).
2. Given a gate failure, when it occurs, then the loop halts the phase and reports the failing check.

### US4 — Selector Confidence Gate (P0)
**As an** agent onboarding a provider via `discover-protocol`,
**I want** a minimum selector confidence (default 0.8) enforced before a manifest is generated,
**So that** broken selectors are caught, not shipped.

**Acceptance Scenarios:**
1. Given a discovered selector with confidence 0.6, when the gate runs, then it halts and records a `TODO` for manual selector review.
2. Given all selectors ≥ 0.8, when the gate runs, then the manifest skeleton is produced.

### US5 — Parser Confidence Gate (P1)
**As an** agent generating a stream parser (PRD-13),
**I want** `parser.getConfidence()` ≥ 0.7 enforced before the parser is written to the seed,
**So that** low-confidence parsers are flagged for review.

**Acceptance Scenarios:**
1. Given a parser with confidence 0.5, when the gate runs, then the `parsers` field is marked `TODO` and a convergence task is appended.

## 3. Functional Requirements

- **FR-001**: `orchestration.ts` MUST call `speckit sync` after each `implement` task completion.
- **FR-002**: `orchestration.ts` MUST call `speckit converge <featureDir>` at loop end.
- **FR-003**: `orchestration.ts` MUST call `speckit gate --scope=phase` at each phase boundary.
- **FR-004**: `discover-protocol` MUST expose `selectorConfidence` per selector and accept `--min-confidence=<n>` (default 0.8).
- **FR-005**: A `confidenceGate()` helper MUST exist that halts and emits a convergence task when below threshold.
- **FR-006**: Parser inference (PRD-13) MUST be gated by `getConfidence() >= 0.7` via the same `confidenceGate()` helper.
- **FR-007**: All bridge invocations MUST be no-throw — failures are logged and surfaced in loop output, never abort the whole loop silently.

## 4. Key Entities

- **ConfidenceGateResult**: `{ passed: boolean, field: string, score: number, threshold: number, todo?: string }`
- **LoopGateReport**: `{ phase: string, gate: 'spec'|'selector'|'parser', result: ConfidenceGateResult }`

## 5. Technical Design

### 5.1 Wiring Points in `orchestration.ts`

```typescript
// after task marked done
await speckitSync({ featureDir })            // FR-001
// at phase boundary
await speckitGate({ scope: 'phase' })        // FR-003
// at loop end
const report = await speckitConverge({ featureDir })  // FR-002
loopOutput.converge = report
```

### 5.2 Confidence Gate Helper (new in `devops/speckit-bridge.ts` or `unified-gate.ts`)

```typescript
export function confidenceGate(opts: {
  field: string, score: number, threshold: number, featureDir: string
}): ConfidenceGateResult {
  const passed = score >= threshold
  if (!passed) appendConvergenceTask(opts.featureDir, `Manual review: ${opts.field} confidence ${opts.score} < ${opts.threshold}`)
  return { passed, field: opts.field, score: opts.score, threshold: opts.threshold }
}
```

### 5.3 Error Handling

- Bridge module unavailable: log "integration not initialized", continue loop.
- Gate threshold invalid (<0 or >1): default to 0.8, warn.
- Converge appends to a read-only spec dir: log, skip append, continue.

## 6. Constitution Check

- [ ] Store Contracts: bridge reads markdown, not DB — no store contract.
- [ ] No business logic in CLI — gate logic lives in bridge modules.
- [ ] TypeScript strict.

## 7. Testing Requirements

### Unit Tests
- Test `confidenceGate` passes above threshold, fails below, appends task on fail.
- Test orchestration calls sync after task done (mock bridge).
- Test orchestration calls converge at end (mock bridge).
- Test gate failure halts phase (mock bridge throwing).

### Integration Test
- Run a minimal `runtime-test loop` fixture with mocked browser; assert sync+gate+converge invoked in order.

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `devops/runtime-test/orchestration.ts` | MODIFY | Wire sync/gate/converge |
| `devops/unified-gate.ts` (or `speckit-bridge.ts`) | MODIFY | Add `confidenceGate` |
| `devops/protocol-discovery-engine.ts` | MODIFY | Expose `selectorConfidence`, `--min-confidence` |
| `tests/unit/devops/bridge-wiring.test.ts` | CREATE | Orchestration wiring tests |

## 9. Success Criteria

- [ ] Loop auto-syncs after task completion.
- [ ] Loop auto-converges at end.
- [ ] Loop uses `speckit gate` at phase boundaries.
- [ ] Selector confidence gate halts below 0.8.
- [ ] Parser confidence gate halts below 0.7.
- [ ] `bun run typecheck` and `bun test` pass.

## 10. Parallelization Notes

**Depends On:** PRD-01, PRD-08.
**Blocks:** PRD-11 (onboarding loop relies on the wired gates).
