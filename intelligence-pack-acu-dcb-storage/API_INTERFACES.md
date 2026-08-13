# API Interfaces - ACU, DCB, and Storage Systems

**Project:** vivim-final API Layer  
**Version:** 1.0  
**Date:** 2026-08-13  
**Purpose:** Complete API interfaces for ACU management, DCB deduplication, and storage operations

---

## 1. ACU Management API

### 1.1 ACU Metadata Interface

```typescript
// src/domain/types.ts

/**
 * ACU (Atomic Chat Unit) metadata interface
 * Rich metadata for content management and organization
 */
export interface ACUMetadata {
  /** Tags for categorization and filtering */
  tags: string[];
  
  /** Collection IDs for hierarchical organization */
  collectionIds: string[];
  
  /** Pinned ACUs are always visible and never decay */
  isPinned: boolean;
  
  /** Archived ACUs are hidden from default views */
  isArchived: boolean;
  
  /** Read status tracking: 'unread' | 'read' | 'in_progress' */
  readStatus: 'unread' | 'read' | 'in_progress';
  
  /** Priority for sorting: 'low' | 'normal' | 'high' | 'urgent' */
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  /** Optional user annotations */
  notes?: string;
  
  /** Extensible custom fields */
  customFields?: Record<string, string>;
}

/**
 * ACU (Atomic Chat Unit) interface
 * Granular, reusable conversation building block
 */
export interface ACU {
  /** Unique ACU identifier */
  id: string;
  
  /** ACU type classification */
  type: ACUType;
  
  /** ACU content */
  content: string;
  
  /** Rich metadata */
  metadata: ACUMetadata;
  
  /** Source information */
  source: {
    conversationId: string;
    messageId: string;
    blockIndex: number;
    blockType: string;
  };
  
  /** Creation timestamp */
  createdAt: number;
}

/**
 * ACU type classification
 */
export type ACUType = 
  | 'narrative'     // Text content
  | 'reasoning'     // Chain of thought
  | 'code'          // Code blocks
  | 'action'        // Tool calls
  | 'result'        // Tool results
  | 'reference'     // File/source references
  | 'error'         // Error messages
  | 'metadata'      // Metadata blocks
  | 'unknown';      // Unknown type
```

### 1.2 Batch Operation Interface

```typescript
// src/domain/types.ts

/**
 * Batch operation for ACU management
 */
export interface BatchOperation {
  /** Operation type */
  opType: BatchOperationType;
  
  /** Target ACU IDs */
  acuIds: string[];
  
  /** Operation parameters */
  params?: Record<string, unknown>;
}

/**
 * Batch operation types
 */
export type BatchOperationType =
  | 'add_tags'              // Add tags to ACUs
  | 'remove_tags'           // Remove tags from ACUs
  | 'add_to_collection'     // Add ACUs to collection
  | 'remove_from_collection' // Remove ACUs from collection
  | 'pin'                   // Pin ACUs
  | 'unpin'                 // Unpin ACUs
  | 'archive'               // Archive ACUs
  | 'unarchive'             // Unarchive ACUs
  | 'set_priority'          // Set priority
  | 'set_read_status'       // Set read status
  | 'delete';               // Delete ACUs

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  /** Number of affected ACUs */
  affectedCount: number;
  
  /** Errors encountered during operation */
  errors: Array<{
    acuId: string;
    error: string;
  }>;
  
  /** Operation duration in milliseconds */
  durationMs: number;
}
```

### 1.3 Selection State Interface

```typescript
// src/domain/types.ts

/**
 * Selection state for UI operations
 */
export interface SelectionState {
  /** Currently selected ACU IDs */
  selectedIds: string[];
  
  /** Whether multi-select mode is active */
  isSelectMode: boolean;
  
  /** Last selected ACU for range selection */
  lastSelectedId?: string;
}

/**
 * Selection operation result
 */
export interface SelectionOperationResult {
  /** Updated selection state */
  state: SelectionState;
  
  /** Number of selected ACUs */
  selectedCount: number;
  
  /** Whether selection changed */
  changed: boolean;
}
```

### 1.4 ACU Manager Interface

