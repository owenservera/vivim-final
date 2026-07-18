# Feature Specification: Automated Health Recovery

**Feature Branch**: `013-automated-recovery`  
**Created**: 2025-07-17 | **Status**: Ready  
**Input**: Auto-healing engine that restarts crashed slaves, manages circuit breakers, repairs selectors, and warns about expiring sessions

## User Scenarios

### User Story 1 — Auto-Restart Crashed Slave (P1)

When a Chrome slave crashes or becomes unresponsive, the system auto-restarts it without user intervention.

**Acceptance Scenarios**:
1. **Given** Chrome slave crashes (process exits), **When** health probe detects it within 30s, **Then** system attempts reconnect to debug port; if reconnect fails, launches new Chrome instance
2. **Given** auto-recovery succeeds, **When** slave is running again, **Then** health dashboard shows recovery event in trace log

### User Story 2 — Circuit Breaker Auto-Management (P1)

Circuit breakers auto-transition through open → half-open → closed without user action.

**Acceptance Scenarios**:
1. **Given** circuit is open, **When** cooldown period expires, **Then** circuit transitions to half-open and allows one test request
2. **Given** test request succeeds, **When** response is ok, **Then** circuit closes and normal traffic resumes
3. **Given** test request fails, **When** response is error, **Then** circuit stays open and notification is sent

### User Story 3 — Selector Auto-Healing (P2)

When a DOM selector drifts (provider UI changed), the system finds new selectors automatically.

**Acceptance Scenarios**:
1. **Given** selector drift detected, **When** healer runs, **Then** new selectors are found and auto-updated in selector_strategy table

### User Story 4 — Session Expiry Warning (P2)

User gets preemptive warning before a provider session expires.

**Acceptance Scenarios**:
1. **Given** provider cookie TTL < 1 hour, **When** health check runs, **Then** notification appears: "ChatGPT session expires in 45 min — click to refresh"

## Requirements

- **FR-001**: System MUST detect crashed slaves and auto-restart within 30 seconds
- **FR-002**: Circuit breakers MUST auto-transition through open → half-open → closed
- **FR-003**: Selector healer MUST auto-update drifted selectors
- **FR-004**: Session expiry warnings MUST appear at 1 hour and 15 minute thresholds
- **FR-005**: All recovery actions MUST be logged to trace log with timestamps
- **FR-006**: Recovery status MUST be visible in health dashboard

## Success Criteria

- SC-001: Crashed slaves recovered within 30 seconds
- SC-002: Circuit breaker auto-recovery succeeds in 90% of cases
- SC-003: Selector drift auto-healed within 5 minutes of detection
