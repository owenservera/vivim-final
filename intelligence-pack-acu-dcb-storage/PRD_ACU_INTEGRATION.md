# PRD: ACU Integration - Atomic Chat Units with Metadata and Batch Operations

**Product:** vivim-final Message System  
**Source:** edge-pwa backend/src/types.rs (lines 705-745)  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13

---

## 1. Executive Summary

This PRD details the integration of Atomic Chat Units (ACU) with metadata, batch operations, and selection state management from edge-pwa into vivim-final. ACUs represent granular, reusable conversation building blocks that can be composed, tagged, and managed across different contexts. This enhancement will transform the message system from simple text storage to a sophisticated content management system with rich metadata and batch operations.

**Key Deliverables:**
- ACUMetadata structure with tags, collections, pinning, archiving
- Batch operation system for ACU management
- Selection state management for UI operations
- Integration with existing message system
- ACU-to-message part mapping

**Estimated Effort:** 1 week  
**Risk Level:** Low (additive changes, well-defined data structures)

---

## 2. Background

### 2.1 Current State

vivim-final message system has:
- ConversationMessage model with basic fields
- Message blocks system (blocksJson)
- No ACU concept or metadata
- No batch operations for message management
- No selection state for UI operations
- Basic CRUD operations through Prisma

### 2.2 Problem Statement

The current message system lacks:
1. **Granular Content Units:** No ACU concept for reusable conversation building blocks
2. **Rich Metadata:** No tagging, collections, pinning, or archiving
3. **Batch Operations:** No efficient way to perform operations on multiple messages
4. **Selection State:** No UI state management for multi-select operations

### 2.3 Solution Overview

Implement ACU system from edge-pwa to create a sophisticated message management system that:
- Adds rich metadata to message parts
- Enables batch operations for efficient management
- Provides selection state for UI operations
- Maintains backward compatibility with existing message system

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: ACUMetadata Structure

**FR-1.1:** Implement ACUMetadata interface:
```typescript
interface ACUMetadata {
  tags: string[];
  collectionIds: string[];
  isPinned: boolean;
  isArchived: boolean;
  readStatus: string;
  priority: string;
  notes?: string;
  customFields?: Record<string, string>;
}
```

**FR-1.2:** Define tag system:
- Tags are arbitrary strings for categorization
- Multiple tags can be applied to a single ACU
- Tags support filtering and grouping

**FR-1.3:** Define collection system:
- Collections are hierarchical groups of ACUs
- ACUs can belong to multiple collections
- Collections support nested structure

**FR-1.4:** Define pinning and archiving:
- Pinned ACUs are always visible and never decay
- Archived ACUs are hidden from default views
- Pinned status overrides archiving

**FR-1.5:** Define read status:
- Read status tracks user interaction
- Values: "unread", "read", "in_progress"

**FR-1.6:** Define priority:
- Priority levels for sorting and filtering
- Values: "low", "normal", "high", "urgent"

**FR-1.7:** Define notes:
- Optional free-form notes for user annotations
- Supports rich text or plain text

**FR-1.8:** Define custom fields:
- Optional key-value pairs for extensibility
- Supports arbitrary metadata extensions

#### FR-2: Batch Operations

**FR-2.1:** Implement BatchOperation structure:
```typescript
interface BatchOperation {
  opType: string;
  acuIds: string[];
  params?: Record<string, unknown>;
}
```

**FR-2.2:** Define operation types:
- "add_tags" - Add tags to ACUs
- "remove_tags" - Remove tags from ACUs
- "add_to_collection" - Add ACUs to collection
- "remove_from_collection" - Remove ACUs from collection
- "pin" - Pin ACUs
- "unpin" - Unpin ACUs
- "archive" - Archive ACUs
- "unarchive" - Unarchive ACUs
- "set_priority" - Set priority
- "set_read_status" - Set read status
- "delete" - Delete ACUs

**FR-2.3:** Implement batch operation execution:
```
execute_batch_operation(operation):
    for each acu_id in operation.acu_ids:
        apply operation to acu_id with operation.params
    return count of affected ACUs
```

**FR-2.4:** Implement transaction safety:
- All ACU operations in a batch must succeed or fail together
- Rollback on failure
- Atomic updates

#### FR-3: Selection State

**FR-3.1:** Implement SelectionState structure:
```typescript
interface SelectionState {
  selectedIds: string[];
  isSelectMode: boolean;
  lastSelectedId?: string;
}
```

