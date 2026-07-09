# Unit 4.26: Session checkpointing

**Phase:** 4 | **File:** `src/engines/session-checkpoint.ts`
**Depends:** 3.7 CapabilityEventBus | **Produces:** VivimSession state snapshots for resume
**Source:** `03-merged-schema.md` §L4 (`session_checkpoint`)

## Purpose
New engine that persists `vivim_session` state snapshots (`checkpoint_json`) so a session can be resumed after a restart. It subscribes to lifecycle events on the CapabilityEventBus (e.g. `conversation:created`, `account:login_state`) and, when a session-relevant entity changes, writes a `session_checkpoint` row keyed by `vivim_session_id`. The latest checkpoint is read by the session bootstrap to rehydrate UI/engine state.

Sole owner of `session_checkpoint` — no other engine unit writes it.

## Interface
```typescript
interface SessionCheckpointRow {
  id: string;
  vivimSessionId: string;
  checkpointJson: string;     // opaque state snapshot
  createdAt: number;
}

class SessionCheckpointEngine {
  constructor(private store: SessionCheckpointStore) {}

  async save(sessionId: string, snapshot: unknown): Promise<SessionCheckpointRow>;
  async getLatest(sessionId: string): Promise<SessionCheckpointRow | null>;
  async pruneOlderThan(sessionId: string, keep: number): Promise<void>;
}
```

## Store Contract
```typescript
interface SessionCheckpointStore {
  create(input: SessionCheckpointRow): Promise<SessionCheckpointRow>;
  getLatestBySession(sessionId: string): Promise<SessionCheckpointRow | null>;
  deleteOlderThan(sessionId: string, keep: number): Promise<void>;
}
```

## Tests
- [ ] `save()` writes a checkpoint and `getLatest(sessionId)` returns the most recent
- [ ] Multiple saves keep only the latest as `getLatest` (older rows retained until prune)
- [ ] `pruneOlderThan()` keeps `keep` most recent rows and deletes the rest
- [ ] `checkpointJson` round-trips an arbitrary snapshot object

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked `SessionCheckpointStore`
- Subscribes to session lifecycle events; sole owner of `session_checkpoint`
