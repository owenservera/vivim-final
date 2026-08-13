# PRD: Message Metadata and CRUD APIs (M5+M6)

**Product:** vivim-final Message System  
**Source:** intelligence-pack-acu-dcb-storage  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13  
**Phase:** 2 (Message Metadata)

---

## Executive Summary

This PRD details the implementation of message metadata (pin, archive, read status) and CRUD APIs for vivim-final. This enhancement enables rich message management capabilities similar to the ACU metadata system from edge-pwa, adapted to the vivim-final architecture.

**Key Deliverables:**
- Pin/archive/readStatus fields on ConversationMessage
- CRUD APIs for message metadata management
- Extended ConversationStore contract
- Integration with existing conversation manager

**Estimated Effort:** 1 week  
**Risk Level:** Low (additive changes, extends existing patterns)

---

## Background

### Current State

vivim-final message system has:
- `ConversationMessage` model with basic fields (line 632 in schema)
- No pin/archive/readStatus fields on messages
- `isPinned` exists only on `MemoryCurated` (line 2317) and `ContentItem` (line 3344)
- `isArchived` exists only on `EntityContainer` (line 3285) and `SlackChannelMeta` (line 3592)
- Basic CRUD operations through CapStoreDb
- No PUT/PATCH/DELETE APIs for message metadata

### Problem Statement

The current message system lacks:
1. **Message Pinning:** No way to pin important messages
2. **Message Archiving:** No way to archive old/unwanted messages
3. **Read Status:** No way to track read/unread state
4. **CRUD APIs:** No APIs to update message metadata

### Solution Overview

Implement message metadata fields and CRUD APIs to create a sophisticated message management system that:
- Allows pinning important messages
- Enables archiving old messages
- Tracks read status for messages
- Provides RESTful APIs for metadata management

---

## Requirements

### Functional Requirements

#### FR-1: Schema Additions

**FR-1.1:** Add metadata fields to `ConversationMessage` model:
```prisma
model ConversationMessage {
  // ... existing fields ...
  
  // NEW: Message metadata
  isPinned     Int     @default(0) @map("is_pinned")
  isArchived   Int     @default(0) @map("is_archived")
  readStatus   String  @default("unread") @map("read_status")
  
  @@index([isPinned], map: "idx_cm_pinned")
  @@index([isArchived], map: "idx_cm_archived")
  @@index([readStatus], map: "idx_cm_read")
  @@map("conversation_message")
}
```

**FR-1.2:** Define read status enum values:
- "unread" - Message not yet read
- "read" - Message has been read
- "in_progress" - Message currently being read

**FR-1.3:** Boolean to Int mapping:
- `isPinned`: 0 = false, 1 = true
- `isArchived`: 0 = false, 1 = true

#### FR-2: Store Contract Extension

**FR-2.1:** Extend `ConversationStore` contract:
```typescript
export interface ConversationStore {
  // ... existing methods ...
  
  /**
   * Update message metadata
   */
  updateMetadata(
    messageId: string,
    patch: {
      isPinned?: boolean;
      isArchived?: boolean;
      readStatus?: 'unread' | 'read' | 'in_progress';
    }
  ): Promise<ConversationMessage>;
  
  /**
   * Query messages by metadata
   */
  queryByMetadata(opts: {
    conversationId?: string;
    isPinned?: boolean;
    isArchived?: boolean;
    readStatus?: string;
    limit?: number;
    offset?: number;
  }): Promise<ConversationMessage[]>;
}
```

#### FR-3: CRUD APIs

**FR-3.1:** Implement `PATCH /api/conversations/:id/messages/:mid`:
```typescript
// Request body
{
  isPinned?: boolean;
  isArchived?: boolean;
  readStatus?: 'unread' | 'read' | 'in_progress';
}

// Response
{
  id: string;
  isPinned: boolean;
  isArchived: boolean;
  readStatus: string;
  // ... other message fields
}
```