**FR-3.2:** Define selection modes:
- Normal mode: single selection, no multi-select
- Select mode: multi-select enabled

**FR-3.3:** Implement selection operations:
- Select single ACU
- Select multiple ACUs
- Deselect ACU
- Clear selection
- Select all
- Invert selection

**FR-3.4:** Implement range selection:
- Shift+click to select range from lastSelectedId to current
- Maintain selection order

**FR-3.5:** Implement selection persistence:
- Selection state persists during session
- Cleared on session exit or explicit clear

#### FR-4: ACU Integration

**FR-4.1:** Map ACU to message parts:
- Each message can contain multiple ACUs
- ACUs are stored as message blocks with metadata
- ACU ID is unique across system

**FR-4.2:** Implement ACU extraction from messages:
- Parse message content to identify ACUs
- Extract ACU metadata from message blocks
- Maintain ACU-to-message relationship

**FR-4.3:** Implement ACU reassembly:
- Combine ACUs into message content
- Preserve ACU ordering
- Apply ACU formatting

**FR-4.4:** Implement ACU search and filtering:
- Search by tags
- Search by collections
- Filter by pinning/archiving status
- Filter by priority
- Filter by read status

### 3.2 Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** Batch operation latency < 100ms for 100 ACUs
**NFR-1.2:** Selection state updates < 10ms
**NFR-1.3:** ACU search latency < 50ms for 1000 ACUs
**NFR-1.4:** ACU extraction latency < 20ms per message

#### NFR-2: Accuracy

**NFR-2.1:** Batch operations must affect all specified ACUs
**NFR-2.2:** Selection state must accurately reflect user selections
**NFR-2.3:** ACU search must return all matching ACUs

#### NFR-3: Reliability

**NFR-3.1:** Batch operations must be atomic (all or nothing)
**NFR-3.2:** Selection state must handle edge cases (empty selection, etc.)
**NFR-3.3:** ACU metadata must persist correctly

#### NFR-4: Compatibility

**NFR-4.1:** All changes must be backward compatible
**NFR-4.2:** Existing message system must continue to work
**NFR-4.3:** API changes must be additive

---

## 4. Technical Design

### 4.1 Data Model Changes

#### 4.1.1 ACUMetadata Interface

```typescript
// src/domain/types.ts

export interface ACUMetadata {
  tags: string[];
  collectionIds: string[];
  isPinned: boolean;
  isArchived: boolean;
  readStatus: 'unread' | 'read' | 'in_progress';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
  customFields?: Record<string, string>;
}
```

#### 4.1.2 BatchOperation Interface

```typescript
// src/domain/types.ts

export interface BatchOperation {
  opType: BatchOperationType;
  acuIds: string[];
  params?: Record<string, unknown>;
}

export type BatchOperationType =
  | 'add_tags'
  | 'remove_tags'
  | 'add_to_collection'
  | 'remove_from_collection'
  | 'pin'
  | 'unpin'
  | 'archive'
  | 'unarchive'
  | 'set_priority'
  | 'set_read_status'
  | 'delete';
```

#### 4.1.3 SelectionState Interface

```typescript
// src/domain/types.ts

export interface SelectionState {
  selectedIds: string[];
  isSelectMode: boolean;
  lastSelectedId?: string;
}
```

#### 4.1.4 Schema Changes

```prisma
// prisma/schema.prisma

model ConversationMessage {
  // ... existing fields ...
  
  // ACU metadata
  acuTagsJson String @default("[]") @map("acu_tags_json")
  acuCollectionIdsJson String @default("[]") @map("acu_collection_ids_json")
  acuIsPinned Int @default(0) @map("acu_is_pinned")
  acuIsArchived Int @default(0) @map("acu_is_archived")
  acuReadStatus String @default("unread") @map("acu_read_status")
  acuPriority String @default("normal") @map("acu_priority")
  acuNotes String? @map("acu_notes")
  acuCustomFieldsJson String @default("{}") @map("acu_custom_fields_json")
  
  @@index([acuIsPinned], map: "idx_cm_pinned")
  @@index([acuIsArchived], map: "idx_cm_archived")
  @@index([acuPriority], map: "idx_cm_priority")
  @@map("conversation_message")
}

model AcuCollection {
  id String @id
  name String
  parentId String? @map("parent_id")
  userId String @map("user_id")
  createdAt BigInt @map("created_at")
  updatedAt BigInt @map("updated_at")
  
  parent AcuCollection? @relation("CollectionHierarchy", fields: [parentId], references: [id])
  children AcuCollection[] @relation("CollectionHierarchy")
  
  @@index([userId], map: "idx_acu_user")
  @@map("acu_collection")
}
```