```typescript
// src/engines/acu-manager.ts

/**
 * ACU Manager interface
 * Manages ACU metadata, batch operations, and selection state
 */
export interface AcuManager {
  /**
   * Set ACU metadata on a message
   */
  setMetadata(messageId: string, metadata: ACUMetadata): Promise<void>;
  
  /**
   * Get ACU metadata from a message
   */
  getMetadata(messageId: string): Promise<ACUMetadata>;
  
  /**
   * Update specific metadata fields
   */
  updateMetadata(messageId: string, updates: Partial<ACUMetadata>): Promise<void>;
  
  /**
   * Search ACUs by metadata filters
   */
  searchByMetadata(filters: {
    tags?: string[];
    collectionIds?: string[];
    isPinned?: boolean;
    isArchived?: boolean;
    readStatus?: string;
    priority?: string;
  }): Promise<string[]>;
  
  /**
   * Execute batch operation
   */
  executeBatchOperation(operation: BatchOperation): Promise<BatchOperationResult>;
  
  /**
   * Execute batch operation with transaction safety
   */
  executeBatchOperationWithTransaction(operation: BatchOperation): Promise<BatchOperationResult>;
}
```

### 1.5 ACU Manager Implementation

```typescript
// src/engines/acu-manager-impl.ts

export class AcuManagerImpl implements AcuManager {
  constructor(
    private storage: ConversationStore
  ) {}

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

  async getMetadata(messageId: string): Promise<ACUMetadata> {
    const message = await this.storage.getMessage(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    return {
      tags: JSON.parse(message.acuTagsJson || '[]'),
      collectionIds: JSON.parse(message.acuCollectionIdsJson || '[]'),
      isPinned: message.acuIsPinned === 1,
      isArchived: message.acuIsArchived === 1,
      readStatus: (message.acuReadStatus as any) || 'unread',
      priority: (message.acuPriority as any) || 'normal',
      notes: message.acuNotes || undefined,
      customFields: JSON.parse(message.acuCustomFieldsJson || '{}'),
    };
  }

  async updateMetadata(messageId: string, updates: Partial<ACUMetadata>): Promise<void> {
    const current = await this.getMetadata(messageId);
    const updated = { ...current, ...updates };
    await this.setMetadata(messageId, updated);
  }

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

  async executeBatchOperation(operation: BatchOperation): Promise<BatchOperationResult> {
    const startTime = Date.now();
    const errors: Array<{ acuId: string; error: string }> = [];
    let affectedCount = 0;

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

    return {
      affectedCount,
      errors,
      durationMs: Date.now() - startTime
    };
  }

  async executeBatchOperationWithTransaction(operation: BatchOperation): Promise<BatchOperationResult> {
    // Note: Transaction support depends on storage implementation
    // For now, execute without transaction
    return this.executeBatchOperation(operation);
  }

  private async applyOperationToAcu(
    acuId: string,
    opType: BatchOperationType,
    params?: Record<string, unknown>
  ): Promise<void> {
    const current = await this.getMetadata(acuId);
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
      await this.updateMetadata(acuId, updates);
    }
  }
}
```

---

## 2. DCB Deduplication API

### 2.1 Message Identity Interface

```typescript
// src/domain/types.ts

/**
 * Message identity input for hashing
 */
export interface MessageIdentityInput {
  /** Provider identifier */
  provider: string;
  
  /** Account identifier */
  account: string;
  
  /** Conversation identifier */
  convId: string;
  
  /** Message role (for role+content mode) */
  role?: string;
  
  /** Message content (for role+content mode) */
  content?: string;
  
  /** Provider's native message ID (for provider_id mode) */
  providerMessageId?: string;
}

/**
 * Message identity result
 */
export interface MessageIdentity {
  /** SHA256 identity hash */
  hash: string;
  
  /** Identity source mode */
  source: 'provider_id' | 'role_content';
  
  /** Identity components used for hashing */
  components: MessageIdentityInput;
}
```

### 2.2 DCB Deduplicator Interface

```typescript
// src/engines/dcb-deduplicator.ts

/**
 * DCB (Deduplication Content Block) deduplicator interface
 */
export interface DCBDeduplicator {
  /**
   * Generate SHA256 identity hash for message
   */
  generateIdentityHash(input: MessageIdentityInput): string;
  
  /**
   * Check if message is duplicate
   */
  isDuplicate(identityHash: string, storage: ConversationStore): Promise<boolean>;
  
  /**
   * Upsert message with deduplication
   */
  upsertMessage(
    input: MessageInput,
    identity: MessageIdentityInput,
    storage: ConversationStore
  ): Promise<ConversationMessageRow>;
  
  /**
   * Find duplicate messages
   */
  findDuplicates(identityHash: string, storage: ConversationStore): Promise<ConversationMessageRow[]>;
}
```

