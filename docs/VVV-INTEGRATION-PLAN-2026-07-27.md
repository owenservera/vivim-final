# VVV Integration Plan — 2026-07-27

## Audit Summary

| Metric | Count |
|--------|-------|
| Total same-named `.ts` files | 725 |
| Both repos have | 580 |
| vvv only (new files) | 2 |
| vivim only (unique) | 143 |
| vvv enhancements (more code) | 9 |
| vvv regressions (less code) | 3 |

## Enhancement Analysis

### Tier 1: High-Value Integrations (audit fixes + real features)

These files have meaningful vvv additions that fix bugs or add functionality.

#### 1. `agent-canvas-router.ts` (+14 lines) — EventBus canvas commands
- **vvv adds:** Replaces 501 `SERVER_EXECUTOR_UNAVAILABLE` with EventBus emission for canvas commands. Adds NLCL engine interpretation for `/api/agent/canvas/plan` endpoint.
- **vivim has:** The 501 stub approach (canvas commands require frontend executor).
- **Decision:** Port vvv's EventBus approach. The server CAN emit events that the frontend subscribes to via SSE. This closes the 501 gap.
- **Risk:** Medium — EventBus shape varies; defensive emit needed.
- **Action:** Port the EventBus emission + plan interpretation logic.

#### 2. `canvas-engine.ts` (+16 lines) — imageGen injection
- **vvv adds:** `imageGen` dependency injection for `cap:canvas:set_background` to resolve `imageQuery` params end-to-end. Audit fix G.1/16.1.
- **vivim has:** No imageGen — the capability throws `Error('Either imageBase64 or imageQuery must be provided')` even when imageQuery IS provided.
- **Decision:** Port the imageGen injection. This is a real bug fix.
- **Risk:** Low — additive dependency injection pattern.
- **Action:** Add `imageGen` to `CanvasEngineDeps`, wire through to service.

#### 3. `api-types.ts` (+45 lines) — AsyncCapabilityResult + GenerativeTaskStatus
- **vvv adds:** `AsyncCapabilityResult` interface + `isAsyncCapabilityResult` type guard + `GenerativeTaskStatusResponse` types.
- **vivim has:** No async capability result types.
- **Decision:** Port these types. They're needed for long-running capabilities (onboarding, generative tasks).
- **Risk:** Low — pure type additions.
- **Action:** Add the 3 new interfaces + type guard.

#### 4. `interpret-router.ts` (+28 lines) — wrapCommandResultAsInterpretResponse
- **vvv adds:** `wrapCommandResultAsInterpretResponse()` helper + A.2 audit fix (unified response shape between `/api/interpret` and `/api/nlcl/interpret`).
- **vivim has:** Different confirmation flow approach in the router.
- **Decision:** Port the wrapper function. The audit fix ensures one envelope, one token, one shape.
- **Risk:** Low — the wrapper is additive.
- **Action:** Add `wrapCommandResultAsInterpretResponse()` export.

### Tier 2: Low-Value Integrations (formatting + stubs)

These files have minor differences that are mostly formatting or stub methods.

#### 5. `autonomous-store-impl.ts` (+21 lines) — task template stubs
- **vvv adds:** `getTaskTemplate`, `insertTaskTemplate`, `updateTaskTemplate`, `listTaskTemplates` stubs that throw 'Not implemented'.
- **vivim has:** No task template methods.
- **Decision:** Skip — stubs that throw are dead code. Port only if the `AutonomousExecutionStore` contract requires them.
- **Risk:** N/A — skipping.

#### 6. `autonomous-execution.ts` (+13 lines) — composite step formatting
- **vvv adds:** Composite step fields as optional (`parentStepId?: string | null`) + budget error formatting differences.
- **vivim has:** Same fields but non-optional + slightly different error formatting.
- **Decision:** Skip — vivim's version is stricter (non-optional fields). The formatting differences are cosmetic.
- **Risk:** N/A — skipping.

#### 7. `capability-store-impl.ts` (+12 lines) — verbose type annotations
- **vvv adds:** More verbose inline type annotations for Prisma query results.
- **vivim has:** Same logic with slightly compressed type annotations.
- **Decision:** Skip — vivim's approach is more concise. No functional difference.
- **Risk:** N/A — skipping.

