# KPI Baselines — Phase 0

**Measured**: 2026-07-29
**Method**: Static analysis + runtime probing

## Performance Baselines

| KPI | Baseline | Phase Target | Gate |
|-----|----------|--------------|------|
| Spawn latency p50 | ~8s | <2s (warm) | Phase 4: ≥70% reduction |
| Spawn latency p95 | ~15s | <5s (warm) | Phase 4: ≥70% reduction |
| Navigation latency | ~3s | No regression >10% | Phase 5 |
| CDP round-trip p99 | ~50ms | No regression >5% | Phase 5 |
| Browser RSS | ~150MB | No increase >10% | Phase 6 |
| CPU per slave | ~5% | ≥15% reduction at 50 slaves | Phase 6 |
| Restart frequency | ~2/hr | ≥50% reduction | Phase 9 |
| Circuit-open rate | ~1/hr | ≥40% reduction | Phase 9 |

## Resource Baselines

| Resource | Current | Notes |
|----------|---------|-------|
| Port range | 9222-9332 | 110 ports |
| Max concurrent | 110 | Equals port range span |
| Health probe interval | 30s | Fixed |
| Circuit breaker threshold | 5 failures | Fixed |
| Circuit breaker reset | 60s | Fixed |

## Architecture Risk Register

| Risk | Severity | Mitigation | Phase |
|------|----------|------------|-------|
| B1 invariant violation | Critical | Lint rule + review | 2 |
| State leakage between slaves | High | Ownership manifesto | 3 |
| Profile corruption on recycle | High | Reject profile swapping | 4 |
| DOM race conditions | Medium | Resource-class scheduler | 5 |
| Single-machine limitation | Medium | Distributed workers | 10 |
| Feature flag accumulation | Low | Phase 12 cleanup | 12 |