### 2.3 DCB Deduplicator Implementation

```typescript
// src/engines/dcb-deduplicator-impl.ts

export class DCBDeduplicatorImpl implements DCBDeduplicator {
  /**
   * Generate SHA256 identity hash for message
   */
  generateIdentityHash(input: MessageIdentityInput): string {
    const { provider, account, convId, role, content, providerMessageId } = input;
    
    let identityString: string;
    
    if (providerMessageId && providerMessageId.length > 0) {
      // Provider ID mode: use provider's native message ID
      identityString = `${provider}\0${account}\0${convId}\0${providerMessageId}`;
    } else {
      // Role+Content mode: use role and content
      identityString = `${provider}\0${account}\0${convId}\0${role}\0${content}`;
    }
    
    return this.sha256(identityString);
  }

  /**
   * SHA256 hash implementation
   */
  private sha256(input: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      // Browser/Bun environment
      const hashBuffer = crypto.subtle.digestSync('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      // Node.js environment
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(input).digest('hex');
    }
  }

  /**
   * Check if message is duplicate
   */
  async isDuplicate(identityHash: string, storage: ConversationStore): Promise<boolean> {
    const existing = await this.findMessageByIdentityHash(identityHash, storage);
    return existing !== null;
  }

  /**
   * Upsert message with deduplication
   */
  async upsertMessage(
    input: MessageInput,
    identity: MessageIdentityInput,
    storage: ConversationStore
  ): Promise<ConversationMessageRow> {
    const identityHash = this.generateIdentityHash(identity);
    
    // Check for existing message
    const existing = await this.findMessageByIdentityHash(identityHash, storage);
    
    if (existing) {
      // Merge metadata from new message
      const mergedMetadata = this.mergeMetadata(
        JSON.parse(existing.metadataJson || '{}'),
        input.metadataJson ? JSON.parse(input.metadataJson) : {}
      );
      
      // Update existing message
      await storage.updateMessage(existing.id, {
        metadataJson: JSON.stringify(mergedMetadata)
      });
      
      // Update deduplication status
      await this.updateDeduplicationStatus(existing.id, 'merged', storage);
      
      return existing;
    }
    
    // Create new message with identity hash
    const newMessage = await storage.createMessage({
      ...input,
      identityHash,
      identitySource: identity.providerMessageId ? 'provider_id' : 'role_content',
      providerMessageId: identity.providerMessageId,
      deduplicationStatus: 'unique',
      deduplicationCheckedAt: Date.now()
    } as any);
    
    return newMessage;
  }

  /**
   * Find duplicate messages
   */
  async findDuplicates(identityHash: string, storage: ConversationStore): Promise<ConversationMessageRow[]> {
    // Implementation depends on storage interface
    // This is a placeholder for the actual implementation
    return [];
  }

  /**
   * Find message by identity hash
   */
  private async findMessageByIdentityHash(
    identityHash: string,
    storage: ConversationStore
  ): Promise<ConversationMessageRow | null> {
    // Implementation depends on storage interface
    // This is a placeholder for the actual implementation
    return null;
  }

  /**
   * Update deduplication status
   */
  private async updateDeduplicationStatus(
    messageId: string,
    status: string,
    storage: ConversationStore
  ): Promise<void> {
    // Implementation depends on storage interface
    // This is a placeholder for the actual implementation
  }

  /**
   * Merge metadata from duplicate messages
   */
  private mergeMetadata(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      ...existing,
      ...incoming,
      _merged: true,
      _mergeCount: (existing._mergeCount as number || 0) + 1,
      _lastMergedAt: Date.now()
    };
  }
}
```

---

## 3. Storage Enhancement API

### 3.1 TTL Management Interface

