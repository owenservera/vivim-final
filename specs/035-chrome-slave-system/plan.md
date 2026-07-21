# Chrome Slave System — Technical Plan

## Technical Context

| Aspect | Value |
|--------|-------|
| **Language** | TypeScript (strict mode, ESNext target) |
| **Runtime** | Bun |
| **ORM** | Prisma v6.5 |
| **Testing** | Bun test runner |
| **Linter** | Biome |
| **Build** | tsup (ESM + DTS) |

### Dependencies

| Dependency | Purpose | Status |
|------------|---------|--------|
| `@prisma/client` | Database access | ✅ Installed |
| `zod` | Runtime validation | ✅ Installed |
| `pino` | Structured logging | ✅ Installed |

### Storage

| Store | Purpose | Location |
|-------|---------|----------|
| SQLite | Profile metadata, fleet state | `prisma/schema.prisma` |
| Filesystem | Chrome profiles, cookie files | `chrome-profiles/` |

### Testing

| Level | Framework | Location |
|-------|-----------|----------|
| Unit | Bun test | `tests/unit/engines/` |
| Integration | Bun test | `tests/integration/` |
| E2E | Bun test | `tests/e2e/` |

---

## Constitution Check

### Governor Canon
✅ **PASS** — Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.

### Store Contracts
✅ **PASS** — Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.

### Research-First
✅ **PASS** — This plan is based on comprehensive source code audit and design interview.

### Phase Gates
✅ **PASS** — This plan follows the SpecKit pipeline (specify → plan → tasks → implement).

### One Entry Point
✅ **PASS** — Chrome slave operations are exposed via `UnifiedCapability` system.

---

## Phase 0: Research

### Source Code Audit Results

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| ProfileAllocator | `src/executor/profile-allocator.ts` | ✅ Implemented | 451 lines, full lifecycle |
| FleetSupervisor | `src/executor/fleet-supervisor.ts` | ✅ Implemented | 630 lines, state machine + circuit breaker |
| Launcher | `src/executor/launcher.ts` | ✅ Implemented | 207 lines, Chrome/Edge spawn |
| SlaveStates | `src/executor/slave-states.ts` | ✅ Implemented | 94 lines, state machine |
| FleetLimiter | `src/executor/fleet-limiter.ts` | ✅ Implemented | 57 lines, admission control |
| ContextProbe | `devops/agentic/context-probe.ts` | ✅ Implemented | 323 lines, preflight snapshot |
| ProfileCleanup | `devops/profile-cleanup.ts` | ✅ Implemented | Profile cleanup operator |

### Design Interview Decisions

| Decision | Rationale | Source |
|----------|-----------|--------|
| **Capability integration**: Hybrid | Capabilities define WHAT, providers determine HOW | Round 9, Q24 |
| **Failure handling**: Fallback | Try primary, fallback to alternative, circuit breaker | Round 9, Q25 |
| **Code changes**: Lazy | Keep alive, no restart, lazy restart when needed | Round 10, Q26 |
| **Conflicts**: Multi-slave (managed) | Spawn additional slaves, FleetSupervisor manages | Round 10, Q27 |
| **Production management**: Hybrid | Agent routine, human exceptional, auto-restart transient | Round 11, Q28 |
| **Deployment**: Local-only | Simpler, more secure, sufficient for v1 | Round 11, Q29 |
| **Startup time**: <5 seconds | Fast startup improves dev loop responsiveness | Round 11, Q30 |
| **State persistence**: Profiles persist | Cookie files survive restart, lazy launch sufficient | Round 12, Q31 |
| **Chrome conflicts**: Port check | Verify debug port is free before launch | Round 12, Q32 |
| **Profile corruption**: Manual recovery | Agent suggests relogin, user confirms | Round 12, Q33 |
| **Profile sharing**: No sharing | Each provider gets unique profile, isolation is simpler | Round 12, Q34 |
| **Max slaves**: Unlimited | FleetSupervisor decides based on system resources | Round 13, Q35 |
| **Resource limits**: Fixed limits | Hard caps on concurrent slaves, queue size | Round 13, Q36 |
| **Port conflicts**: Dynamic allocation | Find free port at launch | Round 13, Q37 |
| **Process cleanup**: Kill + profile cleanup | Terminate Chrome process, delete profile | Round 13, Q38 |

---

## Phase 1: Data Model

### Existing Tables (Prisma Schema)

