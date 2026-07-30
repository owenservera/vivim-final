# Chrome Slave Architecture — Integration Design

## Overview

This document defines how the 12 new subsystems (Phases 1-10) integrate with the existing `ChromeGovernor` and `FleetSupervisor` without breaking the B1 invariant. The integration uses a **parallel operation** pattern: new subsystems run alongside old code, gated by feature flags, until the new path is verified in production.

---

## 1. Integration Architecture

### 1.1 Current Flow (As-Is)

```
ConversationManager
  └─> ChromeGovernor.spawn()
        └─> FleetSupervisor.spawn()
              ├─ FleetLimiter.acquire()     // static admission
              ├─ readSystemPressure()       // static pressure
              ├─ launchChrome()             // BunCdpClient
              └─ PortReaper.trackPid()
        └─> CDPProxy.send()               // CDP commands
              └─> CdpTransport.send()
```

### 1.2 Target Flow (To-Be)

```
ConversationManager
  └─> ChromeGovernorV2.spawn()              // ← NEW entry point
        ├─ ResourceManager.canSpawn()        // Phase 6: adaptive pressure
        ├─ BrowserPool.acquire()             // Phase 4: warm pool
        │   ├─ [cache hit] → return warm slave
        │   └─ [cache miss] → ActorSupervisor.create()  // Phase 3: actor
        │         └─> BrowserRuntime.spawn()             // Phase 2: runtime
        │               └─> FleetSupervisor.spawn()      // legacy spawn
        ├─ RecoveryOrchestrator.start()     // Phase 9: crash recovery
        └─> EventBus.publish('SlaveSpawned')
```

### 1.3 The Adapter Bridge

A single adapter file bridges old ↔ new:

```
src/integration/chrome-governor-v2.ts    // NEW: thin orchestrator
src/integration/legacy-adapter.ts        // NEW: wraps FleetSupervisor
src/integration/flag-registry.ts         // NEW: feature flag registry
```

---

## 2. Feature Flag Strategy

### 2.1 Flag Registry

All flags live in `src/integration/flag-registry.ts`:

```typescript
export interface IntegrationFlags {
  // Phase gates (each phase behind its own flag)
  PHASE_1_OBSERVABILITY: boolean     // default: true (safe, additive)
  PHASE_2_RUNTIME: boolean           // default: false
  PHASE_3_ACTOR: boolean             // default: false
  PHASE_4_POOL: boolean              // default: false
  PHASE_5_SCHEDULER: boolean         // default: false
  PHASE_6_RESOURCE: boolean          // default: false
  PHASE_7_EVENTS: boolean            // default: false
  PHASE_8_PROVIDERS: boolean         // default: false
  PHASE_9_RECOVERY: boolean          // default: false
  PHASE_10_FLEET: boolean            // default: false
  PHASE_12_LEGACY_REMOVAL: boolean   // default: false
  
  // Integration mode
  PARALLEL_MODE: boolean             // default: true (run both paths)
  SHADOW_MODE: boolean               // default: false (new path runs but result ignored)
}
```

### 2.2 Flag Loading

Flags load from environment variables with prefix `CHROME_`:

```bash
CHROME_PHASE_1_OBSERVABILITY=true    # enabled by default
CHROME_PHASE_2_RUNTIME=false         # disabled until verified
CHROME_PHASE_4_POOL=false
CHROME_PARALLEL_MODE=true
CHROME_SHADOW_MODE=false
```

### 2.3 Flag Evolution

| Week | Action |
|------|--------|
| 0 | Enable Phase 1 (observability) — safe, additive |
| 1 | Enable Phase 7 (event bus) — safe, additive |
| 2 | Enable Phase 2 (runtime) + Phase 3 (actor) — core refactor |
| 3 | Enable Phase 4 (pool) + Phase 5 (scheduler) — scheduling |
| 4 | Enable Phase 6 (resource) + Phase 9 (recovery) — reliability |
| 5 | Enable Phase 8 (providers) — provider migration |
| 6 | Enable Phase 10 (fleet) — distributed mode |
| 8 | Enable Phase 12 (legacy removal) — after 2 weeks stable |

