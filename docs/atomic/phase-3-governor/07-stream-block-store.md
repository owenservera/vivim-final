# Unit 3.7: StreamBlockStore

**Phase:** 3 | **File:** `src/engines/stream-block-store.ts`
**Depends:** 1.4 CapStoreDb | **Produces:** ContentBlock persistence + retrieval
**Source:** `04-merged-engines.md` §9

## Purpose
Thin persistence engine for `ContentBlock[]`. Batched INSERT. Paginated retrieval. Filtering by block kind. No business logic — pure persistence.

## Interface
```typescript
class StreamBlockStore {
  constructor(private db: CapStoreDb) {}

  async storeBlocks(
    conversationId: string,
    messageId: string,
    blocks: ContentBlock[],
  ): Promise<void>;

  async getBlocksByConversation(
    conversationId: string,
    opts?: {
      messageId?: string;
      blockKind?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<StreamBlockRow[]>;

  async getBlocksByMessage(messageId: string): Promise<StreamBlockRow[]>;
}
```

## ContentBlock Types
```typescript
type ContentBlock =
  | { kind: 'text'; content: string; index: number }
  | { kind: 'thinking'; content: string; index: number }
  | { kind: 'code'; content: string; language?: string; index: number }
  | { kind: 'artifact'; content: string; artifactType?: string; index: number }
  | { kind: 'image'; url: string; alt?: string; index: number }
  | { kind: 'citation'; content: string; source?: string; index: number }
  | { kind: 'tool_use'; toolName: string; input: Record<string, unknown>; index: number }
  | { kind: 'error'; message: string; code?: string; index: number }
  | { kind: 'meta'; key: string; value: unknown; index: number };
```

## Storage SQL Pattern
```sql
-- Batched INSERT (all blocks in one statement)
INSERT OR IGNORE INTO stream_block
  (id, conversation_id, message_id, block_index, block_kind, block_data, block_meta, created_at)
VALUES (?, ?, ?, 0, 'text', ?, '{}', ?), (?, ?, ?, 1, 'code', ?, '{}', ?), ...;

-- Paginated retrieval
SELECT * FROM stream_block
WHERE conversation_id = ?
  AND (? IS NULL OR message_id = ?)
  AND (? IS NULL OR block_kind = ?)
ORDER BY message_id, block_index
LIMIT ? OFFSET ?;

-- Message retrieval
SELECT * FROM stream_block WHERE message_id = ? ORDER BY block_index;
```

## Tests
- [ ] `storeBlocks()` inserts all blocks in a batch
- [ ] `getBlocksByConversation()` returns paginated blocks
- [ ] `getBlocksByMessage()` returns all blocks for a message
- [ ] Filtering by `blockKind` returns only matching blocks
- [ ] Blocks maintain correct `block_index` ordering
- [ ] Handles 100-block messages efficiently

## Gate
- `bunx tsc --noEmit` passes
- All tests pass
- Used by ConversationManager step 7 (STORE)
