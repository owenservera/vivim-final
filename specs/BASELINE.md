# Spec-Kit Baseline Status

**Date**: 2025-07-17  
**Mode**: Backend clean baseline achieved. Frontend UI work documented as deferred.

## Gate Results

| Gate | Result |
|------|--------|
| `devops invariants check --category B` | ✅ 0 violations |
| `devops verify-cross-surface` | ✅ 196/196 capabilities resolve |
| `bun test tests/unit/engines/consent-engine.test.ts` | ✅ 18/18 pass |
| `bun test tests/unit/engines/trust-score.test.ts` | ✅ 7/7 pass |

## Spec Status

| Spec | FRs | Backend | Frontend | Verdict |
|------|-----|---------|----------|---------|
| 001-production-hardening | 9/9 met | ✅ Clean | ✅ HITL gate exists | **READY** |
| 002-canvas-surface | 10/10 met | ✅ Router aligned, caps registered | ⚠️ Designer UI deferred | **READY** |
| 003-chat-advanced | 5/5 caps registered | ✅ All caps + search wired | ⚠️ 6 UI panels deferred | **READY** |
| 004-provider-ops-e2e | 9/12 met | ✅ Routes + E2E tests | ⚠️ 4 UI features deferred | **READY** |

## Files Under Management

```
specs/
├── 001-production-hardening/
│   ├── spec.md, plan.md, research.md, data-model.md
│   ├── quickstart.md, tasks.md, converge.md
│   └── contracts/consent-store.md, trust-score-dependencies.md
├── 002-canvas-surface/
│   ├── spec.md, plan.md, tasks.md, converge.md
│   └── (research/data-model/contracts/quickstart — not needed, backend existed)
├── 003-chat-advanced/
│   ├── spec.md, plan.md, tasks.md, converge.md
│   └── (backend already complete — no research artifacts needed)
├── 004-provider-ops-e2e/
│   ├── spec.md, plan.md, tasks.md, converge.md
│   └── (backend routes + E2E tests delivered)
├── .analyze.md           # Cross-spec consistency audit
└── .checklist.md         # 40 quality criteria
```

## New Code Delivered

| File | Type | Tests |
|------|------|-------|
| `tests/unit/engines/consent-engine.test.ts` | 18 unit tests | ✅ |
| `tests/unit/engines/trust-score.test.ts` | 7 unit tests | ✅ |
| `tests/e2e/send-pipeline.test.ts` | 5 E2E tests | Requires server |
| `tests/e2e/setup-wizard.test.ts` | 5 E2E tests | Requires server |
| `tests/e2e/import-export.test.ts` | 4 E2E tests | Requires server |
| `src/server/canvas-router.ts` | Router aligned + export/import/manifest | — |
| `src/server/conversation-router.ts` | Drift routes added | — |
| `src/canvas/canvas-agent-tools.ts` | layer_list/export/import caps | — |
| `src/engines/capability-bootstrap.ts` | provider_list_models cap | — |
| `CHANGELOG.md` | Phase 31 corrected | — |

## Ready for New Specs

The pipeline is clean. No pending backend tasks, no half-implemented code, no capability ID mismatches. To start a new feature:

```
/speckit.specify <description>
/speckit.plan
/speckit.tasks
/speckit.implement
/speckit.converge
```
