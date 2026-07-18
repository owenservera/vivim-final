# PRD-12: Provider Onboarding Mode System + Automation Activity Log

**Phase:** 12 of N (integration track — single coherent spec)
**Agent Assignment:** One agent (build only — no parallel split required)
**Depends On:** PRD-01 (ID Bridge), PRD-08 (Unified CLI)
**Supersedes:** draft PRDs 11, 12, 13

---

## 1. Context

The earlier draft modeled provider onboarding as a **linear one-shot pipeline** (discover → seed → verify → converge). Reality: onboarding is a **recurring, multi-mode operating system**. The `runtime-test` CLI is already mode-driven (`bootstrap`, `preflight`, `discover`, `engage`, `test-cap`, `selectors`, `verify`, `build`, `loop`) and the `loop` is ledger-driven (recurring, resumable). Onboarding should follow that exact shape as a new `runtime-test onboard <mode>` subcommand group.

Two further requirements emerged during design:
1. **Static phase map** — a goal like *"onboard chatgpt.com with full frontend capability"* decomposes via a fixed, predictable phase list (not NL-driven), matching the existing loop style.
2. **Full-system activity logging** — every automation run (onboarding AND the broader devops/speckit loops) must record activity **structurally**: every LLM command, every captured stream, every selector probe, every parse result. This enables post-mortems on the automation system itself so it can be improved holistically. This is NOT onboarding-specific — it is a unified **automation activity log** composing with the existing `AuditTrail` engine (Unit 9.4) and `CapabilityEventBus`.

Existing assets to **compose with** (not duplicate):
- `src/engines/protocol-discovery.ts` — `ProtocolDiscoveryEngine` (CDP composer/send/framework probe).
- `src/engines/provider-discovery.ts` + `manifest-inference.ts` — `ProviderDiscoveryEngine` (Phase 22.5) + `ManifestInferenceEngine` (Phase 22.6) with session/store persistence and per-field confidence.
- `src/engines/audit-trail.ts` — `AuditTrail` + `AuditSink`/`AuditEntry` (the log substrate).
- `devops/runtime-test/iterate.ts` + `loop-state.ts` — ledger pattern to mirror.
- `devops/speckit-converge-bridge.ts` — `unifiedConverge` (appends gaps as SpecKit tasks).

## 2. User Stories

### US1 — Goal Decomposes to a Static Phase List (P0)
**As an** agent given a goal like "onboard chatgpt.com with full frontend capability",
**I want** `onboard run --goal=...` to decompose it into a fixed ordered phase list,
**So that** the plan is predictable and resumable.

**Acceptance Scenarios:**
1. Given `--goal="onboard chatgpt.com with full frontend capability"`, when run, then the phase list is exactly `[discover, infer, test-selectors, test-parse, test-cap, test-frontend, verify, converge]`.
2. Given `--from=test-parse`, when run, then only phases from `test-parse` onward execute (skips discover/infer/test-selectors).
3. Given `--resume`, when run, then the ledger's last completed phase is read and execution continues from the next phase.

### US2 — Each Mode Runs Independently (P0)
**As an** operator debugging a single phase,
**I want** `runtime-test onboard <mode> --provider=<slug> [--url=...]` to run just that mode,
**So that** I can re-run `test-selectors` without re-running `discover`.

**Acceptance Scenarios:**
1. Given `onboard test-selectors --provider=chatgpt`, when run, then only selector validation executes and a per-selector confidence map is printed.
2. Given an unknown mode, when run, then usage is printed and exit code 1.

### US3 — Discover Probes the Provider (P1)
**As an** agent onboarding a provider,
**I want** `onboard discover --url=https://chatgpt.com` to return a `manifestDraft` with composer/send/framework,
**So that** I have the structural skeleton before inference.

**Acceptance Scenarios:**
1. Given a live URL + Chrome, when discover runs, then it returns the `ProtocolDiscoveryEngine` result (composer selector, send selector, framework, `manifestDraft`).

### US4 — Infer Seed + Parser from Draft + Traffic (P1)
**As an** agent onboarding a provider,
**I want** `onboard infer` to combine the discovery draft + a captured stream into a seed JSON skeleton and parser JS with per-field confidence,
**So that** only models/exotic capabilities need manual edit.

**Acceptance Scenarios:**
1. Given a `manifestDraft` + a captured SSE body, when infer runs, then a `seeds/providers/<slug>.json` skeleton is produced with `parsers[0].logic_code` filled by `StreamingResponseAnalyzer`.
2. Given a field with confidence < 0.7 (e.g., models), when infer runs, then the field is marked `TODO` and a convergence task is appended.

