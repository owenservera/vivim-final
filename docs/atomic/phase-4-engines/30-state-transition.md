# Unit 4.30: State Transition recording

**Phase:** 4 | **File:** `src/engines/state-transition.ts`
**Depends:** 3.7 CapabilityEventBus | **Produces:** Generic state transition audit logger
**Source:** `03-merged-schema.md` §L4 (`state_transition`), `02-merged-architecture.md` §P6 Relational First

## Purpose

New engine that writes `state_transition` rows whenever any entity changes state. Provides a `record()` method called by other engines on state changes (account login_state, slave status, conversation state, binding status, etc.). Also provides `query()` for audit trails and debugging.

Sole owner of `state_transition` writes — no other engine inserts directly.

## Interface
```typescript
type EntityType = 'account' | 'slave' | 'conversation' | 'binding' | 'capability' | 'config' | 'automation';

interface StateTransitionInput {
  entityType: EntityType;
  entityId: string;
  fromState: string | null;
  toState: string;
  trigger: string;         // e.g. 'login_detected', 'user_action', 'health_probe', 'seed_reload'
  metadata?: Record<string, unknown>;
}

interface StateTransitionRow {
  id: string;
  entityType: EntityType;
  entityId: string;
  fromState: string | null;
  toState: string;
  trigger: string;
  metadataJson: string;
  ts: number;
}

class StateTransitionEngine {
  constructor(private store: StateTransitionStore) {}

  async record(input: StateTransitionInput): Promise<StateTransitionRow>;
  async query(entityType: EntityType, entityId: string, opts?: { limit?: number; since?: number }): Promise<StateTransitionRow[]>;
  async queryByType(entityType: EntityType, opts?: { limit?: number; since?: number }): Promise<StateTransitionRow[]>;
}
```

## Store Contract
```typescript
interface StateTransitionStore {
  create(input: StateTransitionRow): Promise<StateTransitionRow>;
  listByEntity(entityType: string, entityId: string, opts?: { limit?: number; since?: number }): Promise<StateTransitionRow[]>;
  listByType(entityType: string, opts?: { limit?: number; since?: number }): Promise<StateTransitionRow[]>;
}
```

## Integration Points
- `ChromeGovernor.LifecycleManager` → calls `record({ entityType: 'slave', ... })` on spawn/kill/status change
- `ConversationManager` → calls `record({ entityType: 'conversation', ... })` on state change
- `ProviderRegistrar` → calls `record({ entityType: 'binding', ... })` on seed
- `ConfigManager` → calls `record({ entityType: 'config', ... })` on update
- `AutomationScheduler` → calls `record({ entityType: 'automation', ... })` on run start/complete

## Tests
- [ ] `record()` persists a transition row with correct fields
- [ ] `query()` returns transitions ordered by `ts DESC`
- [ ] `query()` respects `since` filter
- [ ] `queryByType()` returns all transitions for an entity type
- [ ] Metadata round-trips through JSON serialization
- [ ] `fromState: null` is valid for initial state transitions

## Gate
- `bunx tsc --noEmit` passes
- All tests pass with mocked `StateTransitionStore`
- Sole writer of `state_transition`