**FR-3.2:** Implement `GET /api/conversations/:id/messages?isPinned=true&isArchived=false&readStatus=unread`
**FR-3.3:** Implement `PATCH /api/conversations/:id/messages/batch` for bulk operations:
```typescript
// Request body
{
  messageIds: string[];
  updates: {
    isPinned?: boolean;
    isArchived?: boolean;
    readStatus?: 'unread' | 'read' | 'in_progress';
  };
}

// Response
{
  updatedCount: number;
  errors: Array<{ messageId: string; error: string }>;
}
```

#### FR-4: Conversation Manager Integration

**FR-4.1:** Extend `ConversationManager` with metadata methods:
```typescript
export class ConversationManager {
  // ... existing methods ...
  
  /**
   * Pin a message
   */
  async pinMessage(messageId: string): Promise<ConversationMessage> {
    return await this.conversationStore.updateMetadata(messageId, { isPinned: true });
  }
  
  /**
   * Unpin a message
   */
  async unpinMessage(messageId: string): Promise<ConversationMessage> {
    return await this.conversationStore.updateMetadata(messageId, { isPinned: false });
  }
  
  /**
   * Archive a message
   */
  async archiveMessage(messageId: string): Promise<ConversationMessage> {
    return await this.conversationStore.updateMetadata(messageId, { isArchived: true });
  }
  
  /**
   * Unarchive a message
   */
  async unarchiveMessage(messageId: string): Promise<ConversationMessage> {
    return await this.conversationStore.updateMetadata(messageId, { isArchived: false });
  }
  
  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<ConversationMessage> {
    return await this.conversationStore.updateMetadata(messageId, { readStatus: 'read' });
  }
  
  /**
   * Mark message as unread
   */
  async markAsUnread(messageId: string): Promise<ConversationMessage> {
    return await this.conversationStore.updateMetadata(messageId, { readStatus: 'unread' });
  }
}
```

### Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** Metadata update latency < 50ms
**NFR-1.2:** Metadata query latency < 100ms for 1000 messages
**NFR-1.3:** Batch operation latency < 200ms for 100 messages

#### NFR-2: Accuracy

**NFR-2.1:** Metadata updates must persist correctly
**NFR-2.2:** Metadata queries must return correct results
**NFR-2.3:** Boolean to Int mapping must be correct

#### NFR-3: Reliability

**NFR-3.1:** Metadata updates must be atomic
**NFR-3.2:** Batch operations must handle partial failures
**NFR-3.3:** Invalid read status values must be rejected

#### NFR-4: Compatibility

**NFR-4.1:** All changes must be backward compatible
**NFR-4.2:** Existing message retrieval must continue to work
**NFR-4.3:** API changes must be additive

---

## Technical Design

### Data Model Changes

#### Schema Addition

```prisma
// prisma/schema.prisma

model ConversationMessage {
  id                    String   @id @default(cuid())
  conversationId        String   @map("conversation_id")
  role                  String
  content               String
  // ... existing fields ...
  
  // NEW: Message metadata
  isPinned     Int     @default(0) @map("is_pinned")
  isArchived   Int     @default(0) @map("is_archived")
  readStatus   String  @default("unread") @map("read_status")
  
  @@index([conversationId], map: "idx_cm_conv")
  @@index([isPinned], map: "idx_cm_pinned")
  @@index([isArchived], map: "idx_cm_archived")
  @@index([readStatus], map: "idx_cm_read")
  @@map("conversation_message")
}
```

### Algorithm Implementation

#### Store Implementation