### US5 — Test Selectors with Confidence Gate (P0)
**As an** agent onboarding a provider,
**I want** `onboard test-selectors` to validate every selector in a live browser and emit per-selector confidence,
**So that** broken selectors are caught, not shipped.

**Acceptance Scenarios:**
1. Given a selector resolving at confidence 0.85, when tested, then it passes.
2. Given a selector at 0.6 (< 0.8 threshold), when tested, then the mode **halts**, records a `TODO` convergence task, and reports the failure (does not silently proceed).

### US6 — Test Parser against Captured Traffic (P1)
**As an** agent verifying a generated parser,
**I want** `onboard test-parse` to run the parser on captured raw bodies and verify content blocks,
**So that** parser correctness is checked before seeding.

**Acceptance Scenarios:**
1. Given a valid SSE body + generated parser, when tested, then blocks are reproduced and `passed: true`.
2. Given a parser with confidence 0.5 (< 0.7 threshold), when gated, then the mode **halts** and appends a convergence task.

### US7 — Test Capability End-to-End (P1)
**As an** agent onboarding a provider,
**I want** `onboard test-cap --cap=send_message` to execute the registered capability against the live provider,
**So that** the capability actually works.

**Acceptance Scenarios:**
1. Given a seeded provider + live Chrome, when `test-cap send_message` runs, then the message is sent and the result is reported.

### US8 — Test Frontend Automation (P1)
**As an** agent onboarding a provider with frontend capability,
**I want** `onboard test-frontend` to mount the canvas layer, click the capability, and assert the DOM updates,
**So that** the frontend surface is verified.

**Acceptance Scenarios:**
1. Given a registered `send_message` UI capability, when test-frontend runs, then the canvas layer mounts, the capability is invoked, and a DOM assertion confirms the composer received input.

### US9 — Verify Full-Stack + Converge (P1)
**As an** agent completing onboarding,
**I want** `onboard verify` to orchestrate seed→capability→parse→frontend and `onboard converge` to append gaps + run the unified gate,
**So that** the feature is validated before being declared done.

**Acceptance Scenarios:**
1. Given all prior modes passed, when verify runs, then cross-surface resolution is checked (`verify-cross-surface`).
2. When converge runs, then `unifiedConverge(featureDir)` appends any P0/P1 findings as SpecKit tasks and the unified gate runs.

### US10 — All Automation Activity Is Logged Structurally (P0)
**As an** engineer improving the automation system,
**I want** every onboarding/loop run to record each LLM command, stream capture, selector probe, and parse result into a unified activity log,
**So that** I can post-mortem the automation holistically.

**Acceptance Scenarios:**
1. Given any `onboard` mode runs, then an `AuditEntry` is emitted per activity (action=`onboard.discover`/`onboard.test-selectors`/etc., with structured `details` incl. confidence, selector, rawBodyHash, llmCommand).
2. Given the `loop` runs, then each iteration step also emits an `AuditEntry` (action=`loop.step`, details incl. objective, proposedStep, checks).
3. Given a query, when the activity log is read back, then entries are filterable by `action`, `targetType`, and time range for post-mortem.

### US11 — Confidence Gates Halt + Append Convergence Task (P0)
**As an** agent running the onboarding sequence,
**I want** a failed gate (selector < 0.8 / parser < 0.7) to halt and append a convergence task via the ledger,
**So that** the sequence never silently ships broken artifacts.

**Acceptance Scenarios:**
1. Given `onboard run --goal=...` and `test-selectors` fails its gate, then the run stops at `test-selectors`, a convergence task is appended, and the ledger records the failure so `--resume` re-runs from `test-selectors`.

### US12 — Provider Row in DECISION-TABLE (P2)
**As an** agent deciding which system to use,
**I want** a "New webapp provider" row in `DECISION-TABLE.md` pointing to the onboarding mode system,
**So that** onboarding consistently uses the SpecKit+DevOps path.

## 3. Functional Requirements