---

## 3. Subsystem Wiring

### 3.1 Phase 1: Observability (Always On)

**Risk:** Low — purely additive, no behavioral change.

**Wiring:**
```typescript
// src/integration/chrome-governor-v2.ts
import { initTracing } from '../observability/tracing.js'
import { initMetrics } from '../observability/metrics.js'
import { initLogger } from '../observability/logger.js'

// At boot:
initTracing()    // no-op if disabled
initMetrics()    // Prometheus endpoint
initLogger()     // structured JSON
```

**Replace:** Nothing — add `getTracer()`, `getMetrics()`, `getLogger()` calls throughout existing code.

**Verify:** Check that traces/metrics/logs appear in observability backend.

---

### 3.2 Phase 2: Runtime (Core Refactor)

**Risk:** Medium — replaces direct CDP access with `BrowserRuntime`.

**Wiring:**
```typescript
// chrome-governor-v2.ts
import { BrowserRuntime } from '../engines/runtime/browser-runtime.js'

if (flags.PHASE_2_RUNTIME) {
  this.runtime = new BrowserRuntime({
    transport: this.cdpTransport,
    reconnectPolicy: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, factor: 2 },
  })
}
```

**Integration points:**
- `ChromeGovernor.spawn()` → `runtime.spawn()` instead of `fleetSupervisor.spawn()`
- `CDPProxy` → `runtime.getProxy(slaveId)` instead of `new CDPProxy(...)`
- `HealthMonitor` → `runtime.getHealthMonitor(slaveId)` instead of manual probe

**Replace:**
- `CdpWatchdog` setup → `runtime.setupWatchdog(slaveId)`
- Manual `ensureConnected()` → `runtime.ensureConnected(slaveId)`

---

### 3.3 Phase 3: Actor Model

**Risk:** Medium — changes lifecycle management from imperative to message-passing.

**Wiring:**
```typescript
// chrome-governor-v2.ts
import { ActorSupervisor } from '../engines/actor/actor-supervisor.js'

if (flags.PHASE_3_ACTOR && this.runtime) {
  this.actorSupervisor = new ActorSupervisor(this.runtime)
}
```

**Integration points:**
- `ChromeGovernor.spawn()` → `actorSupervisor.create(slaveId, debugPort)`
- `ChromeGovernor.kill()` → `actorSupervisor.shutdown(slaveId)`
- `HealthMonitor.probe()` → `actor.get(slaveId)?.tell({ t: 'HealthCheck' })`

**Replace:**
- Manual state tracking in `FleetSupervisor.instances` → actor state machine
- `circuitRecordSuccess/Failure` → actor message handling

---

### 3.4 Phase 4: Browser Pool

**Risk:** Medium — changes spawn path to check pool first.

**Wiring:**
```typescript
// chrome-governor-v2.ts
import { BrowserPool } from '../engines/pool/browser-pool.js'

if (flags.PHASE_4_POOL) {
  this.pool = new BrowserPool(
    async (providerId, accountId) => {
      const slave = await this.legacySpawn(providerId, accountId)
      return { slaveId: slave.slaveId, debugPort: slave.debugPort, profileDir: slave.profileDir }
    },
    { minWarm: 2, maxWarm: 10, maxIdleMs: 300_000 }
  )
}
```

**Integration points:**
- `ChromeGovernor.spawn()` → `pool.acquire(providerId, accountId)` first
- Pool miss → `pool.spawnNew()` → legacy spawn
- `ChromeGovernor.kill()` → `pool.release(slaveId)` (if leased) or direct kill

**Replace:**
- Cold startup on every spawn → warm pool hit
- `FleetSupervisor.spawn()` → pool-managed spawn

---

### 3.5 Phase 5: Scheduler

**Risk:** Low-Medium — adds scheduling layer on top of pool.

**Wiring:**
```typescript
// chrome-governor-v2.ts
import { BrowserScheduler } from '../engines/scheduler/browser-scheduler.js'

if (flags.PHASE_5_SCHEDULER && flags.PHASE_6_RESOURCE) {
  this.scheduler = new BrowserScheduler(this.eventBus, this.resourceManager)
}
```

