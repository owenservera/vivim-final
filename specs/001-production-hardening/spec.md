# Feature Specification: Production Hardening & Sovereign Trust

**Feature Branch**: `001-production-hardening`
**Created**: 2025-07-17
**Status**: Ready
**Input**: Production hardening fixes for P0 violations + build ConsentEngine, TrustScoreEngine, HITL gate UI
**Source**: `docs/workstreams/AGENT-1-PRODUCTION-HARDENING.md`
**Source Audit**: `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md`

## User Scenarios & Testing

### User Story 1 — Fix P0 Gate Violations (Priority: P1)

The codebase has 16 invariant categories enforced by `bun run devops invariants check`. Category B violations are hard blocks. Currently B1 (Governor Canon) and B7 (raw Error classes) violations exist and must be resolved to zero.

**Why this priority**: These are hard gate failures. Nothing else can ship until they're fixed.

**Independent Test**: `bun run devops invariants check --category B` returns exit code 0.

**Acceptance Scenarios**:
1. **Given** B1 violation in `cdp-capability-registrar.ts`, **When** file is refactored to use `ChromeGovernor.cdp` proxy or marked exempt, **Then** `invariants check --category B` reports 0 B1 violations
2. **Given** 8 engine files with raw `new Error()`, **When** each is replaced with custom error class from `src/errors.ts`, **Then** `invariants check --category B` reports 0 B7 violations
3. **Given** P0 source-audit findings, **When** `devops audit-code standard` is run, **Then** 0 P0 findings remain

### User Story 2 — Build Sovereign Trust Engines (Priority: P1)

CHANGELOG Phase 31 claims 6 engines are done. Only `consentCheck` callback exists. Build the actual `ConsentEngine` and `TrustScoreEngine`, wire them to capability execution, and correct the CHANGELOG.

**Why this priority**: These are foundational trust infrastructure. Consent gates protect destructive operations. Trust scoring enables intelligent provider selection.

**Independent Test**:
- `ConsentEngine.check()` denies `financial` when threshold is `write`
- `TrustScoreEngine.computeProviderScore()` returns 0-100 for any provider
- Gated capabilities reject when consent denies

**Acceptance Scenarios**:
1. **Given** ConsentEngine with `requireApprovalAbove: 'write'`, **When** a `financial` operation is checked, **Then** consent is denied
2. **Given** a previously granted consent, **When** `check()` is called, **Then** consent is allowed
3. **Given** a provider with all successful outcomes, **When** trust score is computed, **Then** score ≥ 90
4. **Given** a provider with all failures, **When** trust score is computed, **Then** score ≤ 20

### User Story 3 — HITL Gate UI & Smoke Tests (Priority: P2)

Build the human-in-the-loop gate modal for the sandbox frontend and a production smoke test harness that verifies all endpoints without a browser.

**Why this priority**: HITL gates complete the trust loop. Smoke tests catch regressions.

**Independent Test**:
- HITL modal renders prompt text, clicking an option calls resolve API
- `bun test tests/e2e/smoke.test.ts` → all assertions pass

**Acceptance Scenarios**:
1. **Given** a pending HITL gate, **When** the UI renders, **Then** prompt text and option buttons are shown
2. **Given** the gate expires, **When** countdown reaches 0, **Then** expired state is shown
3. **Given** the server is running, **When** smoke test runs, **Then** `/health`, `/readyz`, `/api/capabilities` all return 200

## Requirements

### Functional Requirements

- **FR-001**: System MUST have 0 Category B invariant violations
- **FR-002**: System MUST have 0 P0 source-audit findings
- **FR-003**: ConsentEngine MUST gate all `write`, `destructive`, `financial`, `communication` capabilities
- **FR-004**: TrustScoreEngine MUST compute score from 6 weighted factors (success rate, latency, selector health, circuit state, auth freshness, manual reviews)
- **FR-005**: Trust scoring MUST be wired as an 8th signal in ProviderHealthKernel
- **FR-006**: HITL gate UI MUST render on `autonomous:gate_created` WebSocket event
- **FR-007**: Smoke test MUST verify `/`, `/health`, `/readyz`, `/api/capabilities` endpoints
- **FR-008**: Cross-surface verification MUST confirm all 50 capabilities resolve across CLI/API/MCP/UI
- **FR-009**: CHANGELOG Phase 31 MUST be corrected to reflect actual implementation state

### Key Entities

- **ConsentRecord**: operation classification, target, granted status, expiry
- **TrustFactor**: name, weight (0-1), value (0-100)
- **TrustScore**: provider ID, composite score (0-100), factor breakdown
- **HITLGate**: prompt, options[], gateType, expiresAt, status

## Success Criteria

### Measurable Outcomes

- **SC-001**: `bun run devops invariants check --category B` returns 0 violations
- **SC-002**: `bun run devops audit-code standard` returns 0 P0 findings
- **SC-003**: All 50 capabilities resolve across CLI, API, MCP, and UI surfaces
- **SC-004**: `bun test` passes with ≥80% engine coverage
- **SC-005**: Consent gate correctly denies destructive operations and allows reads

## Assumptions

- Existing `ConsentViolationError` in `src/errors.ts` is sufficient for consent denials
- In-memory consent store is acceptable for initial implementation (DB-backed later)
- Existing `outcome` and `selector_strategy` tables can be reused for trust scoring
- HITL gate API endpoints (`GET /api/autonomous/gates/pending`, `POST /api/autonomous/gates/{id}/resolve`) already exist
- `bun run devops runtime-test` infrastructure exists for smoke testing

## File Conflict Notes

- **`capability-bootstrap.ts`**: Merge order: Agent 3 first (adds new caps), Agent 1 second (wraps with consent gates)
- **`provider-health.ts`**: Agent 1 adds trust score signal, Agent 4 adds alert push — different methods, standard merge
