# Unit 3.8-3.12: Store Contracts — Phase 3

**Phase:** 3 | **Files:** `src/storage/contracts/` (5 files)
**Depends:** 1.4 CapStoreDb | **Produces:** Store contracts for Governor + Conversation + Health + StreamBlock
**Source:** `04-merged-engines.md` §1, §2, §8

## GovernorStore
```typescript
// src/storage/contracts/governor-store.ts
interface GovernorStore {
  getAccount(accountId: string): Promise<ProviderAccountRow | null>;
  getAccountsByProvider(providerId: string): Promise<ProviderAccountRow[]>;
  upsertAccount(account: ProviderAccountRow): Promise<void>;
  deleteAccount(accountId: string): Promise<void>;
  createFleetEvent(event: FleetEventInput): Promise<FleetEventRow>;
  getFleetEvents(slaveId: string, limit?: number): Promise<FleetEventRow[]>;
  getCircuitState(slaveId: string): Promise<CircuitBreakerStateRow | null>;
  upsertCircuitState(state: CircuitBreakerStateRow): Promise<void>;
  createHealthTick(tick: HealthTickInput): Promise<HealthTickRow>;
  createTraceEntry(entry: TraceEntryInput): Promise<TraceEntryRow>;
  getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]>;
}
```

## ConversationStore
```typescript
// src/storage/contracts/conversation-store.ts
interface ConversationStore {
  getConversation(id: string): Promise<ConversationRow | null>;
  createConversation(input: ConversationInput): Promise<ConversationRow>;
  updateConversation(id: string, patch: Partial<ConversationRow>): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  listConversations(opts?: { providerId?: string; limit?: number; offset?: number }): Promise<ConversationRow[]>;
  createMessage(input: MessageInput): Promise<ConversationMessageRow>;
  getMessage(id: string): Promise<ConversationMessageRow | null>;
  getMessages(conversationId: string, opts?: { limit?: number; before?: string }): Promise<ConversationMessageRow[]>;
  getLastMessage(conversationId: string): Promise<ConversationMessageRow | null>;
  getAccount(sessionId: string): Promise<ProviderAccountRow | null>;
}
```

## HealthStore
```typescript
// src/storage/contracts/health-store.ts
interface HealthStore {
  getCircuitStates(providerId: string): Promise<CircuitBreakerStateRow[]>;
  getRecentDrifts(providerId: string, windowMs: number): Promise<DriftEvent[]>;
  upsertProviderHealth(report: ProviderHealthReport): Promise<void>;
  getProviderHealth(providerId: string): Promise<ProviderHealthReport | null>;
  getHealthHistory(providerId: string, limit?: number): Promise<HealthHistoryRow[]>;
  getActiveProviders(): Promise<string[]>;
}
```

## Store Impls (Phase 3)
```typescript
// src/storage/impl/governor-store-impl.ts
class GovernorStoreImpl implements GovernorStore {
  constructor(private db: CapStoreDb) {}
  // Implement all GovernorStore methods using Prisma
}

// src/storage/impl/conversation-store-impl.ts
class ConversationStoreImpl implements ConversationStore {
  constructor(private db: CapStoreDb) {}
  // Implement all ConversationStore methods using Prisma
}

// src/storage/impl/health-store-impl.ts
class HealthStoreImpl implements HealthStore {
  constructor(private db: CapStoreDb) {}
  // Implement all HealthStore methods using Prisma
}

// src/storage/impl/stream-block-store-impl.ts
class StreamBlockStoreImpl {
  constructor(private db: CapStoreDb) {}
  // Implement block persistence using Prisma
}
```

## Tests (per store contract)
- [ ] GovernorStore: CRUD for accounts, fleet events, circuit state, health ticks, trace entries
- [ ] ConversationStore: CRUD for conversations, messages, account access via session
- [ ] HealthStore: circuit states, drift queries, provider health upsert, active providers
- [ ] StreamBlockStore: batched block inserts, paginated retrieval, kind filtering

## Gate
- `bunx tsc --noEmit` passes
- All store tests pass with in-memory dev.db
- Store impls are injectable into engines (constructor receives interface, not impl)
