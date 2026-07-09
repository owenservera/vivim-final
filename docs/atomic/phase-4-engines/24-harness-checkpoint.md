# Unit 4.24: HarnessCheckpoint persistence

**Phase:** 4 | **File:** `src/engines/harness-checkpoint.ts`
**Depends:** 4.7 HarnessRuntime, 3.7 CapabilityEventBus | **Produces:** Crash-recovery checkpoint writer for HarnessRuntime
**Source:** `03-merged-schema.md` §L9 (`harness_checkpoint`)

## Purpose
New engine (not a ported survivor) that gives `HarnessRuntime` crash recovery. `HarnessRuntime` executes multi-step capability DAGs by sending atomic CDP commands one at a time through `Governor.CDPProxy`. As execution progresses, it persists the active DAG, current `dag_position`, loaded modules, page URL/title, and auth state into `harness_checkpoint`. On slave crash (`fleet:crash_detected`) or restart, the checkpoint is rehydrated to resume from the last committed position rather than replaying from the start.

No other engine writes `harness_checkpoint` — this unit is its sole owner.

## Interface
```typescript
interface HarnessCheckpointRow {
  id: string;
  slaveId: string;
  conversationId: string | null;
  activeDagJson: string | null;     // serialized HarnessDAG
  dagPosition: number | null;       // index of next step to execute
  loadedModulesJson: string;        // default '[]'
  pageUrl: string | null;
  pageTitle: string | null;
  authState: string | null;
  createdAt: number;
}

interface CheckpointInput {
  slaveId: string;
  conversationId?: string | null;
  activeDag?: unknown | null;
  dagPosition?: number | null;
  loadedModules?: unknown[];
  pageUrl?: string | null;
  pageTitle?: string | null;
  authState?: string | null;
}

class HarnessCheckpointEngine {
  constructor(private store: HarnessCheckpointStore) {}

  async save(input: CheckpointInput): Promise<HarnessCheckpointRow>;
  async getLatest(slaveId: string): Promise<HarnessCheckpointRow | null>;
  async getForConversation(conversationId: string): Promise<HarnessCheckpointRow | null>;
  async clear(slaveId: string): Promise<void>;
}
```

## Store Contract
```typescript
interface HarnessCheckpointStore {
  create(input: HarnessCheckpointRow): Promise<HarnessCheckpointRow>;
  getLatestBySlave(slaveId: string): Promise<HarnessCheckpointRow | null>;
  getLatestByConversation(conversationId: string): Promise<HarnessCheckpointRow | null>;
  deleteBySlave(slaveId: string): Promise<void>;
}
```

## Tests
- [ ] `save()` persists a checkpoint row and a later `getLatest(slaveId)` returns it
- [ ] `save()` for the same slave replaces the prior latest (single live checkpoint per slave)
- [ ] `getForConversation()` returns the conversation-scoped checkpoint
- [ ] `clear(slaveId)` removes the checkpoint; `getLatest` returns null after
- [ ] Round-trips `activeDagJson` and `loadedModulesJson` without corruption

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked `HarnessCheckpointStore`
- Sole writer of `harness_checkpoint` (no other engine unit references it)