### 4.2 Algorithm Implementation

#### 4.2.1 ACU Metadata Manager

```typescript
// src/engines/acu-manager.ts

class AcuMetadataManager {
  constructor(private storage: AcuStorage) {}

  /**
   * Set ACU metadata on a message
   */
  async setMetadata(messageId: string, metadata: ACUMetadata): Promise<void> {
    await this.storage.updateMessage(messageId, {
      acuTagsJson: JSON.stringify(metadata.tags),
      acuCollectionIdsJson: JSON.stringify(metadata.collectionIds),
      acuIsPinned: metadata.isPinned ? 1 : 0,
      acuIsArchived: metadata.isArchived ? 1 : 0,
      acuReadStatus: metadata.readStatus,
      acuPriority: metadata.priority,
      acuNotes: metadata.notes || null,
      acuCustomFieldsJson: JSON.stringify(metadata.customFields || {}),
    });
  }

  /**
   * Get ACU metadata from a message
   */
  async getMetadata(messageId: string): Promise<ACUMetadata> {
    const message = await this.storage.getMessage(messageId);
    
    return {
      tags: JSON.parse(message.acuTagsJson || '[]'),
      collectionIds: JSON.parse(message.acuCollectionIdsJson || '[]'),
      isPinned: message.acuIsPinned === 1,
      isArchived: message.acuIsArchived === 1,
      readStatus: message.acuReadStatus || 'unread',
      priority: message.acuPriority || 'normal',
      notes: message.acuNotes || undefined,
      customFields: JSON.parse(message.acuCustomFieldsJson || '{}'),
    };
  }

  /**
   * Update specific metadata fields
   */
  async updateMetadata(
    messageId: string,
    updates: Partial<ACUMetadata>
  ): Promise<void> {
    const current = await this.getMetadata(messageId);
    const updated = { ...current, ...updates };
    await this.setMetadata(messageId, updated);
  }

  /**
   * Search ACUs by metadata
   */
  async searchByMetadata(filters: {
    tags?: string[];
    collectionIds?: string[];
    isPinned?: boolean;
    isArchived?: boolean;
    readStatus?: string;
    priority?: string;
  }): Promise<string[]> {
    const messages = await this.storage.searchMessages({
      where: {
        ...(filters.isPinned !== undefined && { acuIsPinned: filters.isPinned ? 1 : 0 }),
        ...(filters.isArchived !== undefined && { acuIsArchived: filters.isArchived ? 1 : 0 }),
        ...(filters.readStatus !== undefined && { acuReadStatus: filters.readStatus }),
        ...(filters.priority !== undefined && { acuPriority: filters.priority }),
      },
    });

    const results: string[] = [];
    for (const message of messages) {
      const metadata = await this.getMetadata(message.id);
      
      // Filter by tags
      if (filters.tags && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every(tag => metadata.tags.includes(tag));
        if (!hasAllTags) continue;
      }
      
      // Filter by collections
      if (filters.collectionIds && filters.collectionIds.length > 0) {
        const hasAnyCollection = filters.collectionIds.some(id =>
          metadata.collectionIds.includes(id)
        );
        if (!hasAnyCollection) continue;
      }
      
      results.push(message.id);
    }

    return results;
  }
}
```

#### 4.2.2 Batch Operation Manager

