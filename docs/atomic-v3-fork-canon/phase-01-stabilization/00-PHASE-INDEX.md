# Phase 1: Stabilization & Cleanup

**Source:** v3 Phase 1 (`docs/atomic-v3/phase-01-stabilization/`)
**Units:** 12 | **Done:** 10 | **Pending:** 2
**Dependencies:** None (base phase)

## Units

| ID | Name | Status | File |
|----|------|--------|------|
| 1.1 | Remove provider-logic/ legacy directory | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.1-remove-provider-logic.md` |
| 1.2 | Wire AutonomousExecutionEngine into server bootstrap | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.2-wire-autonomous-bootstrap.md` |
| 1.3 | Complete UnifiedCapabilityRegistry bootstrap with defaults | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.3-capability-bootstrap.md` |
| 1.4 | Eliminate all stub markers in engines | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.4-eliminate-stubs.md` |
| 1.5 | Replace `as never` and `as any` in engines | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.5-remove-any.md` |
| 1.6 | Replace raw `new Error()` with CapStoreError subclasses | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.6-error-classes.md` |
| 1.7 | Fix TelemetryAggregator SQL dialect (Postgres → SQLite) | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.7-sqlite-dialect.md` |
| 1.8 | Wire KnowledgeIngestion to actually extract entities | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.8-knowledge-extract-wiring.md` |
| 1.9 | Replace MuxDispatcher stub with real provider dispatch | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.9-real-mux-dispatcher.md` |
| 1.10 | Consolidate test fixtures and mock helpers | `[x]` | `docs/atomic-v3/phase-01-stabilization/1.10-consolidate-mocks.md` |
| 1.11 | Achieve 80% coverage on src/engines, 85% on src/server | `[ ]` | `docs/atomic-v3/phase-01-stabilization/1.11-coverage-target.md` |
| 1.12 | Establish v3 baseline: green devops gate | `[ ]` | `docs/atomic-v3/phase-01-stabilization/1.12-v3-baseline.md` |
