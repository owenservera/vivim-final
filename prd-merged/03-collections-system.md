# PRD: Collections System (M2)

**Product:** vivim-final Message Organization  
**Source:** intelligence-pack-acu-dcb-storage  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13  
**Phase:** 3 (Collections System)

---

## Executive Summary

This PRD details the implementation of a collections system for vivim-final. This enhancement enables users to organize messages and content into hierarchical collections, similar to the ACU collection system from edge-pwa, adapted to the vivim-final architecture.

**Key Deliverables:**
- Collection and CollectionItem models
- Collection engine for management
- RESTful APIs for collection CRUD
- Integration with existing conversation/node systems

**Estimated Effort:** 2 weeks  
**Risk Level:** Medium (new models and engine, but follows existing patterns)

---

## Background

### Current State

vivim-final organization system has:
- Topic and Project models for conversation organization (lines 2080, 2092 in schema)
- No Collection model anywhere in the 204 models of `prisma/schema.prisma`
- No hierarchical collection system
- No way to group messages into custom collections
- No collection management APIs

### Problem Statement

The current organization system lacks:
1. **Custom Collections:** No way to create user-defined collections
2. **Hierarchical Organization:** No nested collection structure
3. **Message Collection Membership:** No way to add messages to collections
4. **Collection Management APIs:** No APIs to manage collections

### Solution Overview

Implement a collections system that:
- Supports hierarchical collection structure
- Allows adding messages to collections
- Provides RESTful APIs for collection management
- Integrates with existing Topic/Project systems

---

## Requirements

### Functional Requirements

#### FR-1: Collection Model

**FR-1.1:** Create `Collection` model:
```prisma
model Collection {
  id          String   @id @default(cuid())
  name        String
  parentId    String?  @map("parent_id")
  userId      String   @map("user_id")
  description String?
  color       String?  // Hex color for UI
  icon        String?  // Icon identifier
  createdAt   BigInt   @map("created_at")
  updatedAt   BigInt   @map("updated_at")
  
  parent      Collection?   @relation("CollectionHierarchy", fields: [parentId], references: [id])
  children    Collection[]  @relation("CollectionHierarchy")
  items       CollectionItem[]
  
  @@index([userId], map: "idx_coll_user")
  @@index([parentId], map: "idx_coll_parent")
  @@map("collection")
}
```

**FR-1.2:** Create `CollectionItem` model:
```prisma
model CollectionItem {
  id            String   @id @default(cuid())
  collectionId  String   @map("collection_id")
  itemType      String   @map("item_type") // "message" | "node" | "conversation"
  itemId        String   @map("item_id")
  order         Int      @default(0)
  addedAt       BigInt   @map("added_at")
  
  collection    Collection @relation(fields: [collectionId], references: [id])
  
  @@unique([collectionId, itemType, itemId])
  @@index([collectionId], map: "idx_ci_coll")
  @@index([itemType, itemId], map: "idx_ci_item")
  @@map("collection_item")
}
```

**FR-1.3:** Define item types:
- "message" - ConversationMessage
- "node" - Node
- "conversation" - Conversation

**FR-1.4:** Support hierarchical collections:
- Collections can have parent/child relationships
- Maximum depth: 5 levels (to prevent complexity)
- Circular reference prevention

#### FR-2: Collection Engine

**FR-2.1:** Create `CollectionEngine` class:
```typescript
export class CollectionEngine {
  /**
   * Create a new collection
   */
  async createCollection(input: CollectionInput): Promise<Collection>;
  
  /**
   * Update a collection
   */
  async updateCollection(id: string, patch: Partial<CollectionInput>): Promise<Collection>;
  
  /**
   * Delete a collection (cascade delete items)
   */
  async deleteCollection(id: string): Promise<void>;
  
  /**
   * Get collection by ID
   */
  async getCollection(id: string): Promise<Collection | null>;
  
  /**
   * List collections for user
   */
  async listCollections(userId: string, opts?: {
    parentId?: string;
    includeItems?: boolean;
  }): Promise<Collection[]>;
  
  /**
   * Add item to collection
   */
  async addItem(collectionId: string, itemType: string, itemId: string): Promise<CollectionItem>;
  
  /**
   * Remove item from collection
   */
  async removeItem(collectionId: string, itemType: string, itemId: string): Promise<void>;
  
  /**
   * List items in collection
   */
  async listItems(collectionId: string): Promise<CollectionItem[]>;
  
  /**
   * Move collection (change parent)
   */
  async moveCollection(id: string, newParentId: string | null): Promise<Collection>;
}
```

