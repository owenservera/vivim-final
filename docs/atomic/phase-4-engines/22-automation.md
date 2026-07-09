# Unit 4.22: Automation scheduler

**Phase:** 4 | **File:** `src/automation/scheduler.ts`
**Depends:** 3.7 CapabilityEventBus, 3.6 ConversationManager | **Produces:** Time/event-driven automation runner
**Source:** `01-merged-epic.md` (survivor: `src/automation/scheduler.ts`), `03-merged-schema.md` §L11 (`automation_schedule`, `automation_run`)

## Purpose
Ported survivor component. A scheduler that owns `automation_schedule` rows (cron / interval / event triggers) and produces `automation_run` records each time an action fires. On each `tick()` it evaluates due schedules, executes their `action` against an injected `AutomationRunner`, and records start/completion/failure in `automation_run`. Event-triggered schedules are bridged via the CapabilityEventBus (`start()` subscribes to the triggering event types).

This is a v1 cross-cutting operations engine (L11 Operations). The `action` values and their `action_config_json` payloads are opaque to the scheduler — execution is delegated to the injected runner (wired in Phase 5 server or Phase 6).

## Interface
```typescript
type ScheduleType = 'cron' | 'interval' | 'event';
type RunStatus = 'running' | 'completed' | 'failed';

interface AutomationScheduleRow {
  id: string;
  name: string;
  scheduleType: ScheduleType;
  scheduleValue: string;       // cron expr | ISO interval (ms) | event type name
  action: string;              // opaque action key, dispatched to AutomationRunner
  actionConfigJson: string;    // default '{}'
  isActive: boolean;
  lastRunAt: number | null;
  nextRunAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface AutomationRunRow {
  id: string;
  scheduleId: string;
  status: RunStatus;
  resultJson: string | null;
  error: string | null;
  startedAt: number;
  completedAt: number | null;
}

interface AutomationRunner {
  run(action: string, config: unknown): Promise<unknown>;
}

class AutomationScheduler {
  constructor(
    private store: AutomationStore,
    private runner: AutomationRunner,
    private eventBus: CapabilityEventBus,
  ) {}

  start(): void;              // begins tick loop + (for event schedules) subscribes to bus
  stop(): void;
  async tick(now?: number): Promise<AutomationRunRow[]>;
  async runNow(scheduleId: string): Promise<AutomationRunRow>;
  async define(input: Omit<AutomationScheduleRow, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt'>): Promise<AutomationScheduleRow>;
  async list(): Promise<AutomationScheduleRow[]>;
}
```

## Store Contract
```typescript
interface AutomationStore {
  listSchedules(opts?: { activeOnly?: boolean }): Promise<AutomationScheduleRow[]>;
  getSchedule(id: string): Promise<AutomationScheduleRow | null>;
  createSchedule(input: AutomationScheduleRow): Promise<AutomationScheduleRow>;
  updateSchedule(id: string, patch: Partial<AutomationScheduleRow>): Promise<void>;
  deleteSchedule(id: string): Promise<void>;
  createRun(input: AutomationRunRow): Promise<AutomationRunRow>;
  updateRun(id: string, patch: Partial<AutomationRunRow>): Promise<void>;
  listRuns(scheduleId: string, opts?: { limit?: number }): Promise<AutomationRunRow[]>;
}
```

## Tests
- [ ] `tick()` fires only schedules whose `nextRunAt <= now`
- [ ] `tick()` computes and persists the next `nextRunAt` for interval/cron schedules
- [ ] `tick()` writes an `automation_run` with `status: 'running'` then `completed`/`failed`
- [ ] `runNow()` executes a schedule immediately regardless of `nextRunAt`
- [ ] Event-type schedules are triggered by the matching `CapabilityEvent` via the bus
- [ ] Inactive schedule (`isActive = false`) is skipped by `tick()`
- [ ] Runner failure records `status: 'failed'` + `error` and does not crash the loop

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked `AutomationStore` + `AutomationRunner` + `CapabilityEventBus`
- Scheduler loop is stoppable and idempotent under double `tick()`