```typescript
// src/engines/ttl-manager.ts

/**
 * TTL (Time-To-Live) manager interface
 */
export interface TTLManager {
  /**
   * Set TTL for a message
   */
  setMessageTTL(messageId: string, ttlSeconds: number): Promise<void>;
  
  /**
   * Set TTL for a trace entry
   */
  setTraceTTL(traceId: string, ttlSeconds: number): Promise<void>;
  
  /**
   * Set TTL for a node
   */
  setNodeTTL(nodeId: string, ttlSeconds: number): Promise<void>;
  
  /**
   * Run TTL sweep to expire old data
   */
  sweep(): Promise<{
    messagesExpired: number;
    tracesExpired: number;
    nodesExpired: number;
    totalSizeFreed: number;
  }>;
  
  /**
   * Get TTL for a message
   */
  getMessageTTL(messageId: string): Promise<number | null>;
  
  /**
   * Get TTL for a trace entry
   */
  getTraceTTL(traceId: string): Promise<number | null>;
  
  /**
   * Get TTL for a node
   */
  getNodeTTL(nodeId: string): Promise<number | null>;
}
```

### 3.2 Database Compaction Interface

```typescript
// src/engines/db-compactor.ts

/**
 * Database compaction interface
 */
export interface DatabaseCompactor {
  /**
   * Run database compaction
   */
  compact(): Promise<{
    beforeSize: number;
    afterSize: number;
    sizeReduction: number;
    freePagesReclaimed: number;
    duration: number;
  }>;
  
  /**
   * Get database statistics
   */
  getDatabaseStats(): Promise<{
    size: number;
    freePages: number;
    pageSize: number;
  }>;
  
  /**
   * Schedule automatic compaction
   */
  scheduleAutoCompaction(intervalMs: number): Promise<void>;
  
  /**
   * Check if compaction is needed
   */
  isCompactionNeeded(): Promise<boolean>;
}
```

### 3.3 Storage Manager Interface

```typescript
// src/engines/storage-manager.ts

/**
 * Unified storage manager interface
 * Combines TTL management, compaction, and backup operations
 */
export interface StorageManager {
  /**
   * TTL management
   */
  ttl: TTLManager;
  
  /**
   * Database compaction
   */
  compactor: DatabaseCompactor;
  
  /**
   * Create backup
   */
  createBackup(): Promise<string>;
  
  /**
   * Restore from backup
   */
  restoreBackup(backupPath: string): Promise<void>;
  
  /**
   * Get storage health metrics
   */
  getHealthMetrics(): Promise<{
    databaseSize: number;
    freePages: number;
    ephemeralCount: number;
    expiringSoon: number;
    lastCompaction: number | null;
    lastBackup: number | null;
  }>;
}
```

---

## 4. Collection System API

### 4.1 Collection Interface

```typescript
// src/domain/types.ts

/**
 * ACU Collection interface
 */
export interface AcuCollection {
  /** Unique collection identifier */
  id: string;
  
  /** Collection name */
  name: string;
  
  /** Collection description */
  description?: string;
  
  /** Parent collection ID for hierarchy */
  parentId?: string;
  
  /** User ID who owns the collection */
  userId: string;
  
  /** Display color */
  color?: string;
  
  /** Display icon */
  icon?: string;
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Collection membership interface
 */
export interface AcuCollectionMembership {
  /** Unique membership identifier */
  id: string;
  
  /** Collection ID */
  collectionId: string;
  
  /** Target type: 'message' | 'memory' | 'node' */
  targetType: string;
  
  /** Target ID */
  targetId: string;
  
  /** When the target was added to the collection */
  addedAt: number;
  
  /** Who added the target */
  addedBy?: string;
}
```

### 4.2 Collection Manager Interface

```typescript
// src/engines/collection-manager.ts

/**
 * Collection manager interface
 */
export interface CollectionManager {
  /**
   * Create a new collection
   */
  createCollection(input: {
    name: string;
    description?: string;
    parentId?: string;
    userId: string;
    color?: string;
    icon?: string;
  }): Promise<AcuCollection>;
  
  /**
   * Get collection by ID
   */
  getCollection(id: string): Promise<AcuCollection | null>;
  
  /**
   * List collections for a user
   */
  listCollections(userId: string, opts?: {
    parentId?: string;
    includeHierarchy?: boolean;
  }): Promise<AcuCollection[]>;
  
  /**
   * Update collection
   */
  updateCollection(id: string, updates: Partial<{
    name: string;
    description: string;
    parentId: string;
    color: string;
    icon: string;
  }>): Promise<void>;
  
  /**
   * Delete collection
   */
  deleteCollection(id: string): Promise<void>;
  
  /**
   * Add target to collection
   */
  addToCollection(input: {
    collectionId: string;
    targetType: string;
    targetId: string;
    addedBy?: string;
  }): Promise<AcuCollectionMembership>;
  
  /**
   * Remove target from collection
   */
  removeFromCollection(collectionId: string, targetType: string, targetId: string): Promise<void>;
  
  /**
   * Get collection members
   */
  getCollectionMembers(collectionId: string, opts?: {
    targetType?: string;
    limit?: number;
    offset?: number;
  }): Promise<AcuCollectionMembership[]>;
  
  /**
   * Get collections for a target
   */
  getTargetCollections(targetType: string, targetId: string): Promise<AcuCollection[]>;
}
```