- **FR-001**: System MUST provide `devops/onboard-controller.ts` exporting `runOnboard(opts)` dispatching modes + a static `decomposeGoal(goal): OnboardPhase[]`.
- **FR-002**: `OnboardPhase` list (static order): `discover, infer, test-selectors, test-parse, test-cap, test-frontend, verify, converge`.
- **FR-003**: `runOnboard` MUST support `--goal`, `--provider`, `--url`, `--from=<phase>`, `--resume`.
- **FR-004**: Each mode MUST be runnable standalone via `runtime-test onboard <mode>`.
- **FR-005**: `onboard discover` MUST delegate to `ProtocolDiscoveryEngine`.
- **FR-006**: `onboard infer` MUST compose `ManifestInferenceEngine` + `StreamingResponseAnalyzer` and emit a seed JSON skeleton with per-field confidence (`TODO` for fields < 0.7).
- **FR-007**: `onboard test-selectors` MUST validate selectors via CDP and emit a per-selector confidence map.
- **FR-008**: `onboard test-parse` MUST run `ParserTestHarness` against captured traffic.
- **FR-009**: `onboard test-cap` MUST delegate to existing `test-cap` execution.
- **FR-010**: `onboard test-frontend` MUST mount canvas layer + invoke capability + assert DOM.
- **FR-011**: `onboard verify` MUST orchestrate prior modes + `verify-cross-surface`.
- **FR-012**: `onboard converge` MUST call `unifiedConverge(featureDir)` + `runUnifiedGate`.
- **FR-013**: Selector gate threshold default **0.8**; parser gate threshold default **0.7** — both configurable via `--min-confidence`.
- **FR-014**: On gate failure, `runOnboard` MUST halt, append a convergence task to the ledger, and record the failure in the activity log.
- **FR-015**: System MUST provide `devops/automation-activity-log.ts` composing with `AuditTrail` — a singleton `automationLog` with `activity(action, targetType, details)` helper. All onboard modes + the `loop` MUST emit entries.
- **FR-016**: The activity log MUST support query by `action`/`targetType`/time range (`queryActivity(filter)`).
- **FR-017**: `devops/selector-tester.ts` MUST expose `testSelectors(provider, selectors): Promise<SelectorConfidenceMap>`.
- **FR-018**: `devops/frontend-automation-tester.ts` MUST expose `testFrontend(provider, cap): Promise<FrontendTestResult>`.
- **FR-019**: `runtime-test orchestration.ts` (the `loop`) MUST emit an `AuditEntry` per iteration step via `automationLog`.
- **FR-020**: `DECISION-TABLE.md` MUST gain a "New webapp provider" row.
- **FR-021**: A SpecKit provider-onboarding template MUST exist at `.specify/templates/provider-onboarding/`.

## 4. Key Entities

- **OnboardPhase**: `'discover'|'infer'|'test-selectors'|'test-parse'|'test-cap'|'test-frontend'|'verify'|'converge'`
- **OnboardingLedger**: `{ goal: string; provider: string; phases: Array<{ phase: OnboardPhase; status: 'pending'|'running'|'done'|'failed'; detail?: string; startedAt?: number; finishedAt?: number }>; createdAt: number }`
- **SelectorConfidenceMap**: `{ [selector: string]: { resolved: boolean; confidence: number; evidence: string[] } }`
- **AutomationActivityEntry**: reuses `AuditEntry` (action like `onboard.discover`, `loop.step`; details carry confidence/selector/rawBodyHash/llmCommand).

## 5. Technical Design

### 5.1 Mode → tooling map (in `onboard-controller.ts`)

```
discover        → ProtocolDiscoveryEngine.discover(url)
infer           → ManifestInferenceEngine.infer(draft) + StreamingResponseAnalyzer.analyze(captured)
test-selectors  → SelectorTester.testSelectors(provider, selectors)   [gate 0.8]
test-parse      → ParserTestHarness.runParserTest(parser, captured)    [gate 0.7]
test-cap        → existing testCapability(slug, input)
test-frontend   → FrontendAutomationTester.testFrontend(provider, cap)
verify          → orchestrate above + verify-cross-surface
converge        → unifiedConverge(featureDir) + runUnifiedGate
```

### 5.2 Ledger (mirror `loop-state.ts`)

`devops/onboard-ledger.ts`: `initOnboardLedger(goal, provider)`, `loadOnboardLedger()`, `saveOnboardLedger(state)`, `markPhase(phase, status, detail)`, persisted to `.runtime/onboard-ledger.json`.

### 5.3 Activity log (compose `AuditTrail`)

`devops/automation-activity-log.ts`:
```typescript
import { AuditTrail } from '../src/engines/audit-trail.js'
import { FileAuditSink } from './activity-sink.js'   // appends JSONL to .runtime/activity.log

export const automationLog = new AuditTrail()
automationLog.addSink(new FileAuditSink('.runtime/activity.log'))

export function activity(action: string, targetType: string, details: Record<string, unknown>) {
  automationLog.record({ actor: 'automation', action, targetType, result: 'success', details })
}
```