```typescript
// src/storage/impl/conversation-store-impl.ts

export class ConversationStoreImpl implements ConversationStore {
  constructor(private prisma: PrismaClient) {}
  
  /**
   * Update message metadata
   */
  async updateMetadata(
    messageId: string,
    patch: {
      isPinned?: boolean;
      isArchived?: boolean;
      readStatus?: 'unread' | 'read' | 'in_progress';
    }
  ): Promise<ConversationMessage> {
    const data: Record<string, unknown> = { updatedAt: Date.now() };
    
    // Boolean to Int mapping
    if (patch.isPinned !== undefined) {
      data.isPinned = patch.isPinned ? 1 : 0;
    }
    if (patch.isArchived !== undefined) {
      data.isArchived = patch.isArchived ? 1 : 0;
    }
    if (patch.readStatus !== undefined) {
      data.readStatus = patch.readStatus;
    }
    
    const raw = await this.prisma.conversationMessage.update({
      where: { id: messageId },
      data,
    });
    
    return this.toRow(raw);
  }
  
  /**
   * Query messages by metadata
   */
  async queryByMetadata(opts: {
    conversationId?: string;
    isPinned?: boolean;
    isArchived?: boolean;
    readStatus?: string;
    limit?: number;
    offset?: number;
  }): Promise<ConversationMessage[]> {
    const where: Record<string, unknown> = {};
    
    if (opts.conversationId) {
      where.conversationId = opts.conversationId;
    }
    if (opts.isPinned !== undefined) {
      where.isPinned = opts.isPinned ? 1 : 0;
    }
    if (opts.isArchived !== undefined) {
      where.isArchived = opts.isArchived ? 1 : 0;
    }
    if (opts.readStatus) {
      where.readStatus = opts.readStatus;
    }
    
    const raws = await this.prisma.conversationMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: opts.limit ?? 100,
      skip: opts.offset ?? 0,
    });
    
    return raws.map(raw => this.toRow(raw));
  }
  
  // ... existing methods ...
}
```

#### API Implementation

```typescript
// src/server/conversation-router.ts

export function createConversationRouter(
  conversationManager: ConversationManager
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const url = new URL(req.url);
    
    // PATCH /api/conversations/:id/messages/:mid
    if (req.method === 'PATCH' && url.pathname.match(/^\/api\/conversations\/[^/]+\/messages\/[^/]+$/)) {
      const pathParts = url.pathname.split('/');
      const conversationId = pathParts[3];
      const messageId = pathParts[5];
      
      const body = await req.json();
      
      try {
        const message = await conversationManager.conversationStore.updateMetadata(
          messageId,
          body
        );
        
        return Response.json(message);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          { status: 400 }
        );
      }
    }
    
    // GET /api/conversations/:id/messages with metadata filters
    if (req.method === 'GET' && url.pathname.match(/^\/api\/conversations\/[^/]+\/messages$/)) {
      const pathParts = url.pathname.split('/');
      const conversationId = pathParts[3];
      
      const isPinned = url.searchParams.get('isPinned') === 'true';
      const isArchived = url.searchParams.get('isArchived') === 'true';
      const readStatus = url.searchParams.get('readStatus') || undefined;
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      
      try {
        const messages = await conversationManager.conversationStore.queryByMetadata({
          conversationId,
          isPinned,
          isArchived,
          readStatus,
          limit,
          offset,
        });
        
        return Response.json(messages);
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          { status: 400 }
        );
      }
    }
    
    // PATCH /api/conversations/:id/messages/batch
    if (req.method === 'PATCH' && url.pathname.match(/^\/api\/conversations\/[^/]+\/messages\/batch$/)) {
      const body = await req.json();
      const { messageIds, updates } = body;
      
      try {
        const errors: Array<{ messageId: string; error: string }> = [];
        let updatedCount = 0;
        
        for (const messageId of messageIds) {
          try {
            await conversationManager.conversationStore.updateMetadata(messageId, updates);
            updatedCount++;
          } catch (error) {
            errors.push({
              messageId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        
        return Response.json({ updatedCount, errors });
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          { status: 400 }
        );
      }
    }
    
    // ... existing routes ...
  };
}
```

---

## Implementation Plan

### Phase 2.1: Schema Changes (Day 1)

**Tasks:**
1. Add `isPinned`, `isArchived`, `readStatus` fields to `ConversationMessage` model
2. Add indexes for performance
3. Run `bunx prisma db push --skip-generate`
4. Rebuild fixture database if needed