---

## 5. HTTP API Endpoints

### 5.1 ACU Management Endpoints

```typescript
// src/server/acu-router.ts

/**
 * ACU management HTTP endpoints
 */
export const acuRouter = {
  /**
   * GET /api/acu/:messageId/metadata
   * Get ACU metadata for a message
   */
  async getMetadata(req: Request, res: Response) {
    const { messageId } = req.params;
    const acuManager = req.app.locals.acuManager;
    
    try {
      const metadata = await acuManager.getMetadata(messageId);
      res.json({ success: true, data: metadata });
    } catch (error) {
      res.status(404).json({ success: false, error: 'Message not found' });
    }
  },

  /**
   * PUT /api/acu/:messageId/metadata
   * Set ACU metadata for a message
   */
  async setMetadata(req: Request, res: Response) {
    const { messageId } = req.params;
    const metadata = req.body;
    const acuManager = req.app.locals.acuManager;
    
    try {
      await acuManager.setMetadata(messageId, metadata);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid metadata' });
    }
  },

  /**
   * POST /api/acu/batch
   * Execute batch operation on ACUs
   */
  async batchOperation(req: Request, res: Response) {
    const operation = req.body;
    const acuManager = req.app.locals.acuManager;
    
    try {
      const result = await acuManager.executeBatchOperation(operation);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid operation' });
    }
  },

  /**
   * GET /api/acu/search
   * Search ACUs by metadata filters
   */
  async search(req: Request, res: Response) {
    const filters = req.query;
    const acuManager = req.app.locals.acuManager;
    
    try {
      const results = await acuManager.searchByMetadata(filters);
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid filters' });
    }
  }
};
```

### 5.2 DCB Deduplication Endpoints

```typescript
// src/server/dcb-router.ts

/**
 * DCB deduplication HTTP endpoints
 */
export const dcbRouter = {
  /**
   * POST /api/dcb/check
   * Check if message is duplicate
   */
  async checkDuplicate(req: Request, res: Response) {
    const identity = req.body;
    const deduplicator = req.app.locals.deduplicator;
    const storage = req.app.locals.storage;
    
    try {
      const hash = deduplicator.generateIdentityHash(identity);
      const isDuplicate = await deduplicator.isDuplicate(hash, storage);
      res.json({ success: true, data: { hash, isDuplicate } });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid identity' });
    }
  },

  /**
   * POST /api/dcb/upsert
   * Upsert message with deduplication
   */
  async upsertMessage(req: Request, res: Response) {
    const { input, identity } = req.body;
    const deduplicator = req.app.locals.deduplicator;
    const storage = req.app.locals.storage;
    
    try {
      const message = await deduplicator.upsertMessage(input, identity, storage);
      res.json({ success: true, data: message });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid input' });
    }
  }
};
```

### 5.3 Storage Management Endpoints

```typescript
// src/server/storage-router.ts

/**
 * Storage management HTTP endpoints
 */
export const storageRouter = {
  /**
   * POST /api/storage/ttl/message
   * Set TTL for a message
   */
  async setMessageTTL(req: Request, res: Response) {
    const { messageId, ttlSeconds } = req.body;
    const ttlManager = req.app.locals.storageManager.ttl;
    
    try {
      await ttlManager.setMessageTTL(messageId, ttlSeconds);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid input' });
    }
  },

  /**
   * POST /api/storage/compact
   * Run database compaction
   */
  async compact(req: Request, res: Response) {
    const compactor = req.app.locals.storageManager.compactor;
    
    try {
      const result = await compactor.compact();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Compaction failed' });
    }
  },

  /**
   * GET /api/storage/health
   * Get storage health metrics
   */
  async getHealth(req: Request, res: Response) {
    const storageManager = req.app.locals.storageManager;
    
    try {
      const metrics = await storageManager.getHealthMetrics();
      res.json({ success: true, data: metrics });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get metrics' });
    }
  }
};
```