**FR-2.2:** Implement hierarchy validation:
- Prevent circular references
- Enforce maximum depth (5 levels)
- Validate parent exists

**FR-2.3:** Implement item type validation:
- Validate itemType is one of allowed types
- Validate itemId exists in corresponding table
- Prevent duplicate items in same collection

#### FR-3: Store Contracts

**FR-3.1:** Create `CollectionStore` contract:
```typescript
export interface CollectionStore {
  create(input: CollectionInput): Promise<Collection>;
  get(id: string): Promise<Collection | null>;
  update(id: string, patch: Partial<CollectionInput>): Promise<Collection>;
  delete(id: string): Promise<void>;
  list(userId: string, opts?: CollectionQueryOpts): Promise<Collection[]>;
  getByParent(parentId: string | null): Promise<Collection[]>;
}

export interface CollectionItemStore {
  add(collectionId: string, itemType: string, itemId: string): Promise<CollectionItem>;
  remove(collectionId: string, itemType: string, itemId: string): Promise<void>;
  list(collectionId: string): Promise<CollectionItem[]>;
  exists(collectionId: string, itemType: string, itemId: string): Promise<boolean>;
}
```

#### FR-4: RESTful APIs

**FR-4.1:** Implement collection CRUD APIs:
- `POST /api/collections` - Create collection
- `GET /api/collections/:id` - Get collection
- `PATCH /api/collections/:id` - Update collection
- `DELETE /api/collections/:id` - Delete collection
- `GET /api/collections` - List collections (with filters)

**FR-4.2:** Implement collection item APIs:
- `POST /api/collections/:id/items` - Add item to collection
- `DELETE /api/collections/:id/items/:itemType/:itemId` - Remove item
- `GET /api/collections/:id/items` - List items in collection

**FR-4.3:** Implement collection hierarchy APIs:
- `PATCH /api/collections/:id/move` - Move collection to new parent
- `GET /api/collections/:id/children` - Get child collections

### Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** Collection CRUD latency < 100ms
**NFR-1.2:** Item add/remove latency < 50ms
**NFR-1.3:** Collection list latency < 200ms for 100 collections

#### NFR-2: Accuracy

**NFR-2.1:** Hierarchy validation must prevent circular references
**NFR-2.2:** Item type validation must prevent invalid types
**NFR-2.3:** Duplicate items must be prevented

#### NFR-3: Reliability

**NFR-3.1:** Collection deletion must cascade to items
**NFR-3.2:** Hierarchy operations must be atomic
**NFR-3.3:** Item operations must handle missing collections gracefully

#### NFR-4: Compatibility

**NFR-4.1:** All changes must be backward compatible
**NFR-4.2:** Existing Topic/Project systems must continue to work
**NFR-4.3:** API changes must be additive

---

## Technical Design

### Data Model Changes

#### Schema Addition

```prisma
// prisma/schema.prisma

model Collection {
  id          String   @id @default(cuid())
  name        String
  parentId    String?  @map("parent_id")
  userId      String   @map("user_id")
  description String?
  color       String?
  icon        String?
  createdAt   BigInt   @map("created_at")
  updatedAt   BigInt   @map("updated_at")
  
  parent      Collection?   @relation("CollectionHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children    Collection[]  @relation("CollectionHierarchy")
  items       CollectionItem[]
  
  @@index([userId], map: "idx_coll_user")
  @@index([parentId], map: "idx_coll_parent")
  @@map("collection")
}

model CollectionItem {
  id            String   @id @default(cuid())
  collectionId  String   @map("collection_id")
  itemType      String   @map("item_type")
  itemId        String   @map("item_id")
  order         Int      @default(0)
  addedAt       BigInt   @map("added_at")
  
  collection    Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  
  @@unique([collectionId, itemType, itemId])
  @@index([collectionId], map: "idx_ci_coll")
  @@index([itemType, itemId], map: "idx_ci_item")
  @@map("collection_item")
}
```

### Algorithm Implementation

#### Collection Engine