```typescript
// src/engines/batch-operation-manager.ts

class BatchOperationManager {
  constructor(
    private acuManager: AcuMetadataManager,
    private storage: AcuStorage
  ) {}

  /**
   * Execute a batch operation
   */
  async executeOperation(operation: BatchOperation): Promise<{
    affectedCount: number;
    errors: Array<{ acuId: string; error: string }>;
  }> {
    const errors: Array<{ acuId: string; error: string }> = [];
    let affectedCount = 0;

    // Execute operation on each ACU
    for (const acuId of operation.acuIds) {
      try {
        await this.applyOperationToAcu(acuId, operation.opType, operation.params);
        affectedCount++;
      } catch (error) {
        errors.push({
          acuId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { affectedCount, errors };
  }

  /**
   * Apply operation to a single ACU
   */
  private async applyOperationToAcu(
    acuId: string,
    opType: BatchOperationType,
    params?: Record<string, unknown>
  ): Promise<void> {
    const current = await this.acuManager.getMetadata(acuId);
    const updates: Partial<ACUMetadata> = {};

    switch (opType) {
      case 'add_tags':
        if (params?.tags && Array.isArray(params.tags)) {
          const newTags = params.tags as string[];
          updates.tags = [...new Set([...current.tags, ...newTags])];
        }
        break;

      case 'remove_tags':
        if (params?.tags && Array.isArray(params.tags)) {
          const tagsToRemove = params.tags as string[];
          updates.tags = current.tags.filter(tag => !tagsToRemove.includes(tag));
        }
        break;

      case 'add_to_collection':
        if (params?.collectionId) {
          updates.collectionIds = [...new Set([...current.collectionIds, params.collectionId as string])];
        }
        break;

      case 'remove_from_collection':
        if (params?.collectionId) {
          updates.collectionIds = current.collectionIds.filter(id => id !== params.collectionId);
        }
        break;

      case 'pin':
        updates.isPinned = true;
        break;

      case 'unpin':
        updates.isPinned = false;
        break;

      case 'archive':
        updates.isArchived = true;
        break;

      case 'unarchive':
        updates.isArchived = false;
        break;

      case 'set_priority':
        if (params?.priority) {
          updates.priority = params.priority as string;
        }
        break;

      case 'set_read_status':
        if (params?.readStatus) {
          updates.readStatus = params.readStatus as string;
        }
        break;

      case 'delete':
        await this.storage.deleteMessage(acuId);
        return; // Don't update metadata for deleted ACU
    }

    if (Object.keys(updates).length > 0) {
      await this.acuManager.updateMetadata(acuId, updates);
    }
  }

  /**
   * Execute batch operation with transaction safety
   */
  async executeOperationWithTransaction(
    operation: BatchOperation
  ): Promise<{
    affectedCount: number;
    errors: Array<{ acuId: string; error: string }>;
  }> {
    // Start transaction
    await this.storage.beginTransaction();

    try {
      const result = await this.executeOperation(operation);
      await this.storage.commitTransaction();
      return result;
    } catch (error) {
      await this.storage.rollbackTransaction();
      throw error;
    }
  }
}
```

#### 4.2.3 Selection State Manager

```typescript
// src/engines/selection-manager.ts

class SelectionStateManager {
  private state: SelectionState = {
    selectedIds: [],
    isSelectMode: false,
    lastSelectedId: undefined,
  };

  /**
   * Toggle select mode
   */
  toggleSelectMode(): void {
    this.state.isSelectMode = !this.state.isSelectMode;
    if (!this.state.isSelectMode) {
      this.clearSelection();
    }
  }

  /**
   * Select a single ACU
   */
  selectSingle(acuId: string): void {
    this.state.selectedIds = [acuId];
    this.state.lastSelectedId = acuId;
  }

  /**
   * Select multiple ACUs
   */
  selectMultiple(acuIds: string[]): void {
    this.state.selectedIds = acuIds;
    this.state.lastSelectedId = acuIds[acuIds.length - 1];
  }

  /**
   * Toggle selection for an ACU
   */
  toggleSelection(acuId: string): void {
    if (this.state.selectedIds.includes(acuId)) {
      this.state.selectedIds = this.state.selectedIds.filter(id => id !== acuId);
    } else {
      this.state.selectedIds.push(acuId);
      this.state.lastSelectedId = acuId;
    }
  }

  /**
   * Select range from lastSelectedId to current
   */
  selectRange(acuId: string, allAcuIds: string[]): void {
    if (!this.state.lastSelectedId) {
      this.selectSingle(acuId);
      return;
    }

    const lastIndex = allAcuIds.indexOf(this.state.lastSelectedId);
    const currentIndex = allAcuIds.indexOf(acuId);

    if (lastIndex === -1 || currentIndex === -1) {
      this.selectSingle(acuId);
      return;
    }

    const start = Math.min(lastIndex, currentIndex);
    const end = Math.max(lastIndex, currentIndex);
    const rangeIds = allAcuIds.slice(start, end + 1);

    this.selectMultiple(rangeIds);
  }

  /**
   * Deselect an ACU
   */
  deselect(acuId: string): void {
    this.state.selectedIds = this.state.selectedIds.filter(id => id !== acuId);
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.state.selectedIds = [];
    this.state.lastSelectedId = undefined;
  }

  /**
   * Select all ACUs
   */
  selectAll(acuIds: string[]): void {
    this.state.selectedIds = [...acuIds];
    this.state.lastSelectedId = acuIds[acuIds.length - 1];
  }

  /**
   * Invert selection
   */
  invertSelection(allAcuIds: string[]): void {
    const selectedSet = new Set(this.state.selectedIds);
    this.state.selectedIds = allAcuIds.filter(id => !selectedSet.has(id));
    this.state.lastSelectedId = this.state.selectedIds[this.state.selectedIds.length - 1];
  }

  /**
   * Get current selection state
   */
  getState(): SelectionState {
    return { ...this.state };
  }

  /**
   * Set selection state (for persistence)
   */
  setState(state: SelectionState): void {
    this.state = { ...state };
  }
}
```