- `OnboardController` calls `activity('onboard.discover', 'provider', { url, confidence, manifestDraftKeys })` etc.
- `iterate.ts` (loop) calls `activity('loop.step', 'iteration', { objective, proposedStep, checks })`.

### 5.4 Confidence gate helper (new `devops/confidence-gate.ts`)

```typescript
export interface GateResult { passed: boolean; field: string; score: number; threshold: number }
export function confidenceGate(field: string, score: number, threshold: number): GateResult {
  return { passed: score >= threshold, field, score, threshold }
}
```

### 5.5 CLI wiring (`devops/index.ts`)

```
runtime-test onboard <mode> [--provider=<slug>] [--url=<url>] [--goal="..."] [--from=<phase>] [--resume] [--min-confidence=<n>]
```

## 6. Constitution Check

- [ ] Governor Canon: CDP only via `ProtocolDiscoveryEngine`/`ChromeGovernor`; new testers never import `BunCdpClient` directly except through governor.
- [ ] One Entry Point: modes invoked via `bun run devops` CLI — no second transport.
- [ ] Store Contracts: activity log + ledger are filesystem (`.runtime/`), not DB — no store contract.
- [ ] TypeScript strict, no `any`.

## 7. Testing Requirements

### Unit Tests
- `onboard-controller.test.ts`: `decomposeGoal` returns static order; `--from`/`--resume` slicing works.
- `confidence-gate.test.ts`: passes above, fails below threshold.
- `parser-test-harness.test.ts`: pass + fail (`[DONE]` mishandling) cases.
- `streaming-response-analyzer.test.ts`: SSE/websocket/unknown classification + `logicCode` generation.
- `selector-tester.test.ts`: resolved/passed map (mock CDP).
- `frontend-automation-tester.test.ts`: mount+click+assert (mock canvas).
- `automation-activity-log.test.ts`: entries emitted + `queryActivity` filters.

### Integration Test
- Run `onboard run --goal=...` against fixture data (recorded CDP + captured SSE) end-to-end; assert ledger + activity log populated.

## 8. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `devops/onboard-controller.ts` | CREATE | Mode dispatcher + decomposer |
| `devops/onboard-ledger.ts` | CREATE | Resumable ledger |
| `devops/confidence-gate.ts` | CREATE | Gate helper |
| `devops/automation-activity-log.ts` | CREATE | Activity log (compose AuditTrail) |
| `devops/activity-sink.ts` | CREATE | JSONL file sink |
| `devops/selector-tester.ts` | CREATE | CDP selector validation |
| `devops/frontend-automation-tester.ts` | CREATE | Canvas mount + assert |
| `devops/parser-test-harness.ts` | CREATE (draft exists) | Parser verification |
| `src/engines/streaming-response-analyzer.ts` | CREATE (draft exists) | Parser inference |
| `devops/index.ts` | MODIFY | Wire `onboard` subcommand + loop activity logging |
| `devops/runtime-test/iterate.ts` | MODIFY | Emit activity entries per step |
| `docs/integration/DECISION-TABLE.md` | MODIFY | Add provider row |
| `.specify/templates/provider-onboarding/` | CREATE | SpecKit template |
| `tests/unit/devops/*.test.ts` | CREATE | Unit tests |

## 9. Success Criteria

- [ ] `onboard run --goal="..."` decomposes to the 8 static phases and runs them in order.
- [ ] Each mode runs standalone via `runtime-test onboard <mode>`.
- [ ] `--from`/`--resume` skip/recover correctly using the ledger.
- [ ] Selector gate halts below 0.8; parser gate halts below 0.7; both append convergence tasks.
- [ ] Every mode + loop step emits a structured `AuditEntry` to the activity log; `queryActivity` filters work.
- [ ] `infer` composes `ManifestInferenceEngine` + `StreamingResponseAnalyzer`; seed skeleton has parsers filled, TODOs for low-confidence fields.
- [ ] `DECISION-TABLE.md` has a provider row; SpecKit template exists.
- [ ] `bun run typecheck` and `bun test tests/unit/devops` pass.

## 10. Parallelization Notes

**Single agent build** — no split required. Implementation order:
1. `automation-activity-log.ts` + `activity-sink.ts` + `confidence-gate.ts` (foundations)
2. `streaming-response-analyzer.ts` + `parser-test-harness.ts`
3. `selector-tester.ts` + `frontend-automation-tester.ts`
4. `onboard-ledger.ts` + `onboard-controller.ts`
5. CLI wiring + `iterate.ts` logging
6. template + DECISION-TABLE
7. tests + typecheck + lint