```typescript
// src/engines/collection-engine.ts

import { newId } from '../ids.js';
import type { CollectionStore, CollectionItemStore } from '../storage/contracts/collection-store.js';
import { NotFoundError, ValidationError } from '../errors.js';

export interface CollectionInput {
  name: string;
  parentId?: string | null;
  userId: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface Collection {
  id: string;
  name: string;
  parentId: string | null;
  userId: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CollectionItem {
  id: string;
  collectionId: string;
  itemType: string;
  itemId: string;
  order: number;
  addedAt: number;
}

const MAX_DEPTH = 5;
const ALLOWED_ITEM_TYPES = ['message', 'node', 'conversation'];

export class CollectionEngine {
  constructor(
    private collectionStore: CollectionStore,
    private itemStore: CollectionItemStore
  ) {}
  
  /**
   * Create a new collection
   */
  async createCollection(input: CollectionInput): Promise<Collection> {
    // Validate hierarchy depth
    if (input.parentId) {
      const depth = await this.calculateDepth(input.parentId);
      if (depth >= MAX_DEPTH) {
        throw new ValidationError(`Maximum collection depth (${MAX_DEPTH}) exceeded`);
      }
    }
    
    const now = Date.now();
    const collection = await this.collectionStore.create({
      id: newId(),
      ...input,
      parentId: input.parentId ?? null,
      createdAt: now,
      updatedAt: now,
    });
    
    return collection;
  }
  
  /**
   * Update a collection
   */
  async updateCollection(id: string, patch: Partial<CollectionInput>): Promise<Collection> {
    // Validate hierarchy depth if parent is changing
    if (patch.parentId !== undefined) {
      const depth = await this.calculateDepth(patch.parentId);
      if (depth >= MAX_DEPTH) {
        throw new ValidationError(`Maximum collection depth (${MAX_DEPTH}) exceeded`);
      }
    }
    
    return await this.collectionStore.update(id, {
      ...patch,
      updatedAt: Date.now(),
    });
  }
  
  /**
   * Delete a collection (cascade delete items)
   */
  async deleteCollection(id: string): Promise<void> {
    await this.collectionStore.delete(id);
  }
  
  /**
   * Get collection by ID
   */
  async getCollection(id: string): Promise<Collection | null> {
    return await this.collectionStore.get(id);
  }
  
  /**
   * List collections for user
   */
  async listCollections(userId: string, opts?: {
    parentId?: string;
    includeItems?: boolean;
  }): Promise<Collection[]> {
    return await this.collectionStore.list(userId, {
      parentId: opts?.parentId,
    });
  }
  
  /**
   * Add item to collection
   */
  async addItem(collectionId: string, itemType: string, itemId: string): Promise<CollectionItem> {
    // Validate item type
    if (!ALLOWED_ITEM_TYPES.includes(itemType)) {
      throw new ValidationError(`Invalid item type: ${itemType}`);
    }
    
    // Check if collection exists
    const collection = await this.collectionStore.get(collectionId);
    if (!collection) {
      throw new NotFoundError(`Collection not found: ${collectionId}`);
    }
    
    // Check if item already exists
    const exists = await this.itemStore.exists(collectionId, itemType, itemId);
    if (exists) {
      throw new ValidationError(`Item already exists in collection`);
    }
    
    const now = Date.now();
    return await this.itemStore.add(collectionId, itemType, itemId);
  }
  
  /**
   * Remove item from collection
   */
  async removeItem(collectionId: string, itemType: string, itemId: string): Promise<void> {
    await this.itemStore.remove(collectionId, itemType, itemId);
  }
  
  /**
   * List items in collection
   */
  async listItems(collectionId: string): Promise<CollectionItem[]> {
    return await this.itemStore.list(collectionId);
  }
  
  /**
   * Move collection (change parent)
   */
  async moveCollection(id: string, newParentId: string | null): Promise<Collection> {
    // Validate hierarchy depth
    if (newParentId) {
      const depth = await this.calculateDepth(newParentId);
      if (depth >= MAX_DEPTH) {
        throw new ValidationError(`Maximum collection depth (${MAX_DEPTH}) exceeded`);
      }
    }
    
    // Check for circular reference
    if (newParentId) {
      const isCircular = await this.isCircularReference(id, newParentId);
      if (isCircular) {
        throw new ValidationError('Circular reference detected');
      }
    }
    
    return await this.collectionStore.update(id, {
      parentId: newParentId,
      updatedAt: Date.now(),
    });
  }
  
  /**
   * Calculate hierarchy depth from root to collection
   */
  private async calculateDepth(collectionId: string | null): Promise<number> {
    if (!collectionId) return 0;
    
    let depth = 0;
    let currentId = collectionId;
    
    while (currentId) {
      depth++;
      if (depth > MAX_DEPTH) break;
      
      const collection = await this.collectionStore.get(currentId);
      if (!collection) break;
      
      currentId = collection.parentId;
    }
    
    return depth;
  }
  
  /**
   * Check for circular reference
   */
  private async isCircularReference(collectionId: string, newParentId: string): Promise<boolean> {
    let currentId = newParentId;
    
    while (currentId) {
      if (currentId === collectionId) return true;
      
      const collection = await this.collectionStore.get(currentId);
      if (!collection) break;
      
      currentId = collection.parentId;
    }
    
    return false;
  }
}
```