### 4.3 API Design

#### 4.3.1 Enhanced Message API

```typescript
// src/storage/db.ts

export class CapStoreDb {
  // ... existing methods ...

  /**
   * Set ACU metadata on a message
   */
  async setAcuMetadata(messageId: string, metadata: ACUMetadata): Promise<void> {
    const acuManager = new AcuMetadataManager(this);
    await acuManager.setMetadata(messageId, metadata);
  }

  /**
   * Get ACU metadata from a message
   */
  async getAcuMetadata(messageId: string): Promise<ACUMetadata> {
    const acuManager = new AcuMetadataManager(this);
    return await acuManager.getMetadata(messageId);
  }

  /**
   * Search messages by ACU metadata
   */
  async searchByAcuMetadata(filters: {
    tags?: string[];
    collectionIds?: string[];
    isPinned?: boolean;
    isArchived?: boolean;
    readStatus?: string;
    priority?: string;
  }): Promise<string[]> {
    const acuManager = new AcuMetadataManager(this);
    return await acuManager.searchByMetadata(filters);
  }

  /**
   * Execute batch operation on ACUs
   */
  async executeBatchOperation(operation: BatchOperation): Promise<{
    affectedCount: number;
    errors: Array<{ acuId: string; error: string }>;
  }> {
    const batchManager = new BatchOperationManager(
      new AcuMetadataManager(this),
      this
    );
    return await batchManager.executeOperationWithTransaction(operation);
  }
}
```

---

## 5. Implementation Plan

### 5.1 Phase 1: Foundation (Days 1-2)

**Tasks:**
1. Add ACUMetadata interface to domain/types.ts
2. Add BatchOperation and BatchOperationType interfaces
3. Add SelectionState interface
4. Add AcuCollection model to Prisma schema
5. Add ACU metadata fields to ConversationMessage model
6. Run schema migration

**Deliverables:**
- Core type definitions
- Schema changes
- Migration script

**Success Criteria:**
- Schema migration completes successfully
- Types compile without errors
- No regression in existing functionality

### 5.2 Phase 2: ACU Metadata Manager (Days 3-4)

**Tasks:**
1. Implement AcuMetadataManager class
2. Implement metadata CRUD operations
3. Implement metadata search and filtering
4. Integrate with existing message storage
5. Add unit tests for metadata operations

**Deliverables:**
- ACU metadata manager implementation
- Storage integration
- Unit tests

**Success Criteria:**
- Metadata CRUD operations work correctly
- Search returns correct results
- Unit tests pass

### 5.3 Phase 3: Batch Operations (Days 5-6)

**Tasks:**
1. Implement BatchOperationManager class
2. Implement all batch operation types
3. Implement transaction safety
4. Add error handling and rollback
5. Add integration tests

**Deliverables:**
- Batch operation manager implementation
- Transaction safety
- Integration tests

**Success Criteria:**
- Batch operations affect all specified ACUs
- Transactions roll back on failure
- Integration tests pass

### 5.4 Phase 4: Selection State (Days 7)

**Tasks:**
1. Implement SelectionStateManager class
2. Implement all selection operations
3. Implement range selection
4. Add state persistence
5. Add unit tests

**Deliverables:**
- Selection state manager implementation
- Unit tests
- Documentation

**Success Criteria:**
- Selection operations work correctly
- Range selection handles edge cases
- Unit tests pass

---

## 6. Testing Strategy

### 6.1 Unit Tests

#### ACU Metadata Tests

