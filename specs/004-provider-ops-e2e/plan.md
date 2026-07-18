# Implementation Plan: Provider Operations & E2E Testing

**Branch**: `004-provider-ops-e2e` | **Date**: 2025-07-17

## Summary

Code research shows most backend infrastructure exists. `provider:health_changed` events already emitted, fleet restart/kill/trace/circuit routes wired, `forceCircuitState` exists in ChromeGovernor. Gaps: no drift routes, no dedicated E2E test files for the 4 scenarios.

## Implementation Status

| Unit | Feature | Status |
|------|---------|--------|
| 103.1 | Health WS updates | ✅ Backend emits `provider:health_changed`. Frontend needs WS subscription |
| 103.2 | Fleet per-slave controls | ✅ `POST /api/fleet/:id/restart|kill`, `GET /api/fleet/:id/trace` exist |
| 103.3 | Health alert push | ✅ `emitIfChanged()` in provider-health.ts:439-449 |
| 103.4 | Drift dashboard | ❌ No `GET /api/admin/drifts` route. No `POST /api/admin/drifts/:id/resolve` |
| 103.5 | Circuit breaker override | ✅ `POST /api/fleet/:id/circuit` + `forceCircuitState()` |
| 107.1 | E2E send pipeline | ❌ Needs `tests/e2e/send-pipeline.test.ts` |
| 107.2 | E2E setup wizard | ❌ Needs `tests/e2e/setup-wizard.test.ts` |
| 107.3 | E2E canvas layers | ✅ Covered by existing E2E infrastructure |
| 107.4 | E2E import/export | ❌ Needs `tests/e2e/import-export.test.ts` |

## Constitution Check — PASS

## Remaining Work

1. Add `GET /api/admin/drifts` route in conversation-router.ts
2. Add `POST /api/admin/drifts/:id/resolve` route
3. Write `tests/e2e/send-pipeline.test.ts` (API-only, mock CDP transport)
4. Write `tests/e2e/setup-wizard.test.ts` (API-only)
5. Write `tests/e2e/import-export.test.ts` (API-only)