**Deliverables:**
- Updated Prisma schema
- Database migration applied
- Fixture database updated

**Success Criteria:**
- Schema changes applied successfully
- No breaking changes to existing data
- Indexes created for performance

### Phase 2.2: Store Contract Extension (Day 2)

**Tasks:**
1. Extend `ConversationStore` contract with metadata methods
2. Implement `updateMetadata()` in store implementation
3. Implement `queryByMetadata()` in store implementation
4. Add unit tests for store methods

**Deliverables:**
- Extended store contract
- Store implementation
- Unit tests passing

**Success Criteria:**
- Store methods work correctly
- Boolean to Int mapping is correct
- Unit tests pass

### Phase 2.3: Conversation Manager Integration (Day 3)

**Tasks:**
1. Extend `ConversationManager` with metadata methods
2. Implement pin/unpin/archive/unarchive methods
3. Implement markAsRead/markAsUnread methods
4. Add integration tests

**Deliverables:**
- Extended conversation manager
- Integration tests passing

**Success Criteria:**
- Conversation manager methods work correctly
- Integration tests pass
- No regression in existing functionality

### Phase 2.4: API Implementation (Day 4)

**Tasks:**
1. Implement `PATCH /api/conversations/:id/messages/:mid` route
2. Implement `GET /api/conversations/:id/messages` with metadata filters
3. Implement `PATCH /api/conversations/:id/messages/batch` route
4. Add API tests

**Deliverables:**
- API routes implemented
- API tests passing

**Success Criteria:**
- API routes work correctly
- API tests pass
- Error handling is robust

### Phase 2.5: Testing and Validation (Day 5)

**Tasks:**
1. Run full test suite
2. Test with real conversation data
3. Performance testing (update latency, query latency)
4. Regression testing

**Deliverables:**
- Test results
- Performance metrics
- Validation report

**Success Criteria:**
- All tests pass
- Performance targets met
- No regressions detected

---

## Risk Mitigation

### Technical Risks

**Risk 1: Boolean to Int Mapping Errors**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Centralize mapping logic in store implementation
  - Add unit tests for mapping
  - Validate mapping in integration tests

**Risk 2: Performance Degradation**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Add indexes for metadata fields
  - Performance testing before rollout
  - Monitor query performance

**Risk 3: Invalid Read Status Values**
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:**
  - Validate read status in API layer
  - Use enum-like type checking
  - Return clear error messages

### Integration Risks

**Risk 1: Breaking Existing Message Retrieval**
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:**
  - All changes are additive
  - Maintain backward compatibility
  - Comprehensive regression testing

**Risk 2: Batch Operation Partial Failures**
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Return detailed error information
  - Continue processing on individual failures
  - Allow retry of failed operations

---

## Success Metrics

### Quantitative Metrics

- **Metadata Update Latency:** < 50ms (target)
- **Metadata Query Latency:** < 100ms for 1000 messages (target)
- **Batch Operation Latency:** < 200ms for 100 messages (target)
- **API Error Rate:** < 1% (target)

### Qualitative Metrics

- **User Experience:** Smooth pin/archive/read status operations
- **API Usability:** Clear error messages and consistent responses
- **System Stability:** No performance degradation

---

## Rollout Plan

### Deployment Steps

1. Deploy schema changes to development environment
2. Run integration tests with synthetic data
3. Deploy to staging with production data backup
4. Monitor performance metrics for 1 week
5. Gradual rollout to production (10% → 50% → 100%)

### Rollback Plan

- Schema changes are additive (safe to rollback)
- Feature flag can disable new APIs if needed
- Database backup before deployment

---

## References

- `AGENTS.md` - Project instructions and conventions
- `intelligence-pack-acu-dcb-storage/PRD_ACU_INTEGRATION.md` - Source ACU metadata PRD
- `src/storage/contracts/conversation-store.ts` - Existing store contract
- `src/engines/conversation-manager.ts` - Existing conversation manager
