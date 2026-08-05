# GLM Prompt: Storage Contract Alignment

## Objective
Align backend storage contracts with frontend expectations to ensure data consistency, proper type safety, and correct data transformation between layers.

## Critical Issues Found

### 1. Storage Contract Divergence

**Backend** (`src/storage/contracts/`) defines contracts like:
```typescript
interface ConversationStore {
  listConversations(opts: { limit: number }): Promise<ConversationRow[]>
  getConversation(id: string): Promise<ConversationRow | null>
  createConversation(data: CreateConversationInput): Promise<ConversationRow>
}
```

**Frontend** (`frontend/src/storage/contracts/`) defines different contracts:
```typescript
interface ConversationStorage {
  getAll(): Promise<Conversation[]>
  getById(id: string): Promise<Conversation | null>
  create(data: Partial<Conversation>): Promise<Conversation>
}
```

**Issue**: Different method names, different return types, different input types.

**Fix**: Create shared storage contract types or add adapter layer.

---

### 2. Row Type vs Domain Type

**Backend** uses `ConversationRow` (database row):
```typescript
interface ConversationRow {
  id: string
  providerSessionId: string
  providerId: string
  title: string | null
  state: string
  messageCount: number
  lastMessageAt: number | null
  contextJson: string
  createdAt: number
  updatedAt: number
}
```

**Frontend** uses `Conversation` (domain model):
```typescript
interface Conversation {
  id: string
  title?: string
  providerId?: string
  createdAt: string
  updatedAt?: string
}
```

**Issue**: Backend returns database rows, frontend expects domain models.

**Fix**: Add transformation layer or use shared domain types.

---

### 3. Timestamp Format Mismatch

**Backend**: Returns timestamps as `number` (Unix epoch milliseconds)
**Frontend**: Expects timestamps as `string` (ISO 8601)

**Issue**: Type mismatch causes runtime errors.

**Fix**: Add timestamp transformation in API layer or frontend.

---

### 4. Null vs Undefined

**Backend**: Uses `null` for missing values
**Frontend**: Uses `undefined` for optional fields

**Issue**: `null` and `undefined` have different semantics in TypeScript.

**Fix**: Standardize on one approach (prefer `null` for API responses).

---

### 5. Nested JSON Fields

**Backend**: Stores complex data as JSON strings (`contextJson`, `metadataJson`)
**Frontend**: Expects parsed objects (`context`, `metadata`)

**Issue**: Frontend receives strings, expects objects.

**Fix**: Add JSON parsing in API layer or frontend.

---

## Implementation Plan

### Phase 1: Create Shared Domain Types (Priority: HIGH)

1. Create `frontend/src/types/shared/domain.ts`
2. Define domain models that both layers use
3. Add transformation functions from rows to domain models

### Phase 2: Fix Timestamp Handling (Priority: HIGH)

1. Create `frontend/src/lib/timestamp.ts`
2. Add `toISO()` and `fromISO()` helpers
3. Use consistently in all API calls

### Phase 3: Add Transformation Layer (Priority: MEDIUM)

1. Create `frontend/src/api/transformers.ts`
2. Transform backend responses to frontend models
3. Handle null/undefined conversion

### Phase 4: Fix JSON Fields (Priority: MEDIUM)

1. Add JSON parsing in transformers
2. Handle malformed JSON gracefully
3. Add type validation for parsed data

### Phase 5: Update Storage Contracts (Priority: LOW)

1. Align method names across layers
2. Add shared contract types
3. Update implementations to match

---

## Files to Modify

### Backend
- `src/storage/contracts/conversation-store.ts` - Add domain types
- `src/storage/impl/conversation-store-impl.ts` - Add transformation
- `src/server/conversation-router.ts` - Transform before response

### Frontend
- `frontend/src/types/shared/domain.ts` - NEW: Domain types
- `frontend/src/lib/timestamp.ts` - NEW: Timestamp helpers
- `frontend/src/api/transformers.ts` - NEW: Response transformers
- `frontend/src/sdk/web/use-conversation.ts` - Use transformers
- `frontend/src/sdk/web/use-capability.ts` - Use transformers

---

## Validation Checklist

- [ ] All timestamps are consistently formatted
- [ ] Null/undefined handled correctly
- [ ] JSON fields parsed automatically
- [ ] Domain types match across layers
- [ ] Storage contracts aligned
- [ ] No runtime type errors