---

## Implementation Plan

### Phase 3.1: Schema Changes (Day 1-2)

**Tasks:**
1. Create `Collection` model in Prisma schema
2. Create `CollectionItem` model in Prisma schema
3. Add indexes for performance
4. Run `bunx prisma db push --skip-generate`
5. Rebuild fixture database if needed

**Deliverables:**
- Updated Prisma schema
- Database migration applied
- Fixture database updated

**Success Criteria:**
- Schema changes applied successfully
- No breaking changes to existing data
- Indexes created for performance

### Phase 3.2: Store Contracts and Implementation (Day 3-4)

**Tasks:**
1. Create `CollectionStore` contract
2. Create `CollectionItemStore` contract
3. Implement store contracts in `src/storage/impl/`
4. Add unit tests for store methods

**Deliverables:**
- Store contracts
- Store implementations
- Unit tests passing

**Success Criteria:**
- Store methods work correctly
- Hierarchy validation works
- Unit tests pass

### Phase 3.3: Collection Engine (Day 5-7)

**Tasks:**
1. Create `CollectionEngine` class
2. Implement collection CRUD methods
3. Implement item management methods
4. Implement hierarchy validation
5. Add integration tests

**Deliverables:**
- Collection engine
- Integration tests passing

**Success Criteria:**
- Collection engine works correctly
- Hierarchy validation prevents circular references
- Integration tests pass

### Phase 3.4: API Implementation (Day 8-9)

**Tasks:**
1. Create `collection-router.ts`
2. Implement collection CRUD APIs
3. Implement collection item APIs
4. Implement hierarchy APIs
5. Add API tests

**Deliverables:**
- API routes implemented
- API tests passing

**Success Criteria:**
- API routes work correctly
- API tests pass
- Error handling is robust

### Phase 3.5: Integration and Testing (Day 10)

**Tasks:**
1. Wire collection engine into bootstrap
2. Run full test suite
3. Test with real data
4. Performance testing
5. Regression testing

**Deliverables:**
- Engine wired into bootstrap
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

**Risk 1: Circular Reference in Hierarchy**
- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - Implement circular reference detection
  - Validate hierarchy depth
  - Add comprehensive tests

**Risk 2: Performance Degradation**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Add indexes for foreign keys
  - Performance testing before rollout
  - Monitor query performance

**Risk 3: Cascade Delete Issues**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Use Prisma cascade delete
  - Test deletion thoroughly
  - Implement soft delete option

### Integration Risks

**Risk 1: Breaking Existing Topic/Project System**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Collections are separate from Topic/Project
  - No changes to existing models
  - Comprehensive regression testing

**Risk 2: Item Type Validation**
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:**
  - Validate item types at engine level
  - Check item existence in corresponding tables
  - Return clear error messages

---

## Success Metrics

### Quantitative Metrics

- **Collection CRUD Latency:** < 100ms (target)
- **Item Add/Remove Latency:** < 50ms (target)
- **Collection List Latency:** < 200ms for 100 collections (target)
- **API Error Rate:** < 1% (target)

### Qualitative Metrics

- **User Experience:** Smooth collection management
- **Hierarchy Integrity:** No circular references
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
- Feature flag can disable collection system if needed
- Database backup before deployment

---

## References

- `AGENTS.md` - Project instructions and conventions
- `intelligence-pack-acu-dcb-storage/PRD_ACU_INTEGRATION.md` - Source ACU collections PRD
- `prisma/schema.prisma` - Existing Topic/Project models
- `src/storage/contracts/` - Existing store contract patterns
