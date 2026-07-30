// reports/phase12/legacy-removal-checklist.md
// Phase 12: Legacy Removal — What to remove after all phases are verified.

## Feature Flags to Remove

After all phases (0-11) are verified in production, remove these feature flags:

### Phase 0 Flags
- `CHROME_BASELINE_AUDIT_ENABLED` — baseline audit reports

### Phase 1 Flags
- `CHROME_OBSERVABILITY_ENABLED` — observability subsystem
- `CHROME_TRACING_ENABLED` — OpenTelemetry tracing
- `CHROME_METRICS_ENABLED` — Prometheus metrics
- `CHROME_LOGGER_ENABLED` — structured JSON logging

### Phase 2 Flags
- `CHROME_RUNTIME_ENABLED` — BrowserRuntime, Domain Layer
- `CHROME_SLAVE_STATE_STORE_ENABLED` — SlaveStateStore

### Phase 3 Flags
- `CHROME_ACTOR_MODEL_ENABLED` — Mailbox, BrowserActor, ActorSupervisor
- `CHROME_ACTOR_SUPERVISOR_ENABLED` — actor supervision

### Phase 4 Flags
- `CHROME_BROWSER_POOL_ENABLED` — BrowserPool, Lease management
- `CHROME_WARM_SPAWN_ENABLED` — warm spawning

### Phase 5 Flags
- `CHROME_SCHEDULER_ENABLED` — resource-class scheduler
- `CHROME_RESOURCE_CLASSES_ENABLED` — 6 resource classes

### Phase 6 Flags
- `CHROME_ADAPTIVE_RESOURCES_ENABLED` — PressureFeed, AdaptiveLimiter
- `CHROME_GPU_ALLOCATOR_ENABLED` — GPU memory management

### Phase 7 Flags
- `CHROME_EVENT_BUS_ENABLED` — typed event bus
- `CHROME_DB_SUBSCRIBER_ENABLED` — DB event projection

### Phase 8 Flags
- `CHROME_PROVIDER_PLATFORM_ENABLED` — ProviderPlugin interface
- `CHROME_PROVIDER_MIGRATION_ENABLED` — provider plugin registry

### Phase 9 Flags
- `CHROME_RECOVERY_ORCHESTRATOR_ENABLED` — class-specific recovery
- `CHROME_FAILURE_CLASSIFIER_ENABLED` — failure classification
- `CHROME_EVENT_STORE_ENABLED` — append-only event store

### Phase 10 Flags
- `CHROME_FLEET_MANAGER_ENABLED` — distributed fleet management
- `CHROME_WORKER_NODES_ENABLED` — remote worker nodes
- `CHROME_REMOTE_CDP_ENABLED` — CDP proxy for remote instances

### Phase 11 Flags
- `CHROME_CHAOS_TESTS_ENABLED` — chaos test suite
- `CHROME_LOAD_TESTS_ENABLED` — load test suite
- `CHROME_STRESS_TESTS_ENABLED` — stress test suite

---

## Dead Code to Delete

After removing feature flags, delete these files:

### Legacy Fleet Management
- `src/executor/fleet-limiter.ts` — replaced by `AdaptiveLimiter`
- `src/executor/system-pressure.ts` — replaced by `PressureFeed`
- `src/executor/static-spawner.ts` — replaced by `BrowserPool`

### Legacy State Machine
- `src/executor/slave-states.ts` — replaced by `ActorSupervisor`
- `src/executor/circuit-breaker.ts` — replaced by `RecoveryOrchestrator`

### Legacy CDP Bridge
- `src/executor/cdp-transport.ts` — replaced by `RemoteCdp`
- `src/executor/profile-allocator.ts` — replaced by `BrowserPool` warm spawning

### Legacy Chrome Management
- `src/engines/chrome-governor.ts` — refactored into `BrowserRuntime`
- `src/engines/cdp-proxy.ts` — replaced by `RemoteCdp`

---

## Migration Steps

1. **Verify all phases are working in production**
2. **Run full test suite**: `bun test`
3. **Check metrics**: Ensure new subsystems have equivalent or better KPIs
4. **Remove feature flags one by one** (start with lowest risk)
5. **Delete dead code files**
6. **Update documentation** to reflect new architecture
7. **Remove legacy imports** from other files
8. **Run typecheck**: `bun run typecheck`
9. **Run lint**: `bun run lint`
10. **Final verification**: `bun run devops verify-cross-surface`
