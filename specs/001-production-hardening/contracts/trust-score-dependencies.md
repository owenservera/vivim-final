# Store Contract: TrustScore Dependencies

**Feature**: 001-production-hardening  
**Source**: `src/engines/trust-score.ts`

TrustScoreEngine has no dedicated store contract — it depends on `CapStoreDb` directly for reading from existing tables.

## Required DB Access

```typescript
// trust-score.ts reads from these tables via CapStoreDb:
interface TrustScoreDataAccess {
  // outcome table → success/fail counts
  getOutcomeStats(providerId: string, windowMs: number): Promise<{ successCount: number; failCount: number }>

  // selector_strategy table → hit/miss counts
  getSelectorStats(providerId: string): Promise<{ hitCount: number; missCount: number }>

  // circuit_breaker_state table → percent open
  getCircuitBreakerStats(providerId: string): Promise<{ open: number; total: number }>

  // provider_account table → last login
  getLastLogin(providerId: string): Promise<number | null>

  // manifest_drift table → unresolved count
  getDriftStats(providerId: string, windowMs: number): Promise<{ recent: number; unresolved: number }>
}
```

## Implementation Status

TrustScoreEngine currently accesses `CapStoreDb` (Prisma client wrapper) directly rather than through a dedicated contract. This follows the existing pattern used by other engines that read from multiple tables.

## Integration Points

- Used by `ProviderHealthKernel` as optional `trustScoreEngine` parameter
- Called via `computeProviderScore(providerId)` → returns `TrustReport`
- No writes — read-only analysis of existing tables
