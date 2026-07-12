> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-08: Resource Management

**Phase:** 8 | **Units:** 3 | **Goal:** Configurable resource limits, eviction, and backpressure

## Design Principle: Policy-Driven Resource Control

No hardcoded limits. All resource constraints are policy objects:

```typescript
interface ResourcePolicy {
  maxConcurrent: number      // from DB, not code
  idleTtlMs: number          // from DB
  evictionStrategy: string   // 'lru' | 'lfu' | 'fifo' | 'custom'
  warmPoolSize: number       // from DB
}
```

## Units

| Unit | Title | Policy Object |
|------|-------|---------------|
| 8.1 | Idle slave TTL + eviction | `EvictionPolicy` |
| 8.2 | DB abstraction: multi-strategy | `DbStrategyPolicy` |
| 8.3 | Request queueing + backpressure | `BackpressurePolicy` |