**Integration points:**
- All CDP commands go through `scheduler.submit(task)` instead of direct `cdp.send()`
- Scheduler manages priority queues per resource class

**Replace:**
- `AsyncMutex` per-slave → scheduler queues
- `circuitTryAcquire()` → scheduler backpressure

---

### 3.6 Phase 6: Resource Manager

**Risk:** Low — replaces static pressure checks with adaptive.

**Wiring:**
```typescript
// chrome-governor-v2.ts
import { ResourceManager } from '../engines/resource/resource-manager.js'

if (flags.PHASE_6_RESOURCE) {
  this.resourceManager = new ResourceManager({
    pressure: { intervalMs: 5000 },
    limiter: { minConcurrent: 2, maxConcurrent: 20 },
    gpu: { budgetMb: 1024 },
  })
}
```

**Integration points:**
- `FleetSupervisor.spawn()` → `resourceManager.canSpawn()` first
- `readSystemPressure()` → `resourceManager.pressureFeed.getPressure()`
- `FleetLimiter` → `resourceManager.adaptiveLimiter`

**Replace:**
- `cpuOverloadPct` / `memOverloadPct` config → adaptive limiter
- Static `maxConcurrent` → adaptive `getMaxConcurrent()`

---

### 3.7 Phase 7: Event Bus (Always On After Phase 1)

**Risk:** Low — purely additive pub/sub.

**Wiring:**
```typescript
// chrome-governor-v2.ts
import { EventBus } from '../engines/events/event-bus.js'

this.eventBus = new EventBus()
```

**Integration points:**
- `FleetSupervisor.spawn()` → `eventBus.publish({ type: 'SlaveSpawned', ... })`
- `FleetSupervisor.kill()` → `eventBus.publish({ type: 'SlaveKilled', ... })`
- `HealthMonitor.probe()` → `eventBus.publish({ type: 'HealthTick', ... })`
- `CircuitBreaker.open` → `eventBus.publish({ type: 'CircuitOpened', ... })`

**Replace:**
- `eventBus.emit('fleet:slave_status', ...)` → `eventBus.publish({ type: 'HealthTick', ... })`
- `eventBus.emit('fleet:crash_detected', ...)` → `eventBus.publish({ type: 'SlaveCrashed', ... })`

---

### 3.8 Phase 8: Provider Platform

**Risk:** Low — replaces hardcoded provider logic with plugins.

**Wiring:**
```typescript
// chrome-governor-v2.ts
import { ProviderRegistry } from '../engines/providers/registry.js'

if (flags.PHASE_8_PROVIDERS) {
  this.providerRegistry = new ProviderRegistry()
}
```

**Integration points:**
- `PROVIDER_URLS[providerSlug]` → `providerRegistry.get(providerId)?.getUrl()`
- Provider-specific selectors → `providerRegistry.get(providerId)?.getSelectors()`
- Provider-specific parsers → `providerRegistry.get(providerId)?.getParser()`

**Replace:**
- `PROVIDER_URLS` constant → plugin `getUrl()`
- Hardcoded selector lists → plugin `getSelectors()`

---

### 3.9 Phase 9: Recovery Orchestrator

**Risk:** Low — replaces uniform recovery with class-specific.

**Wiring:**
```typescript
// chrome-governor-v2.ts
import { RecoveryOrchestrator } from '../engines/reliability/recovery-orchestrator.js'

if (flags.PHASE_9_RECOVERY) {
  this.recoveryOrchestrator = new RecoveryOrchestrator(
    this.eventBus,
    (slaveId) => this.getRecoveryContext(slaveId),
    (providerId) => this.getProviderConfig(providerId),
  )
  this.recoveryOrchestrator.start()
}
```

**Integration points:**
- `HealthMonitor.probe()` failure → `eventBus.publish({ type: 'SlaveCrashed', ... })`
- `RecoveryOrchestrator` subscribes to `SlaveCrashed` → applies class-specific strategy

