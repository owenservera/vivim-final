# Feature Specification: Provider Operations & E2E Testing

**Feature Branch**: `004-provider-ops-e2e`
**Created**: 2025-07-17
**Status**: Ready
**Input**: Make provider operations live and actionable (health dashboard WS, fleet controls, alert push, drift dashboard, circuit breaker override) + build E2E test suite
**Source**: `docs/workstreams/AGENT-4-PROVIDER-OPS-E2E.md`
**Source Audit**: `docs/roadmap/PRODUCTION-MASTER-PLAN-AUDIT.md`

## User Scenarios & Testing

### User Story 1 — Health Dashboard Live Updates (Priority: P1)

Provider health dashboard switches from 15s polling to live WebSocket updates. Provider health changes are visible immediately with animated score transitions and status flash indicators.

**Why this priority**: Polling-based dashboards miss health transitions between polls. Live updates enable immediate awareness of provider degradation.

**Independent Test**: Page loads with initial data via HTTP. `provider:health_changed` WS event updates card without full page fetch. Status change "healthy→degraded" flashes card yellow.

**Acceptance Scenarios**:
1. **Given** health dashboard mounted, **When** `provider:health_changed` WebSocket event arrives, **Then** specific provider card updates in-place
2. **Given** status changes from healthy to degraded, **When** card updates, **Then** card border flashes yellow for 2s
3. **Given** score changes by >5 points, **When** card updates, **Then** score number animates smoothly (CSS transition)

### User Story 2 — Fleet Panel Per-Slave Controls (Priority: P1)

Fleet tab moves from read-only to actionable: restart crashed slaves, kill stuck ones, view trace logs, force circuit breaker state. Currently the fleet tab only shows slave list.

**Why this priority**: Operators need control over browser slaves. Without restart/kill, a crashed slave requires manual intervention.

**Independent Test**: Click Kill → confirmation → slave removed. Click Restart → spinner → status updates. Click View Trace → inline panel shows trace entries.

**Acceptance Scenarios**:
1. **Given** a running slave, **When** Kill button clicked, **Then** confirmation dialog appears, on confirm slave is killed
2. **Given** a crashed slave, **When** Restart button clicked, **Then** spinner shows, slave status updates to 'running'
3. **Given** circuit breaker in "open" state, **When** "Force Close" selected, **Then** circuit state changes to 'closed' with override badge
4. **Given** slave row, **When** View Trace clicked, **Then** inline panel shows timestamped trace entries

### User Story 3 — Provider Health Alert Push + Drift Dashboard (Priority: P2)

`ProviderHealthKernel` proactively pushes health status changes to WebSocket when computed. Drift dashboard shows individual unresolved drifts with resolve/dismiss actions.

**Why this priority**: Proactive alert push eliminates polling lag. Drift visibility enables operators to resolve provider registration drift.

**Independent Test**: Change provider health → event emitted on event bus with `{ type, providerId, from, to, score }`. Unresolved drifts appear in list with resolve/dismiss buttons.

**Acceptance Scenarios**:
1. **Given** health computation detects status change, **When** `computeProvider()` runs, **Then** `provider:health_changed` event emitted on CapabilityEventBus
2. **Given** health score changes by >10 without status change, **When** computed, **Then** event still emitted
3. **Given** unresolved drifts, **When** drift dashboard loads, **Then** drifts listed with capabilityId, driftType, severity, detectedAt
4. **Given** a drift, **When** Resolve clicked, **Then** drift disappears from list and count updates

### User Story 4 — E2E Test Suite (Priority: P2)

Four E2E tests using `bun:test`: full send pipeline, provider setup wizard, canvas layer lifecycle, import/export roundtrip. Tests start the server once in `beforeAll`, tear down in `afterAll`.

**Why this priority**: E2E tests prove the system works end-to-end. Critical for regression prevention.

**Independent Test**: Each test file is independently runnable: `bun test tests/e2e/send-pipeline.test.ts`.

**Acceptance Scenarios**:
1. **Given** server started, **When** send pipeline test runs (create conversation → send → poll for response → verify stream blocks → delete), **Then** all assertions pass
2. **Given** server started, **When** canvas lifecycle test runs (list definitions → spawn layer → verify WS event → mutate → verify event → dismiss → verify event), **Then** all assertions pass
3. **Given** exported JSON, **When** import/export test runs, **Then** structure validated and roundtrip verified

## Requirements

### Functional Requirements

- **FR-001**: Health dashboard MUST subscribe to WebSocket for live `provider:health_changed` events
- **FR-002**: Health dashboard MUST keep 60s polling fallback for missed events
- **FR-003**: Fleet panel MUST provide Restart, Kill, and View Trace actions per slave
- **FR-004**: Fleet panel MUST show confirmation dialog for Kill action
- **FR-005**: `ProviderHealthKernel` MUST emit `provider:health_changed` on status transition
- **FR-006**: `ProviderHealthKernel` MUST emit event on score change >10 points
- **FR-007**: Drift dashboard MUST list unresolved drifts with resolve/dismiss actions
- **FR-008**: Circuit breaker MUST support manual override (force open/close/auto)
- **FR-009**: E2E send pipeline test MUST verify full conversation lifecycle
- **FR-010**: E2E canvas test MUST verify layer lifecycle via WebSocket events
- **FR-011**: E2E tests MUST use `bun:test` with `beforeAll`/`afterAll` lifecycle
- **FR-012**: E2E tests MUST use `SKIP_CHROME_INTEGRATION` env var to skip Chrome-dependent tests

### Key Entities

- **ProviderHealth**: providerId, status (healthy/degraded/unhealthy), score (0-100), signals[]
- **Slave**: slaveId, createdAt, status, circuitState, uptime
- **CircuitOverride**: slaveId, forcedState (open/closed/auto), overrideReason
- **Drift**: id, providerId, capabilityId, driftType, severity, detectedAt, description, resolved
- **Trace**: slaveId, timestamp, event, data

## Success Criteria

### Measurable Outcomes

- **SC-001**: Health dashboard updates within 200ms of WebSocket event
- **SC-002**: Fleet controls (restart/kill) complete within 5s
- **SC-003**: All 4 E2E test files pass consistently (0 flakiness)
- **SC-004**: E2E send pipeline completes within 30s
- **SC-005**: Drift dashboard loads and renders in <1s for 100+ drifts

## Assumptions

- WebSocket already forwards to subscribed clients at `/ws`
- `governor.ensureRunning()`, `governor.kill()`, `governor.getTrace()` methods exist or can be exposed
- `registration-store.getUnresolvedDrifts()` and `resolveDrift()` exist
- E2E tests can use existing test DB pattern from `tests/integration/`
- Chrome-dependent E2E tests gracefully skip when `SKIP_CHROME_INTEGRATION` is set

## File Conflict Notes

- **`provider-health.ts`**: Agent 1 (106.4) adds trust score signal to `computeProvider()`. Agent 4 (103.3) adds event emission. These touch different sections. Merge order: Agent 1 first (adds trust score), Agent 4 second (adds event emission).
- **No other shared files**: `health-dashboard.tsx`, `debug-panel.tsx`, `tests/e2e/*` are exclusive to Agent 4.