| Table | Purpose | Status |
|-------|---------|--------|
| `ChromeInstance` | Chrome slave instances | ✅ Implemented |
| `FleetEvent` | Fleet lifecycle events | ✅ Implemented |
| `FleetConfig` | Fleet configuration | ✅ Implemented |
| `Account` | Provider accounts | ✅ Implemented |
| `Provider` | Provider definitions | ✅ Implemented |

### Profile Metadata (.profile-meta.json)

```typescript
interface ProfileMeta {
  providerSlug: string
  accountId: string
  allocatedAt: string
  lastUsed: string
}
```

---

## Phase 2: Interface Contracts

### ProfileAllocator Interface

```typescript
class ProfileAllocator {
  getPath(providerSlug: string, accountId: string): string
  isAuthenticated(providerSlug: string, accountId: string): boolean
  isLiveSlave(profileDir: string): boolean
  plan(): Promise<CleanupPlan>
  enforce(): Promise<CleanupResult>
  allocate(providerSlug: string, accountId: string): Promise<string>
  deallocate(providerSlug: string, accountId: string): Promise<void>
}
```

### FleetSupervisor Interface

```typescript
class FleetSupervisor {
  spawn(providerSlug: string, accountId: string): Promise<FleetInstance>
  kill(instanceId: string): Promise<void>
  healthCheck(instanceId: string): Promise<HealthProbeResult>
  getStatus(): FleetState
  getStats(): { active: number; queued: number; maxConcurrent: number }
}
```

### FleetLimiter Interface

```typescript
class FleetLimiter {
  acquire(): Promise<void>
  release(): void
  stats(): { active: number; queued: number; maxConcurrent: number }
}
```

---

## Phase 3: Quickstart Scenarios

### Scenario 1: Launch Chrome Slave for Provider

1. Agent detects provider is needed
2. `FleetSupervisor.spawn(providerSlug, accountId)` called
3. `FleetLimiter.acquire()` checks admission control
4. `ProfileAllocator.allocate()` gets/creates profile directory
5. `Launcher.launchProfile()` spawns Chrome with debug port
6. Chrome slave navigates to provider URL
7. Health check confirms CDP connectivity
8. `FleetInstance` created and tracked

### Scenario 2: Handle Session Expiry

1. Health check detects session expiry via `isAuthenticated()`
2. Agent suggests relogin to user
3. User confirms
4. System executes `setup --provider=<slug>`
5. Chrome launches, user logs in
6. System captures cookies, updates DB + runtime
7. Health check confirms session is valid

### Scenario 3: Circuit Breaker Activation

1. Multiple consecutive failures detected
2. `consecutiveFailures` counter increments
3. Counter exceeds `circuitBreakerThreshold` (default: 5)
4. Circuit state changes to `open`
5. New spawn requests rejected with `CircuitOpenError`
6. After `circuitBreakerResetMs` (default: 60s), circuit transitions to `half_open`
7. Test spawn attempted; if successful, circuit closes

---

## Phase 4: Implementation Plan

### Already Implemented (No Changes Needed)

| Component | File | Status |
|-----------|------|--------|
| ProfileAllocator | `src/executor/profile-allocator.ts` | ✅ Complete |
| FleetSupervisor | `src/executor/fleet-supervisor.ts` | ✅ Complete |
| Launcher | `src/executor/launcher.ts` | ✅ Complete |
| SlaveStates | `src/executor/slave-states.ts` | ✅ Complete |
| FleetLimiter | `src/executor/fleet-limiter.ts` | ✅ Complete |
| ContextProbe | `devops/agentic/context-probe.ts` | ✅ Complete |
| ProfileCleanup | `devops/profile-cleanup.ts` | ✅ Complete |

### Documentation Tasks

| Task | Priority | Effort |
|------|----------|--------|
| Create unified system diagram | P1 | S |
| Update AGENTS.md with Chrome slave invariants | P1 | S |
| Update devops-fullstack skill with lifecycle section | P1 | S |
| Create Chrome slave lifecycle skill (optional) | P2 | M |

### Integration Tasks

| Task | Priority | Effort |
|------|----------|--------|
| Verify capability integration works end-to-end | P1 | M |
| Verify health monitoring detects failures | P1 | M |
| Verify circuit breaker prevents cascade | P1 | M |
| Verify profile cleanup removes stale profiles | P2 | S |

---

## Phase 5: Test Strategy

### Unit Tests

