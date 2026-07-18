# Research: Production Hardening & Sovereign Trust

**Feature**: 001-production-hardening  
**Date**: 2025-07-17  

## Key Finding: Implementation State is Significantly More Advanced Than Documented

The workstream brief (`docs/workstreams/AGENT-1-PRODUCTION-HARDENING.md`) was written against an earlier audit snapshot. Code investigation reveals substantial implementation already exists.

---

## Decision 1: B1 (Governor Canon) — Already Resolved

**What the spec says**: `cdp-capability-registrar.ts` imports `BunCdpClient` directly.  
**Reality**: The file imports from `cdp-discovery.js` only: `import { type CdpMethodDescriptor, discoverCdpMethods } from './cdp-discovery.js'`. No `BunCdpClient` import found.

**Decision**: Verify with `bun run devops invariants check --category B` to confirm 0 B1 violations. If confirmed, mark as no-op.

**Rationale**: Code review confirms the violation is already resolved. The workstream brief predates the fix.

**Alternatives considered**: Refactoring to use `ChromeGovernor.cdp` proxy — not needed, file uses `cdp-discovery.js` which is declarative (protocol method discovery, no CDP connection).

---

## Decision 2: B7 (Raw Error Violations) — Needs Verification

**What the spec says**: 8 engine files use raw `new Error()`.  
**Reality**: Extensive custom error hierarchy exists in `src/errors.ts` (175 lines, 20+ error classes). Most engines already use typed errors. The actual count of raw `new Error()` calls is unknown.

**Decision**: Run `bun run devops invariants check --category B` to get the current B7 file list. Replace any remaining raw `new Error()` calls.

**Rationale**: Custom error infrastructure is already in place. The gap is likely smaller than 8 files.

---

## Decision 3: ConsentEngine — Already Implemented

**What the spec says**: Build `ConsentEngine` from scratch (unit 106.1).  
**Reality**: `src/engines/consent-engine.ts` exists with:
- `ConsentEngine` class with `check()`, `grant()`, `revoke()`, `isAllowed()`
- `ConsentConfig` interface with `defaultDeny`, `requireApprovalAbove`
- `ConsentStore` interface for persistence
- In-memory grant map with optional DB store
- `CLASSIFICATION_RANK` ordering (read:0, write:1, navigate:2, destructive:3, financial:4)
- `require()` method that throws `ConsentViolationError`

**Decision**: No new engine needed. Focus on testing (unit test for consent-engine) and verifying wiring in `capability-bootstrap.ts`.

**Rationale**: Engine is already built to spec.

---

## Decision 4: TrustScoreEngine — Already Implemented

**What the spec says**: Build `TrustScoreEngine` from scratch (unit 106.2).  
**Reality**: `src/engines/trust-score.ts` exists with:
- `TrustScoreEngine` class with `computeProviderScore()`
- `TrustFactor` and `TrustReport` types
- 6-factor weighting: successRate(40), latency(20), selectorHealth(15), circuitState(10), authFreshness(10), driftStatus(5)
- DB-backed via `CapStoreDb` (reads `outcome`, `selector_strategy`, `circuit_breaker_state`, `provider_account`, `manifest_drift` tables)
- `gatherFactors()` computes each factor from DB queries

**Decision**: No new engine needed. Focus on testing.

**Rationale**: Engine is already built to spec. Method names differ from spec (`computeProviderScore` vs spec's `computeProviderScore` — same name; `gatherFactors` is private vs spec's `getFactors` which was public — minor API difference).

---

## Decision 5: Consent Gate Wiring — Already Done

**What the spec says**: Wire consent gate to all classified capabilities (unit 106.3).  
**Reality**: `capability-bootstrap.ts` lines 1245-1277 already:
- Defines `gatedCapIds` set (8 capabilities including `conversation:send`, `conversation:delete`, `memory:assert`, `user:delete_profile`, `admin:seed`, `admin:db_reset`, `discovery:run`, `oracle:heal`)
- Wraps each gated handler with `consent.require({ classification, target: cap.id })`
- Uses `ConsentEngine` with `requireApprovalAbove: 'write'`

**Decision**: Verify the list matches spec (spec lists `conversation:send`, `conversation:delete`, `memory:assert`, `user:delete_profile`, `admin:seed`, `admin:db_reset`, `discovery:run`, `oracle:heal`). Add any missing.

**Rationale**: Wiring already matches spec closely. May need minor additions.

---

## Decision 6: Trust Scoring in ProviderHealthKernel — Already Wired

**What the spec says**: Wire trust score as 8th signal with 10% weight.  
**Reality**: `provider-health.ts` already:
- `SIGNAL_WEIGHTS` includes `trustScore: 10`
- Existing weights adjusted (parserConfidence:25, emptyStreams1h:15, selectorHitRate:20) — total still 100%
- `ProviderHealthKernelOptions` accepts `trustScoreEngine?: TrustScoreEngine`
- `computeProviderScore()` in the health kernel reads trust score (line 168-170)
- Trust score signal computed at line 394-402 with fallback to 50 when engine unavailable

**Decision**: No wiring needed. Verify integration test.

**Rationale**: Already fully wired with proper fallback behavior.

---

## Decision 7: HITL Gate UI — Already Exists

**What the spec says**: Create `web/sandbox/src/features/hitl-gate.tsx`.  
**Reality**: File exists at `web/sandbox/src/features/hitl-gate.tsx`.

**Decision**: Verify the component handles all gate types and WebSocket events. No new file needed.

**Rationale**: File already present.

---

## Decision 8: Smoke Test — Already Exists

**What the spec says**: Create `tests/e2e/smoke.test.ts`.  
**Reality**: File exists at `tests/e2e/smoke.test.ts`.

**Decision**: Verify test assertions cover all endpoints. Enhance if gaps found.

**Rationale**: File already present.

---

## Decision 9: CHANGELOG Correction — Needs Verification

**What the spec says**: Correct CHANGELOG Phase 31 entries.  
**Reality**: ConsentEngine and TrustScoreEngine are fully implemented now. CHANGELOG may or may not be updated.

**Decision**: Read CHANGELOG Phase 31 section. Update if it still claims engines are "not implemented" when they now exist.

**Rationale**: Must match actual implementation state.

---

## Decision 10: Unit Tests — Primary Gap

The largest actual gap is test coverage for the sovereign trust engines.

**Decision**: Create unit tests for:
1. `tests/unit/engines/consent-engine.test.ts` — ConsentEngine check/grant/revoke/isAllowed
2. `tests/unit/engines/trust-score.test.ts` — TrustScoreEngine scoring with mocked DB
3. Verify existing `smoke.test.ts` passes
4. Run `bun run devops verify-cross-surface` for parity

**Rationale**: Engines exist but need tests to reach 80% coverage. This is the primary remaining work.