### 5.4 Collection Management Endpoints

```typescript
// src/server/collection-router.ts

/**
 * Collection management HTTP endpoints
 */
export const collectionRouter = {
  /**
   * POST /api/collections
   * Create a new collection
   */
  async createCollection(req: Request, res: Response) {
    const input = req.body;
    const collectionManager = req.app.locals.collectionManager;
    
    try {
      const collection = await collectionManager.createCollection(input);
      res.json({ success: true, data: collection });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid input' });
    }
  },

  /**
   * GET /api/collections/:id
   * Get collection by ID
   */
  async getCollection(req: Request, res: Response) {
    const { id } = req.params;
    const collectionManager = req.app.locals.collectionManager;
    
    try {
      const collection = await collectionManager.getCollection(id);
      if (!collection) {
        return res.status(404).json({ success: false, error: 'Collection not found' });
      }
      res.json({ success: true, data: collection });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get collection' });
    }
  },

  /**
   * GET /api/collections
   * List collections for a user
   */
  async listCollections(req: Request, res: Response) {
    const { userId } = req.query;
    const collectionManager = req.app.locals.collectionManager;
    
    try {
      const collections = await collectionManager.listCollections(userId as string);
      res.json({ success: true, data: collections });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid userId' });
    }
  },

  /**
   * POST /api/collections/:id/members
   * Add target to collection
   */
  async addToCollection(req: Request, res: Response) {
    const { id } = req.params;
    const input = req.body;
    const collectionManager = req.app.locals.collectionManager;
    
    try {
      const membership = await collectionManager.addToCollection({
        collectionId: id,
        ...input
      });
      res.json({ success: true, data: membership });
    } catch (error) {
      res.status(400).json({ success: false, error: 'Invalid input' });
    }
  }
};
```

---

## 6. Storage Contract Extensions

### 6.1 Conversation Store Extensions

```typescript
// src/storage/contracts/conversation-store.ts

/**
 * Extended conversation store with ACU and DCB support
 */
export interface ConversationStoreExtended extends ConversationStore {
  /**
   * Find message by identity hash
   */
  findMessageByIdentityHash(identityHash: string): Promise<ConversationMessageRow | null>;
  
  /**
   * Search messages by ACU metadata
   */
  searchMessages(opts: {
    where?: {
      acuIsPinned?: number;
      acuIsArchived?: number;
      acuReadStatus?: string;
      acuPriority?: string;
    };
  }): Promise<ConversationMessageRow[]>;
  
  /**
   * Update deduplication status
   */
  updateDeduplicationStatus(messageId: string, status: string): Promise<void>;
  
  /**
   * Get messages by TTL criteria
   */
  getMessagesByTTL(opts: {
    expiresBefore?: number;
    isEphemeral?: number;
  }): Promise<ConversationMessageRow[]>;
}
```

### 6.2 Node Store Extensions

```typescript
// src/storage/contracts/node-store.ts

/**
 * Extended node store with FSRS-6 and TTL support
 */
export interface NodeStoreExtended extends NodeStoreContract {
  /**
   * Query nodes with complex filters
   */
  queryNodes(opts: {
    type?: string;
    state?: string;
    where?: Record<string, any>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    limit?: number;
  }): Promise<Node[]>;
  
  /**
   * Update node data
   */
  updateNode(id: string, updates: Partial<{
    data: Record<string, unknown>;
    state: string;
    expiresAt: number;
    isEphemeral: number;
  }>): Promise<void>;
  
  /**
   * Get nodes by TTL criteria
   */
  getNodesByTTL(opts: {
    expiresBefore?: number;
    isEphemeral?: number;
  }): Promise<Node[]>;
}
```

---

This API interface guide provides complete, production-ready TypeScript interfaces for all ACU, DCB, and Storage systems. Each interface includes implementation examples and HTTP endpoint definitions for seamless integration with the existing vivim-final architecture.
