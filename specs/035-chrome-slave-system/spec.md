# Chrome Slave System — Specification

## Overview

The Chrome Slave System is the production automation layer that powers provider integration in vivim. It manages Chrome browser instances (slaves) that connect to AI providers (ChatGPT, Gemini, Claude) via CDP (Chrome DevTools Protocol) and stream responses back to the system.

**Key Insight**: This is NOT a testing tool — it's the core functionality that enables the entire provider integration architecture.

---

## User Stories

### US1: Provider Registration & Launch
**As a** system operator  
**I want** Chrome slaves to automatically launch when needed for a provider  
**So that** I can interact with AI providers without manual browser management

**Acceptance Criteria:**
- AC1.1: System detects when a provider is needed and launches Chrome slave automatically
- AC1.2: Chrome slave uses isolated profile directory per provider/account
- AC1.3: System reuses existing Chrome slave if already running for same provider/account
- AC1.4: Chrome slave navigates to provider URL on launch

### US2: Health Monitoring & Recovery
**As a** system operator  
**I want** Chrome slaves to be monitored for health and automatically recovered on failure  
**So that** the system remains resilient to transient failures

**Acceptance Criteria:**
- AC2.1: System performs periodic health checks via CDP ping
- AC2.2: Unhealthy slaves are automatically restarted (transient failures)
- AC2.3: Persistent failures trigger circuit breaker to prevent cascade
- AC2.4: Agent is notified of persistent failures for manual intervention

### US3: Session Management & Relogin
**As a** system operator  
**I want** the system to detect session expiry and guide me through relogin  
**So that** I can maintain authenticated sessions with minimal downtime

**Acceptance Criteria:**
- AC3.1: System detects session expiry via cookie file inspection
- AC3.2: Agent suggests relogin to user when session expires
- AC3.3: System executes relogin flow after user confirmation
- AC3.4: Profile state is preserved across relogin

### US4: Fleet Management & Admission Control
**As a** system operator  
**I want** the system to manage multiple Chrome slaves with proper resource limits  
**So that** the system doesn't overwhelm the machine or create runaway processes

**Acceptance Criteria:**
- AC4.1: System enforces maximum concurrent slaves limit
- AC4.2: Excess requests are queued with timeout
- AC4.3: Pre-spawn pressure gate checks CPU/memory before launch
- AC4.4: Spawn guard prevents duplicate profiles for same provider/account

### US5: Capability Integration
**As a** system operator  
**I want** Chrome slaves to execute provider-specific capabilities (send_message, select_model)  
**So that** I can interact with AI providers through a unified interface

**Acceptance Criteria:**
- AC5.1: Capabilities are provider-bound (e.g., send_message works differently per provider)
- AC5.2: Capability execution uses CDP to interact with provider UI
- AC5.3: Provider fallback is supported if primary provider fails
- AC5.4: Capability results are streamed back to frontend in real-time

### US6: Profile Management & Cleanup
**As a** system operator  
**I want** Chrome profiles to be properly managed and cleaned up  
**So that** the system doesn't accumulate stale profiles or stray directories

**Acceptance Criteria:**
- AC6.1: One profile per (provider, account) is enforced
- AC6.2: Stray profile directories are detected and can be removed
- AC6.3: Profile cleanup command exists for manual maintenance
- AC6.4: Profile state (cookies, metadata) is preserved across restarts

---

## Functional Requirements

### Core Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | System SHALL manage Chrome browser instances via CDP | P0 |
| FR-2 | System SHALL enforce one profile per (provider, account) | P0 |
| FR-3 | System SHALL implement state machine for slave lifecycle | P0 |
| FR-4 | System SHALL perform periodic health checks | P0 |
| FR-5 | System SHALL auto-restart transient failures | P0 |
| FR-6 | System SHALL implement circuit breaker for persistent failures | P0 |
| FR-7 | System SHALL detect session expiry via cookie inspection | P1 |
| FR-8 | System SHALL guide user through relogin flow | P1 |
| FR-9 | System SHALL enforce admission control (max concurrent, queue, timeout) | P1 |
| FR-10 | System SHALL prevent duplicate profiles via spawn guard | P1 |
| FR-11 | System SHALL clear stale SingletonLock before launch | P1 |
| FR-12 | System SHALL allocate unique debug ports per slave | P1 |
| FR-13 | System SHALL track profile metadata (provider, account, allocated, lastUsed) | P2 |
| FR-14 | System SHALL support profile cleanup (dry-run and enforce modes) | P2 |
| FR-15 | System SHALL detect stray profile directories | P2 |
| FR-16 | System SHALL provide preflight snapshot of system state | P2 |

### Integration Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| IR-1 | System SHALL integrate with CapabilityResolutionEngine | P0 |
| IR-2 | System SHALL integrate with StreamParserEngine for response parsing | P0 |
| IR-3 | System SHALL integrate with ConversationManager for session state | P1 |
| IR-4 | System SHALL integrate with CapabilityEventBus for lifecycle events | P1 |
| IR-5 | System SHALL provide API endpoints for fleet status | P2 |
| IR-6 | System SHALL integrate with devops runtime-test for preflight checks | P2 |

---

## Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-1 | System SHALL start Chrome slave in <5 seconds (cold start) | P1 |
| NFR-2 | System SHALL start Chrome slave in <2 seconds (warm start) | P1 |
| NFR-3 | System SHALL perform health check in <1 second | P2 |
| NFR-4 | System SHALL support 3-5 concurrent Chrome slaves | P1 |
| NFR-5 | System SHALL use <500MB memory per Chrome slave | P2 |
| NFR-6 | System SHALL not leak Chrome processes on shutdown | P0 |

---

## Key Entities

### ChromeSlave
- **id**: Unique identifier (providerSlug_accountId_timestamp_counter)
- **providerSlug**: Provider identifier (chatgpt, gemini, claude)
- **accountId**: Account identifier (email)
- **debugPort**: CDP debug port
- **profileDir**: Chrome profile directory path
- **status**: Lifecycle state (stopped, starting, running, unhealthy, restarting, error, circuit_open)
- **pid**: Process ID
- **consecutiveFailures**: Failure counter for circuit breaker
- **lastHealthCheck**: Timestamp of last health check
- **createdAt**: Timestamp of creation

### ProfileRecord
- **providerSlug**: Provider identifier
- **accountId**: Account identifier
- **path**: Profile directory path
- **hasCookies**: Whether cookie files exist
- **lastUsed**: Last usage timestamp
- **metaPresent**: Whether .profile-meta.json exists
- **liveSlave**: Whether Chrome slave is running
- **groupKey**: Grouping key (providerSlug:accountId)

### FleetState
- **instances**: Array of ChromeSlave instances
- **superState**: Aggregate state (idle, active, degraded, terminal)
- **stats**: Active count, queued count, max concurrent

---

## Edge Cases

1. **Port Conflict**: Debug port already in use → find next free port
2. **Profile Corruption**: Cookie files missing/corrupted → suggest relogin
3. **Chrome Not Found**: Chrome binary not installed → clear error message
4. **Multiple Instances**: Same provider/account already running → reuse existing
5. **Stale Locks**: SingletonLock from crashed Chrome → clear before launch
6. **Memory Pressure**: System memory low → defer spawn via pressure gate
7. **Circuit Breaker Open**: Too many failures → reject new spawns temporarily
8. **Session Expiry Mid-Operation**: Provider session expires during capability execution → detect and suggest relogin

---

## Assumptions

1. Chrome is installed on the system (Chrome or Edge)
2. Debug port range 9222-9350 is available
3. Profile directories are local-only (no sync)
4. One account per provider is sufficient for v1
5. Disk encryption is handled at OS level
6. User is available for relogin when prompted

---

## Out of Scope

1. Multi-user support (multiple users sharing Chrome slaves)
2. Remote Chrome slave management (only local)
3. Chrome auto-upgrade (too risky)
4. Profile backup/restore (profiles are disposable)
5. Scheduled profile cleanup (manual only for v1)
6. Chrome version tracking (alert only, no auto-upgrade)

---

## Success Criteria

| ID | Criterion | Measurement |
|----|-----------|-------------|
| SC-1 | Chrome slave launches successfully | 100% success rate for valid provider/account |
| SC-2 | Health check detects failures | 100% detection of CDP unavailability |
| SC-3 | Circuit breaker prevents cascade | No more than 5 consecutive failures before circuit opens |
| SC-4 | Profile isolation maintained | Zero cross-provider contamination |
| SC-5 | Session expiry detected | 100% detection via cookie inspection |
| SC-6 | Admission control works | Zero runaway Chrome processes |
| SC-7 | Cleanup removes stale profiles | Zero stray directories after cleanup |

---

## Traceability Matrix

| Requirement | Source | Implementation |
|-------------|--------|----------------|
| FR-1 (CDP Management) | Interview Round 1 | `src/executor/fleet-supervisor.ts` |
| FR-2 (One Profile Per Account) | Interview Round 2 | `src/executor/profile-allocator.ts` |
| FR-3 (State Machine) | Interview Round 3 | `src/executor/slave-states.ts` |
| FR-4 (Health Checks) | Interview Round 4 | `src/executor/fleet-supervisor.ts` |
| FR-5 (Auto-restart) | Interview Round 5 | `src/executor/fleet-supervisor.ts` |
| FR-6 (Circuit Breaker) | Interview Round 6 | `src/executor/slave-states.ts` |
| FR-7 (Session Expiry) | Interview Round 7 | `src/executor/profile-allocator.ts` |
| FR-8 (Relogin Flow) | Interview Round 8 | `devops/runtime-test/setup` |
| FR-9 (Admission Control) | Interview Round 9 | `src/executor/fleet-limiter.ts` |
| FR-10 (Spawn Guard) | Interview Round 10 | `src/executor/fleet-supervisor.ts` |
| FR-11 (SingletonLock) | Interview Round 11 | `src/executor/launcher.ts` |
| FR-12 (Port Allocation) | Interview Round 12 | `src/executor/launcher.ts` |
| FR-13 (Profile Metadata) | Interview Round 13 | `src/executor/profile-allocator.ts` |
| FR-14 (Profile Cleanup) | Interview Round 14 | `devops/profile-cleanup.ts` |
| FR-15 (Stray Detection) | Interview Round 15 | `src/executor/profile-allocator.ts` |
| FR-16 (Preflight Snapshot) | Interview Round 16 | `devops/agentic/context-probe.ts` |