**Replace:**
- `circuitRecordFailure()` → `classifyFailure()` + `executeRecovery()`
- `autoRestart` flag → recovery orchestrator with max retries

---

### 3.10 Phase 10: Fleet Scale-Out

**Risk:** High — introduces distributed workers.

**Wiring:**
```typescript
// chrome-governor-v2.ts
import { FleetManager } from '../fleet/fleet-manager.js'

if (flags.PHASE_10_FLEET) {
  this.fleetManager = new FleetManager(this.eventBus, {
    minWorkers: 1,
    maxWorkers: 10,
    globalConcurrency: 50,
  })
}
```

**Integration points:**
- `ChromeGovernor.spawn()` → `fleetManager.spawnOnBest()` first
- Fleet miss → local spawn (existing path)
- `ChromeGovernor.kill()` → `fleetManager.killOnWorker(workerId, debugPort)`

**Replace:**
- Local-only fleet → distributed fleet with worker nodes
- `ProfileAllocator` → worker-managed profiles

---

## 4. Parallel Operation Pattern

### 4.1 Shadow Mode

When `SHADOW_MODE=true`:
1. New path executes fully
2. Result is discarded
3. Old path executes normally
4. Metrics compare new vs old performance

```typescript
// chrome-governor-v2.ts
async spawn(providerId: string, accountId: string, opts?: LaunchOptions): Promise<ChromeSlave> {
  if (flags.SHADOW_MODE) {
    // Run new path, capture result
    const newResult = await this.newSpawnPath(providerId, accountId, opts)
    // Run old path, return its result
    const oldResult = await this.legacySpawnPath(providerId, accountId, opts)
    // Record comparison
    this.metrics.observeHistogram('spawn_comparison_ms', { path: 'new' }, newResult.durationMs)
    this.metrics.observeHistogram('spawn_comparison_ms', { path: 'old' }, oldResult.durationMs)
    return oldResult
  }
  
  if (flags.PARALLEL_MODE) {
    // Run both, return new path result
    const [newResult, oldResult] = await Promise.allSettled([
      this.newSpawnPath(providerId, accountId, opts),
      this.legacySpawnPath(providerId, accountId, opts),
    ])
    if (newResult.status === 'fulfilled') return newResult.value
    // Fallback to old path on failure
    if (oldResult.status === 'fulfilled') return oldResult.value
    throw new Error('Both spawn paths failed')
  }
  
  // Pure new path
  return this.newSpawnPath(providerId, accountId, opts)
}
```

### 4.2 Feature Flag Cascade

Flags must be enabled in dependency order:

```
Phase 1 (observability) ──┐
Phase 7 (events) ─────────┤
                          ├──▶ Phase 2 (runtime) ──▶ Phase 3 (actor) ──▶ Phase 4 (pool)
                          │                                                        │
                          │                                                        ▼
                          └──▶ Phase 6 (resource) ──▶ Phase 5 (scheduler) ── Phase 8 (providers)
                                                                          │
                                                                          ▼
                                                           Phase 9 (recovery) ──▶ Phase 10 (fleet)
```

---

## 5. Integration File Structure

```
src/integration/
├── chrome-governor-v2.ts     // New orchestrator (replaces ChromeGovernor)
├── legacy-adapter.ts         // Wraps FleetSupervisor for parallel mode
├── flag-registry.ts          // Feature flag management
├── migration-state.ts        // Tracks migration progress
└── index.ts                  // Barrel exports
```

---

## 6. Migration Steps

### Step 1: Create Integration Layer
1. Create `src/integration/` directory
2. Implement `flag-registry.ts` with all flags
3. Implement `chrome-governor-v2.ts` with parallel path selection
4. Implement `legacy-adapter.ts` to wrap existing `FleetSupervisor`

### Step 2: Wire Observability (Phase 1)
1. Enable `PHASE_1_OBSERVABILITY=true`
2. Add tracing/metrics/logging calls throughout existing code
3. Verify observability backend receives data

### Step 3: Wire Event Bus (Phase 7)
1. Enable `PHASE_7_EVENTS=true`
2. Replace `eventBus.emit()` calls with `eventBus.publish()`
3. Verify event history populates