| Test | File | Coverage |
|------|------|----------|
| ProfileAllocator tests | `tests/unit/engines/profile-allocator.test.ts` | Profile allocation, cleanup |
| FleetSupervisor tests | `tests/unit/engines/fleet-supervisor.test.ts` | Lifecycle, circuit breaker |
| SlaveStates tests | `tests/unit/engines/slave-states.test.ts` | State machine, backoff |
| FleetLimiter tests | `tests/unit/engines/fleet-limiter.test.ts` | Admission control |

### Integration Tests

| Test | File | Coverage |
|------|------|----------|
| Chrome slave launch | `tests/integration/chrome-slave-launch.test.ts` | End-to-end launch |
| Health monitoring | `tests/integration/health-monitoring.test.ts` | Failure detection |
| Circuit breaker | `tests/integration/circuit-breaker.test.ts` | Cascade prevention |
| Profile cleanup | `tests/integration/profile-cleanup.test.ts` | Stale profile removal |

### E2E Tests

| Test | File | Coverage |
|------|------|----------|
| Provider integration | `tests/e2e/provider-integration.test.ts` | Full provider workflow |
| Session expiry | `tests/e2e/session-expiry.test.ts` | Relogin flow |
| Fleet management | `tests/e2e/fleet-management.test.ts` | Multiple providers |

---

## Phase 6: Gate Checkpoints

### Per-Unit Gates

```bash
bun run typecheck
bun test tests/unit/engines/<engine-name>
bun run lint
```

### Per-Phase Gates

```bash
bun run devops invariants check --category B
bun run devops audit-code standard
```

### Final Gates

```bash
bun test
bun run devops verify-cross-surface
```

---

## Appendix: Existing Implementation Details

### ProfileAllocator (451 lines)

**Key Functions:**
- `getPath(providerSlug, accountId)` — Resolve profile directory path
- `isAuthenticated(providerSlug, accountId)` — Check cookie files exist
- `isLiveSlave(profileDir)` — Check if Chrome slave is running
- `plan()` — Generate cleanup plan (dry-run mode)
- `enforce()` — Execute cleanup (enforce mode)
- `allocate(providerSlug, accountId)` — Create/get profile directory
- `deallocate(providerSlug, accountId)` — Remove profile directory

**Enforced Invariants:**
- One profile per (provider, account)
- Stray root detection and removal
- Legacy root cleanup

### FleetSupervisor (630 lines)

**Key Functions:**
- `spawn(providerSlug, accountId)` — Launch Chrome slave
- `kill(instanceId)` — Terminate Chrome slave
- `healthCheck(instanceId)` — CDP ping + status check
- `getStatus()` — Get fleet state
- `getStats()` — Get admission control stats

**State Machine:**
- 7 states: stopped, starting, running, unhealthy, restarting, error, circuit_open
- Fleet super-state: idle, active, degraded, terminal
- Exponential backoff for restarts

**Circuit Breaker:**
- Threshold: 5 consecutive failures
- Reset: 60 seconds
- States: closed, half_open, open

### Launcher (207 lines)

**Key Functions:**
- `launchProfile(profile)` — Spawn Chrome with profile
- `clearSingletonLock(userDataDir)` — Remove stale locks
- `isPortInUse(port)` — Check debug port availability
- `freePort(start, span)` — Find next free port

**Chrome Management:**
- Profile isolation via `--user-data-dir`
- Debug port allocation
- SingletonLock cleanup
- Process detachment

### SlaveStates (94 lines)

**State Machine:**
- Valid transitions defined
- Exponential backoff schedule
- Fleet super-state computation

**Backoff Formula:**
```
delay = baseMs * factor^attempt
delay = min(delay, maxMs)
```

Default: base=1000ms, factor=2, max=30000ms

### FleetLimiter (57 lines)

**Admission Control:**
- Bounded concurrency (maxConcurrent)
- Queue with timeout (maxQueued, queueTimeoutMs)
- Acquire/release pattern

**Error Types:**
- `FleetQueueFullError` — Queue depth exceeded
- `FleetQueueTimeoutError` — No slot within timeout

### ContextProbe (323 lines)

**Preflight Snapshot:**
- Accounts from DB
- Profiles from disk
- Live Chrome instances from CDP scan
- Ready providers, restore candidates, gaps

**CDP Scanning:**
- Port range: 9222-9350
- Timeout: 500ms per port
- Page URL/title extraction

### ProfileCleanup

**Cleanup Modes:**
- Dry-run: Show what would be removed
- Enforce: Actually remove profiles

**Cleanup Logic:**
- Group profiles by (provider, account)
- Keep authenticated profile per group
- Remove duplicates and strays
