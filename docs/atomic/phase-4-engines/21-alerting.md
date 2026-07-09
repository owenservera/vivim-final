# Unit 4.21: Alerting subsystem (Alerter)

**Phase:** 4 | **File:** `src/alerting/alerter.ts`
**Depends:** 3.7 CapabilityEventBus | **Produces:** Alert condition evaluation engine
**Source:** `01-merged-epic.md` (survivor: `src/alerting/alerter.ts`), `03-merged-schema.md` §L11 (`alert_condition`, `alert_event`)

## Purpose
Ported survivor component. Evaluates `alert_condition` rows against incoming metric samples (driven by metric events on the CapabilityEventBus). When a condition breaches its threshold within its evaluation window and clears cooldown, the Alerter writes an `alert_event` row and notifies subscribers. Provides CRUD over `alert_condition` and acknowledgement over `alert_event`.

This is a v1 cross-cutting operations engine (L11 Operations). It does NOT add a new `CapabilityEvent` variant — it persists to `alert_event` and exposes its own query surface; the 20-v1 `CapabilityEvent` union in 3.6 is unchanged.

## Interface
```typescript
type AlertOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

interface AlertConditionRow {
  id: string;
  name: string;
  providerId: string | null;
  metric: string;            // e.g. 'provider:health_changed.score', 'capability:executed.latencyMs'
  operator: AlertOperator;
  threshold: number;
  windowS: number;           // rolling window for breach detection
  cooldownS: number;         // min seconds between two fires of the same condition
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

interface AlertEventRow {
  id: string;
  conditionId: string;
  providerId: string | null;
  metricValue: number | null;
  threshold: number | null;
  firedAt: number;
  acknowledged: boolean;
  acknowledgedAt: number | null;
  acknowledgedBy: string | null;
}

class Alerter {
  constructor(
    private store: AlertStore,
    private eventBus: CapabilityEventBus,
  ) {}

  start(): void;            // subscribe to metric events on the bus
  stop(): void;

  async evaluate(metric: string, providerId: string, value: number, ts?: number): Promise<AlertEventRow[]>;
  async listConditions(opts?: { providerId?: string; activeOnly?: boolean }): Promise<AlertConditionRow[]>;
  async createCondition(input: Omit<AlertConditionRow, 'id' | 'createdAt' | 'updatedAt'>): Promise<AlertConditionRow>;
  async updateCondition(id: string, patch: Partial<AlertConditionRow>): Promise<void>;
  async deleteCondition(id: string): Promise<void>;
  async listEvents(conditionId: string, opts?: { limit?: number }): Promise<AlertEventRow[]>;
  async acknowledge(eventId: string, by: string): Promise<void>;
}
```

## Store Contract
```typescript
interface AlertStore {
  listConditions(opts?: { providerId?: string; activeOnly?: boolean }): Promise<AlertConditionRow[]>;
  getCondition(id: string): Promise<AlertConditionRow | null>;
  createCondition(input: AlertConditionRow): Promise<AlertConditionRow>;
  updateCondition(id: string, patch: Partial<AlertConditionRow>): Promise<void>;
  deleteCondition(id: string): Promise<void>;
  createEvent(input: AlertEventRow): Promise<AlertEventRow>;
  listEvents(conditionId: string, opts?: { limit?: number }): Promise<AlertEventRow[]>;
  acknowledgeEvent(id: string, by: string, at: number): Promise<void>;
  getLastEventForCondition(conditionId: string): Promise<AlertEventRow | null>;
}
```

## Tests
- [ ] `start()` subscribes to the CapabilityEventBus and `stop()` unsubscribes
- [ ] `evaluate()` fires an `alert_event` when `value` breaches `threshold` under `operator`
- [ ] `evaluate()` suppresses fire during `cooldownS` after the previous event
- [ ] `evaluate()` respects `windowS` (no fire on a single out-of-window sample when windowed)
- [ ] `createCondition()` / `updateCondition()` / `deleteCondition()` round-trip through `AlertStore`
- [ ] `acknowledge()` flips `acknowledged` and records `acknowledgedBy` / `acknowledgedAt`
- [ ] Inactive condition (`isActive = false`) is never evaluated

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked `AlertStore` + `CapabilityEventBus`
- Does NOT mutate the v1 `CapabilityEvent` union (no new event type added)