### Step 4: Wire Runtime (Phase 2)
1. Enable `PHASE_2_RUNTIME=true` + `SHADOW_MODE=true`
2. Run `chrome-governor-v2.ts` in shadow mode
3. Compare new vs old performance metrics
4. Verify no regressions

### Step 5: Wire Actor (Phase 3)
1. Enable `PHASE_3_ACTOR=true`
2. Replace manual state tracking with actor messages
3. Verify health checks work through actor

### Step 6: Wire Pool (Phase 4)
1. Enable `PHASE_4_POOL=true`
2. Start warm spawner
3. Verify pool hits reduce cold startup

### Step 7: Wire Resource Manager (Phase 6)
1. Enable `PHASE_6_RESOURCE=true`
2. Replace static pressure with adaptive
3. Verify spawn rejection works correctly

### Step 8: Wire Scheduler (Phase 5)
1. Enable `PHASE_5_SCHEDULER=true`
2. Route CDP commands through scheduler
3. Verify priority queuing works

### Step 9: Wire Recovery (Phase 9)
1. Enable `PHASE_9_RECOVERY=true`
2. Test crash scenarios
3. Verify class-specific recovery works

### Step 10: Wire Providers (Phase 8)
1. Enable `PHASE_8_PROVIDERS=true`
2. Migrate provider logic to plugins
3. Verify provider-specific behavior preserved

### Step 11: Wire Fleet (Phase 10)
1. Enable `PHASE_10_FLEET=true`
2. Register remote workers
3. Verify distributed spawning works

### Step 12: Legacy Removal (Phase 12)
1. After 2 weeks stable production
2. Enable `PHASE_12_LEGACY_REMOVAL=true`
3. Remove old code paths
4. Remove feature flags

---

## 7. Rollback Strategy

### Per-Phase Rollback
Each phase has a kill switch:
```bash
CHROME_PHASE_X_YYYYY=false   # Disable specific phase
```

### Full Rollback
```bash
CHROME_PARALLEL_MODE=true    # Run both paths
CHROME_SHADOW_MODE=true      # New path runs but result ignored
```

### Emergency Rollback
```bash
CHROME_PHASE_2_RUNTIME=false
CHROME_PHASE_3_ACTOR=false
CHROME_PHASE_4_POOL=false
CHROME_PHASE_5_SCHEDULER=false
CHROME_PHASE_6_RESOURCE=false
CHROME_PHASE_8_PROVIDERS=false
CHROME_PHASE_9_RECOVERY=false
CHROME_PHASE_10_FLEET=false
```

---

## 8. Verification Checklist

### Per-Phase Verification
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] No type errors (`bun run typecheck`)
- [ ] No lint errors (`bun run lint`)
- [ ] Observability data appears in backend
- [ ] Performance metrics match or exceed baseline
- [ ] No memory leaks (stress test)

### Integration Verification
- [ ] All phases work together
- [ ] Feature flag cascade works correctly
- [ ] Shadow mode comparison shows parity
- [ ] Parallel mode doesn't break old path
- [ ] Rollback works for each phase
- [ ] Full system test passes

### Production Readiness
- [ ] Runbooks updated
- [ ] Monitoring dashboards created
- [ ] Alert rules configured
- [ ] On-call team trained
- [ ] Rollback tested in staging
- [ ] Load test passes at expected traffic

---

## 9. Risk Mitigation

### Risk: B1 Invariant Violation
**Mitigation:** All new subsystems are private collaborators of `ChromeGovernor`. Only `CDPProxy` touches CDP. Verified by `arch-audit` tool.

### Risk: Performance Regression
**Mitigation:** Shadow mode compares old vs new. Metrics track latency, throughput, error rate.

### Risk: Memory Leak
**Mitigation:** Stress tests run for 1000+ cycles. Memory growth monitored.

### Risk: Feature Flag Conflicts
**Mitigation:** Dependency graph enforced. Flags enable in order. Cascade validation at boot.

### Risk: Production Incident
**Mitigation:** Per-phase rollback. Emergency rollback script. Runbooks for each failure mode.