#### 8. `canvas-router.ts` (+15 lines) — conceptual model resolution
- **vvv adds:** Expanded TypeScript types for `resolveFamilyForProvider` and `resolveSurface`.
- **vivim has:** Same logic but compressed into fewer lines.
- **Decision:** Skip — vivim's approach works and is more concise.
- **Risk:** N/A — skipping.

#### 9. `agent-canvas.ts` (+48 lines) — complementary types
- **vvv adds:** `AgentCanvasPlan`, `AgentCanvasOpStatus`, `AgentCanvasOpAction`, `AgentCanvasNodeSpec`, `AgentCanvasPlanStatus` types.
- **vivim has:** Different types (`AgentCanvasCommand`, `AgentCanvasResponse`) — these are COMPLEMENTARY, not conflicting.
- **Decision:** Port the new types. They're needed for the agent canvas plan flow (used by `agent-canvas-router.ts`).
- **Risk:** Low — pure type additions.
- **Action:** Add the 5 new type exports.

## Integration Plan

### Phase 1: Type Additions (low risk, high value)

| Step | File | Action | Risk |
|------|------|--------|------|
| 1.1 | `src/schema/api-types.ts` | Add `AsyncCapabilityResult`, `isAsyncCapabilityResult`, `GenerativeTaskStatusResponse` | Low |
| 1.2 | `src/shared/agent-canvas.ts` | Add `AgentCanvasPlan`, `AgentCanvasOpStatus`, `AgentCanvasOpAction`, `AgentCanvasNodeSpec`, `AgentCanvasPlanStatus` | Low |

### Phase 2: Bug Fixes (medium risk, high value)

| Step | File | Action | Risk |
|------|------|--------|------|
| 2.1 | `src/canvas/canvas-engine.ts` | Add `imageGen` dependency injection | Low |
| 2.2 | `src/server/interpret-router.ts` | Add `wrapCommandResultAsInterpretResponse()` export | Low |

### Phase 3: Feature Integration (medium risk, high value)

| Step | File | Action | Risk |
|------|------|--------|------|
| 3.1 | `src/server/agent-canvas-router.ts` | Port EventBus emission + plan interpretation | Medium |
| 3.2 | `src/server/canvas-router.ts` | Expand conceptual model types (if needed by 3.1) | Low |

### Phase 4: Verification

| Step | Action |
|------|--------|
| 4.1 | `bun run typecheck` — verify all new types resolve |
| 4.2 | `bun test tests/unit/engines/nlcl/` — verify NLCL suite passes |
| 4.3 | `bun test tests/e2e/nlcl-golden.test.ts` — verify golden tests pass |
| 4.4 | `bun test tests/unit/canvas/` — verify canvas tests pass |

## Files NOT to Integrate

| File | Reason |
|------|--------|
| `autonomous-store-impl.ts` | Stubs that throw — dead code |
| `autonomous-execution.ts` | vivim has stricter types (non-optional fields) |
| `capability-store-impl.ts` | Cosmetic formatting differences only |

## New Files in vvv

| File | Lines | Decision |
|------|-------|----------|
| `variant-router.test.ts` | 247 | Skip — test file for vvv-specific feature |
| `template-router.test.ts` | 145 | Skip — test file for vvv-specific feature |

## Summary

- **Port:** 6 files (2 type additions, 2 bug fixes, 2 feature integrations)
- **Skip:** 5 files (formatting/stubs/dead code)
- **Total new code:** ~170 lines
- **Estimated effort:** 30-45 minutes

## Completion Status ✅

**Completed: 2026-07-27**

### All Phases Done

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Type Additions | ✅ | api-types.ts, agent-canvas.ts |
| Phase 2: Bug Fixes | ✅ | canvas-engine.ts, interpret-router.ts |
| Phase 3: Feature Integration | ✅ | agent-canvas-router.ts (EventBus + NLCL plan) |
| Phase 4: Verification | ✅ | 270 tests pass, 0 failures |

### Test Results

| Suite | Result |
|-------|--------|
| NLCL golden (6) | ✅ 6/6 |
| NLCL unit (169) | ✅ 169/169 |
| Canvas unit (95) | ✅ 95/95 |
| **Total verified** | **270 pass, 0 fail** |

### Artifacts

| File | Purpose |
|------|---------|
| `.runtime/compare-repos.ts` | Automated gap audit script |
| `.runtime/gap-audit-report.json` | Full JSON report |
| `docs/gap-audit-report.json` | Reference copy |
| `docs/VVV-INTEGRATION-PLAN-2026-07-27.md` | This file |
- **Risk level:** Low-Medium
