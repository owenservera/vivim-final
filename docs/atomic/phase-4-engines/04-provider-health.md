# Unit 4.4: ProviderHealthKernel

**Phase:** 4 | **File:** `src/engines/provider-health.ts`
**Depends:** 3.1 ChromeGovernor, 3.6 CapabilityEventBus | **Produces:** Weighted health scores
**Source:** `04-merged-engines.md` §8

## Purpose
Compute a weighted health score from 6 signal sources on a 30-second schedule. Subscribe to CapabilityEventBus for real-time updates between scheduled runs.

## Interface
```typescript
interface ProviderHealthReport {
  providerId: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  overallScore: number;
  thresholds: { healthy: 80; degraded: 50; unhealthy: 0 };
  signals: {
    parsers: { active: number; degraded: number; minConfidence: number; score: number };
    capabilities: { active: number; degraded: number; broken: number; score: number };
    fleet: { running: number; stopped: number; error: number; circuitOpen: number; score: number };
    circuitBreakers: { open: number; halfOpen: number; closed: number; score: number };
    drifts: { recent: number; unresolved: number; score: number };
  };
  updatedAt: number;
}

class ProviderHealthKernel {
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    private store: HealthStore,
    private governor: ChromeGovernor,
    private eventBus: CapabilityEventBus,
  ) {}

  start(intervalMs?: number): void;
  stop(): void;
  async aggregate(providerId?: string): Promise<ProviderHealthReport[]>;
  getHealth(providerId: string): ProviderHealthReport | null;
  getAllHealth(): ProviderHealthReport[];
}
```

## Weighted Scoring Model
| Signal | Weight | Source |
|--------|--------|--------|
| Parser confidence | 30% | provider_capability.confidence |
| Parser empty streams 1h | 20% | parser_health table (1h window) |
| Selector hit rate | 20% | provider_capability.selector_hit_count/(hit+miss) |
| Chrome liveness | 15% | Governor.getHealth() aggregated |
| Circuit breaker state | 10% | circuit_breaker_state table |
| Drift events (recent) | 5% | drift_event table (24h window) |

## Status Thresholds
- `healthy`: overallScore >= 80
- `degraded`: overallScore >= 50
- `unhealthy`: overallScore < 50
- `unknown`: no data available

## Events
- Subscribes to: `capability:confidence_changed`, `fleet:slave_status`, `capability:selector_drifted`
- Publishes: `provider:health_changed` (on status transition)

## Tests
- [ ] `aggregate()` computes weighted score from all 6 signals
- [ ] Score 85 → status 'healthy'
- [ ] Score 45 → status 'unhealthy'
- [ ] Parser confidence 0.0 → reduces score by 30%
- [ ] All circuit breakers open → reduces score by 10%
- [ ] `provider:health_changed` emitted on status transition
- [ ] Scheduled aggregation runs every 30s

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked store data