```typescript
describe('AcuMetadataManager', () => {
  test('set and get metadata', async () => {
    const manager = new AcuMetadataManager(storage);
    const metadata: ACUMetadata = {
      tags: ['tag1', 'tag2'],
      collectionIds: ['collection1'],
      isPinned: true,
      isArchived: false,
      readStatus: 'read',
      priority: 'high',
      notes: 'Test note',
      customFields: { key: 'value' },
    };

    await manager.setMetadata('msg1', metadata);
    const retrieved = await manager.getMetadata('msg1');

    expect(retrieved.tags).toEqual(['tag1', 'tag2']);
    expect(retrieved.isPinned).toBe(true);
    expect(retrieved.priority).toBe('high');
  });

  test('search by tags', async () => {
    const manager = new AcuMetadataManager(storage);
    
    await manager.setMetadata('msg1', { tags: ['tag1'], collectionIds: [], isPinned: false, isArchived: false, readStatus: 'unread', priority: 'normal' });
    await manager.setMetadata('msg2', { tags: ['tag2'], collectionIds: [], isPinned: false, isArchived: false, readStatus: 'unread', priority: 'normal' });
    await manager.setMetadata('msg3', { tags: ['tag1'], collectionIds: [], isPinned: false, isArchived: false, readStatus: 'unread', priority: 'normal' });

    const results = await manager.searchByMetadata({ tags: ['tag1'] });
    
    expect(results).toContain('msg1');
    expect(results).toContain('msg3');
    expect(results).not.toContain('msg2');
  });
});
```

#### Batch Operation Tests

```typescript
describe('BatchOperationManager', () => {
  test('add tags to multiple ACUs', async () => {
    const manager = new BatchOperationManager(acuManager, storage);
    
    const operation: BatchOperation = {
      opType: 'add_tags',
      acuIds: ['msg1', 'msg2', 'msg3'],
      params: { tags: ['new_tag'] },
    };

    const result = await manager.executeOperation(operation);
    
    expect(result.affectedCount).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  test('transaction rollback on error', async () => {
    const manager = new BatchOperationManager(acuManager, storage);
    
    const operation: BatchOperation = {
      opType: 'add_tags',
      acuIds: ['msg1', 'invalid_id'],
      params: { tags: ['new_tag'] },
    };

    await expect(manager.executeOperationWithTransaction(operation)).rejects.toThrow();
    
    // Verify msg1 was not updated
    const metadata = await acuManager.getMetadata('msg1');
    expect(metadata.tags).not.toContain('new_tag');
  });
});
```

#### Selection State Tests

```typescript
describe('SelectionStateManager', () => {
  test('select single ACU', () => {
    const manager = new SelectionStateManager();
    
    manager.selectSingle('msg1');
    const state = manager.getState();
    
    expect(state.selectedIds).toEqual(['msg1']);
    expect(state.lastSelectedId).toBe('msg1');
  });

  test('select range', () => {
    const manager = new SelectionStateManager();
    const allIds = ['msg1', 'msg2', 'msg3', 'msg4', 'msg5'];
    
    manager.selectSingle('msg1');
    manager.selectRange('msg3', allIds);
    const state = manager.getState();
    
    expect(state.selectedIds).toEqual(['msg1', 'msg2', 'msg3']);
  });

  test('invert selection', () => {
    const manager = new SelectionStateManager();
    const allIds = ['msg1', 'msg2', 'msg3'];
    
    manager.selectMultiple(['msg1', 'msg3']);
    manager.invertSelection(allIds);
    const state = manager.getState();
    
    expect(state.selectedIds).toEqual(['msg2']);
  });
});
```

### 6.2 Integration Tests

```typescript
describe('ACU Integration', () => {
  test('ACU metadata on message creation', async () => {
    const db = new CapStoreDb();
    
    const message = await db.prisma.conversationMessage.create({
      data: {
        conversationId: 'conv1',
        role: 'user',
        content: 'Test message',
      },
    });

    const metadata: ACUMetadata = {
      tags: ['test'],
      collectionIds: [],
      isPinned: false,
      isArchived: false,
      readStatus: 'unread',
      priority: 'normal',
    };

    await db.setAcuMetadata(message.id, metadata);
    const retrieved = await db.getAcuMetadata(message.id);

    expect(retrieved.tags).toEqual(['test']);
  });

  test('batch operation on multiple messages', async () => {
    const db = new CapStoreDb();
    
    const msg1 = await db.prisma.conversationMessage.create({
      data: { conversationId: 'conv1', role: 'user', content: 'Test 1' },
    });
    const msg2 = await db.prisma.conversationMessage.create({
      data: { conversationId: 'conv1', role: 'user', content: 'Test 2' },
    });

    const operation: BatchOperation = {
      opType: 'pin',
      acuIds: [msg1.id, msg2.id],
    };

    const result = await db.executeBatchOperation(operation);

    expect(result.affectedCount).toBe(2);
  });
});
```

---

## 7. Rollout Plan

### 7.1 Feature Flags

```typescript
const FEATURES = {
  ACU_METADATA: process.env.FEATURE_ACU_METADATA === 'true',
  BATCH_OPERATIONS: process.env.FEATURE_BATCH_OPERATIONS === 'true',
  SELECTION_STATE: process.env.FEATURE_SELECTION_STATE === 'true',
};
```

### 7.2 Phased Rollout

**Week 1:** Development environment testing
**Week 1:** Staging environment with production data copy
**Week 2:** 10% production rollout
**Week 2:** 50% production rollout
**Week 2:** 100% production rollout

### 7.3 Monitoring

**Metrics to Track:**
- ACU metadata adoption rate
- Batch operation usage
- Selection state usage
- ACU search performance
- Tag and collection usage

**Alerts:**
- Batch operation failure rate > 1%
- Selection state corruption
- ACU search latency > 100ms

---

## 8. Success Metrics

### 8.1 Quantitative Metrics

- **ACU Metadata Adoption:** % of messages with ACU metadata (target: 50%)
- **Batch Operation Usage:** Number of batch operations per day (target: 100+)
- **Selection State Usage:** % of sessions using selection mode (target: 30%)
- **Tag Usage:** Average tags per ACU (target: 2-3)
- **Performance:** Batch operation < 100ms for 100 ACUs (target: 95% of requests)

### 8.2 Qualitative Metrics

- **User Experience:** User feedback on ACU metadata
- **Batch Operation Efficiency:** User feedback on batch operations
- **Selection State Usability:** User feedback on selection UI
- **System Performance:** No degradation in existing functionality

---

## 9. Risks and Mitigations

### 9.1 Technical Risks

**Risk 1:** Schema migration issues
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:** Pre-migration backups, rollback plan, testing

**Risk 2:** Batch operation performance degradation
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:** Performance testing, batching, optimization

**Risk 3:** Selection state corruption
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:** State validation, error handling, recovery

### 9.2 Integration Risks

**Risk 1:** Breaking existing message system
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:** All changes additive, backward compatibility, regression testing

### 9.3 Operational Risks

**Risk 1:** Increased storage usage from metadata
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:** Metadata is small, monitoring, cleanup

---

## 10. Appendix

### 10.1 ACU Metadata Reference

The ACUMetadata structure provides rich metadata for conversation building blocks:

```typescript
interface ACUMetadata {
  tags: string[];              // Categorization tags
  collectionIds: string[];     // Collection membership
  isPinned: boolean;          // Always visible, no decay
  isArchived: boolean;         // Hidden from default views
  readStatus: string;          // User interaction tracking
  priority: string;            // Sorting and filtering
  notes?: string;              // User annotations
  customFields?: Record<string, string>; // Extensibility
}
```

### 10.2 Batch Operation Reference

Batch operations support the following types:

- **add_tags:** Add tags to ACUs
- **remove_tags:** Remove tags from ACUs
- **add_to_collection:** Add ACUs to collection
- **remove_from_collection:** Remove ACUs from collection
- **pin:** Pin ACUs (always visible)
- **unpin:** Unpin ACUs
- **archive:** Archive ACUs (hidden)
- **unarchive:** Unarchive ACUs
- **set_priority:** Set priority level
- **set_read_status:** Set read status
- **delete:** Delete ACUs

### 10.3 Selection State Reference

Selection state supports the following operations:

- **selectSingle:** Select single ACU
- **selectMultiple:** Select multiple ACUs
- **toggleSelection:** Toggle selection for ACU
- **selectRange:** Select range from lastSelectedId to current
- **deselect:** Deselect ACU
- **clearSelection:** Clear all selections
- **selectAll:** Select all ACUs
- **invertSelection:** Invert selection

---

**Document Version:** 1.0  
**Last Updated:** 2026-08-13  
**Status:** Ready for Review  
