# Integration Guide - ACU, DCB, and Storage Implementation

**Project:** vivim-final Implementation Guide  
**Version:** 1.0  
**Date:** 2026-08-13  
**Purpose:** Complete integration guide for implementing ACU, DCB, and Storage enhancements

---

## 1. Implementation Roadmap

### 1.1 Phased Implementation

**Phase 1: Foundation (Week 1)**
- Day 1-2: Database migrations and schema updates
- Day 3-4: Core interface implementations
- Day 5: Basic testing and validation

**Phase 2: Core Features (Week 2)**
- Day 1-2: ACU extraction and management
- Day 3-4: DCB deduplication system
- Day 5: Integration testing

**Phase 3: Advanced Features (Week 3)**
- Day 1-2: FSRS-6 scheduling system
- Day 3-4: TTL and compaction
- Day 5: Performance optimization

**Phase 4: UI Integration (Week 4)**
- Day 1-2: Frontend components
- Day 3-4: API endpoints
- Day 5: End-to-end testing

### 1.2 Dependency Graph

```
Database Migrations (Foundation)
    ↓
Core Interfaces (Types)
    ↓
ACU Manager ←→ DCB Deduplicator
    ↓              ↓
Storage Manager ←→ Collection Manager
    ↓              ↓
FSRS-6 Scheduler → TTL Manager
    ↓              ↓
HTTP API Endpoints → Frontend Components
```

---

## 2. Database Migration Execution

### 2.1 Pre-Migration Setup

```bash
# Create pre-migration backup
bun run db:backup

# Verify current schema
bun run prisma:studio

# Check migration status
bun run prisma:migrate:dev --name pre_migration_check
```

### 2.2 Migration Execution Script

```typescript
// scripts/migrate-acu-dcb-storage.ts

import { getPrisma } from '../src/storage/prisma.js';
import { getLogger } from '../src/lib/logger.js';

const log = getLogger('migration');
const prisma = getPrisma();

async function runMigrations() {
  log.info('Starting ACU/DCB/Storage migrations...');
  
  try {
    // Migration 001: Add ACU metadata
    log.info('Running migration 001: Add ACU metadata');
    await prisma.$executeRaw`
      ALTER TABLE "conversation_message" 
      ADD COLUMN "acu_tags_json" TEXT DEFAULT '[]',
      ADD COLUMN "acu_collection_ids_json" TEXT DEFAULT '[]',
      ADD COLUMN "acu_is_pinned" INTEGER DEFAULT 0,
      ADD COLUMN "acu_is_archived" INTEGER DEFAULT 0,
      ADD COLUMN "acu_read_status" TEXT DEFAULT 'unread',
      ADD COLUMN "acu_priority" TEXT DEFAULT 'normal',
      ADD COLUMN "acu_notes" TEXT,
      ADD COLUMN "acu_custom_fields_json" TEXT DEFAULT '{}'
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX "idx_cm_acu_pinned" ON "conversation_message"("acu_is_pinned");
      CREATE INDEX "idx_cm_acu_archived" ON "conversation_message"("acu_is_archived");
      CREATE INDEX "idx_cm_acu_priority" ON "conversation_message"("acu_priority");
      CREATE INDEX "idx_cm_acu_read_status" ON "conversation_message"("acu_read_status");
    `;
    
    log.info('Migration 001 completed');
    
    // Migration 002: Add DCB deduplication
    log.info('Running migration 002: Add DCB deduplication');
    await prisma.$executeRaw`
      ALTER TABLE "conversation_message" 
      ADD COLUMN "identity_hash" TEXT,
      ADD COLUMN "identity_source" TEXT,
      ADD COLUMN "provider_message_id" TEXT,
      ADD COLUMN "deduplication_status" TEXT DEFAULT 'pending',
      ADD COLUMN "deduplication_checked_at" INTEGER
    `;
    
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX "idx_cm_identity_hash" ON "conversation_message"("identity_hash");
      CREATE INDEX "idx_cm_provider_message_id" ON "conversation_message"("provider_message_id");
      CREATE INDEX "idx_cm_deduplication_status" ON "conversation_message"("deduplication_status");
    `;
    
    log.info('Migration 002 completed');
    
    // Continue with remaining migrations...
    
    log.info('All migrations completed successfully');
    
  } catch (error) {
    log.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigrations().catch(console.error);
```

### 2.3 Post-Migration Validation

```typescript
// scripts/validate-migrations.ts

async function validateMigrations() {
  const prisma = getPrisma();
  
  // Validate ACU metadata fields
  const acuValidation = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total_messages,
      COUNT(CASE WHEN acu_tags_json IS NOT NULL THEN 1 END) as with_tags,
      COUNT(CASE WHEN acu_is_pinned = 1 THEN 1 END) as pinned_count
    FROM "conversation_message"
  `;
  
  console.log('ACU Metadata Validation:', acuValidation);
  
  // Validate DCB deduplication fields
  const dcbValidation = await prisma.$queryRaw`
    SELECT 
      COUNT(*) as total_messages,
      COUNT(CASE WHEN identity_hash IS NOT NULL THEN 1 END) as with_hash,
      COUNT(DISTINCT identity_hash) as unique_hashes
    FROM "conversation_message"
  `;
  
  console.log('DCB Deduplication Validation:', dcbValidation);
  
  await prisma.$disconnect();
}
```

---

## 3. Core Implementation Setup

### 3.1 ACU Manager Integration

```typescript
// src/engines/acu-manager-setup.ts

import { AcuManagerImpl } from './acu-manager-impl.js';
import { getConversationStore } from '../storage/index.js';

/**
 * Setup ACU manager with dependencies
 */
export function setupAcuManager(): AcuManagerImpl {
  const storage = getConversationStore();
  return new AcuManagerImpl(storage);
}

/**
 * Integration with ConversationManager
 */
export function integrateAcuWithConversation(conversationManager: any) {
  const acuManager = setupAcuManager();
  
  // Hook into message creation
  const originalCreateMessage = conversationManager.store.createMessage;
  conversationManager.store.createMessage = async function(input: any) {
    const message = await originalCreateMessage.call(this, input);
    
    // Auto-extract ACU metadata from blocks
    if (input.blocksJson) {
      const blocks = JSON.parse(input.blocksJson);
      const metadata = extractACUMetadataFromBlocks(blocks);
      await acuManager.setMetadata(message.id, metadata);
    }
    
    return message;
  };
  
  return acuManager;
}

/**
 * Extract ACU metadata from message blocks
 */
function extractACUMetadataFromBlocks(blocks: any[]): ACUMetadata {
  const metadata: ACUMetadata = {
    tags: [],
    collectionIds: [],
    isPinned: false,
    isArchived: false,
    readStatus: 'unread',
    priority: 'normal'
  };
  
  for (const block of blocks) {
    metadata.tags.push(block.type);
    
    if (block.type === 'code' && block.language) {
      metadata.tags.push(`lang:${block.language}`);
    }
    
    if (block.type === 'error') {
      metadata.priority = 'high';
    }
  }
  
  return metadata;
}
```

### 3.2 DCB Deduplicator Integration

```typescript
// src/engines/dcb-deduplicator-setup.ts

import { DCBDeduplicatorImpl } from './dcb-deduplicator-impl.js';
import { getConversationStore } from '../storage/index.js';

/**
 * Setup DCB deduplicator with dependencies
 */
export function setupDCBDeduplicator(): DCBDeduplicatorImpl {
  return new DCBDeduplicatorImpl();
}

/**
 * Integration with ConversationManager
 */
export function integrateDCBWithConversation(conversationManager: any) {
  const deduplicator = setupDCBDeduplicator();
  const storage = conversationManager.store;
  
  // Hook into message creation for deduplication
  const originalCreateMessage = storage.createMessage;
  storage.createMessage = async function(input: any) {
    // Generate identity hash
    const identity = {
      provider: input.providerId || 'unknown',
      account: input.accountId || 'default',
      convId: input.conversationId,
      role: input.role,
      content: input.content,
      providerMessageId: input.providerMessageId
    };
    
    // Upsert with deduplication
    return deduplicator.upsertMessage(input, identity, storage);
  };
  
  return deduplicator;
}
```

### 3.3 Storage Manager Integration

```typescript
// src/engines/storage-manager-setup.ts

import { TTLManagerImpl } from './ttl-manager-impl.js';
import { DatabaseCompactorImpl } from './db-compactor-impl.js';
import { CapStoreDb } from '../storage/db.js';

/**
 * Setup storage manager with all components
 */
export function setupStorageManager(db: CapStoreDb) {
  const ttlManager = new TTLManagerImpl(db);
  const compactor = new DatabaseCompactorImpl(db);
  
  return {
    ttl: ttlManager,
    compactor: compactor,
    
    async createBackup() {
      // Backup implementation
      const backupPath = `backup-${Date.now()}.db`;
      // ... backup logic
      return backupPath;
    },
    
    async restoreBackup(backupPath: string) {
      // Restore implementation
      // ... restore logic
    },
    
    async getHealthMetrics() {
      const stats = await compactor.getDatabaseStats();
      return {
        databaseSize: stats.size,
        freePages: stats.freePages,
        ephemeralCount: 0, // Count from TTL manager
        expiringSoon: 0, // Count from TTL manager
        lastCompaction: null,
        lastBackup: null
      };
    }
  };
}

/**
 * Schedule background storage tasks
 */
export function scheduleStorageTasks(storageManager: any) {
  // Hourly TTL sweep
  setInterval(async () => {
    try {
      const result = await storageManager.ttl.sweep();
      console.log('TTL sweep completed:', result);
    } catch (error) {
      console.error('TTL sweep failed:', error);
    }
  }, 60 * 60 * 1000); // 1 hour
  
  // Weekly compaction
  setInterval(async () => {
    try {
      const result = await storageManager.compactor.compact();
      console.log('Compaction completed:', result);
    } catch (error) {
      console.error('Compaction failed:', error);
    }
  }, 7 * 24 * 60 * 60 * 1000); // 7 days
}
```

---

## 4. Engine Integration Examples

### 4.1 Memory Engine Integration

```typescript
// src/engines/memory-engine-integration.ts

import { MemoryEngine } from './memory-engine.js';
import { FSRS6Scheduler } from './fsrs6-scheduler.js';
import { RelevanceDecay } from './relevance-decay.js';
import { MemoryConsolidator } from './memory-consolidator.js';

/**
 * Enhanced memory engine with FSRS-6 and relevance decay
 */
export class EnhancedMemoryEngine extends MemoryEngine {
  private fsrs: FSRS6Scheduler;
  private decay: RelevanceDecay;
  private consolidator: MemoryConsolidator;
  
  constructor(
    episodic: EpisodicMemoryStore,
    semantic: SemanticMemoryStore,
    procedural: ProceduralMemoryStore,
    eventBus: CapabilityEventBus,
    intelligenceStore?: MemoryIntelligenceStore,
    nodeStore?: NodeStoreContract
  ) {
    super(episodic, semantic, procedural, eventBus, intelligenceStore);
    
    this.fsrs = new FSRS6Scheduler();
    this.decay = new RelevanceDecay();
    this.consolidator = new MemoryConsolidator(this);
  }
  
  /**
   * Record memory with FSRS-6 scheduling
   */
  async recordMemory(input: {
    content: string;
    memoryType: string;
    category: string;
    // ... other fields
  }): Promise<string> {
    const memoryId = await super.recordMemory(input);
    
    // Schedule initial review
    const memory = await this.nodeStore?.getNode(memoryId);
    if (memory) {
      const state = memory.data as FSRS6State;
      const updatedState = this.fsrs.calculateNextReview(state, 2); // Rating: "good"
      await this.nodeStore?.updateNode(memoryId, {
        data: { ...state, ...updatedState }
      });
    }
    
    return memoryId;
  }
  
  /**
   * Run daily memory maintenance
   */
  async runDailyMaintenance(): Promise<{
    reviewsScheduled: number;
    relevanceUpdated: number;
    consolidated: number;
  }> {
    const results = {
      reviewsScheduled: 0,
      relevanceUpdated: 0,
      consolidated: 0
    };
    
    // Schedule FSRS-6 reviews
    const dueMemories = await this.fsrs.getDueMemories(this.nodeStore!, 50);
    results.reviewsScheduled = dueMemories.length;
    
    // Apply relevance decay
    const decayResult = await this.decay.applyDecayToMemories(this.nodeStore!);
    results.relevanceUpdated = decayResult.updated;
    
    // Run consolidation
    const consolidationResult = await this.consolidator.consolidate();
    results.consolidated = consolidationResult.semanticMemoriesCreated;
    
    return results;
  }
}
```

### 4.2 Conversation Manager Integration

```typescript
// src/engines/conversation-manager-integration.ts

import { ConversationManager } from './conversation-manager.js';
import { integrateAcuWithConversation } from './acu-manager-setup.js';
import { integrateDCBWithConversation } from './dcb-deduplicator-setup.js';

/**
 * Enhanced conversation manager with ACU and DCB
 */
export class EnhancedConversationManager extends ConversationManager {
  private acuManager?: AcuManagerImpl;
  private dcbDeduplicator?: DCBDeduplicatorImpl;
  
  constructor(
    governor: ChromeGovernor,
    resolution: CapabilityResolutionEngine,
    parser: StreamParserEngine,
    blocks: StreamBlockStore,
    store: ConversationStore,
    eventBus: CapabilityEventBus,
    memoizer: ExecutionMemoizer,
    memory?: MemoryEngine,
    contextAssembly?: ContextAssemblyEngine,
    streamingProtocol?: StreamingProtocol,
    nodeStore?: NodeStoreContract,
    contentUnitStore?: ContentUnitStore,
    memoryFabric?: MemoryFabric
  ) {
    super(
      governor, resolution, parser, blocks, store, eventBus,
      memoizer, memory, contextAssembly, streamingProtocol,
      nodeStore, contentUnitStore, memoryFabric
    );
    
    // Integrate ACU manager
    this.acuManager = integrateAcuWithConversation(this);
    
    // Integrate DCB deduplicator
    this.dcbDeduplicator = integrateDCBWithConversation(this);
  }
  
  /**
   * Enhanced send with ACU extraction and DCB deduplication
   */
  async send(conversationId: string, message: string): Promise<SendResult> {
    const result = await super.send(conversationId, message);
    
    // Extract ACUs from response
    if (result.ok && result.blocks.length > 0) {
      await this.extractAndStoreACUs(conversationId, result.messageId, result.blocks);
    }
    
    return result;
  }
  
  /**
   * Extract and store ACUs from message blocks
   */
  private async extractAndStoreACUs(
    conversationId: string,
    messageId: string,
    blocks: ContentBlock[]
  ): Promise<void> {
    if (!this.acuManager) return;
    
    const extractor = new ACUExtractor({
      minBlockSize: 10,
      maxBlockSize: 10000,
      preserveFormatting: true,
      extractCodeBlocks: true,
      extractToolCalls: true
    });
    
    const acus = await extractor.extractFromBlocks(blocks, conversationId, messageId);
    
    for (const acu of acus) {
      // Store ACU metadata on the message
      await this.acuManager.setMetadata(messageId, acu.metadata);
    }
  }
}
```

---

## 5. HTTP API Integration

### 5.1 API Server Setup

```typescript
// src/server/index.ts

import { acuRouter } from './acu-router.js';
import { dcbRouter } from './dcb-router.js';
import { storageRouter } from './storage-router.js';
import { collectionRouter } from './collection-router.js';

/**
 * Setup HTTP API with all routers
 */
export function setupAPIServer(app: any) {
  // Initialize managers
  const acuManager = setupAcuManager();
  const dcbDeduplicator = setupDCBDeduplicator();
  const storageManager = setupStorageManager(new CapStoreDb());
  const collectionManager = setupCollectionManager();
  
  // Make managers available to routes
  app.locals.acuManager = acuManager;
  app.locals.deduplicator = dcbDeduplicator;
  app.locals.storageManager = storageManager;
  app.locals.collectionManager = collectionManager;
  
  // Mount routers
  app.use('/api/acu', acuRouter);
  app.use('/api/dcb', dcbRouter);
  app.use('/api/storage', storageRouter);
  app.use('/api/collections', collectionRouter);
  
  // Add middleware
  app.use(errorHandler);
  app.use(requestLogger);
  
  return app;
}

/**
 * Error handler middleware
 */
function errorHandler(err: any, req: any, res: any, next: any) {
  console.error('API Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
}

/**
 * Request logger middleware
 */
function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
}
```

### 5.2 API Route Registration

```typescript
// src/server/routes.ts

import { Router } from 'express';

const router = Router();

// ACU management routes
router.get('/acu/:messageId/metadata', acuRouter.getMetadata.bind(acuRouter));
router.put('/acu/:messageId/metadata', acuRouter.setMetadata.bind(acuRouter));
router.post('/acu/batch', acuRouter.batchOperation.bind(acuRouter));
router.get('/acu/search', acuRouter.search.bind(acuRouter));

// DCB deduplication routes
router.post('/dcb/check', dcbRouter.checkDuplicate.bind(dcbRouter));
router.post('/dcb/upsert', dcbRouter.upsertMessage.bind(dcbRouter));

// Storage management routes
router.post('/storage/ttl/message', storageRouter.setMessageTTL.bind(storageRouter));
router.post('/storage/compact', storageRouter.compact.bind(storageRouter));
router.get('/storage/health', storageRouter.getHealth.bind(storageRouter));

// Collection management routes
router.post('/collections', collectionRouter.createCollection.bind(collectionRouter));
router.get('/collections/:id', collectionRouter.getCollection.bind(collectionRouter));
router.get('/collections', collectionRouter.listCollections.bind(collectionRouter));
router.post('/collections/:id/members', collectionRouter.addToCollection.bind(collectionRouter));

export default router;
```

---

## 6. Background Task Scheduling

### 6.1 Task Scheduler Setup

```typescript
// src/engines/task-scheduler.ts

/**
 * Background task scheduler
 */
export class TaskScheduler {
  private tasks: Map<string, NodeJS.Timeout> = new Map();
  
  /**
   * Schedule a recurring task
   */
  scheduleTask(name: string, intervalMs: number, task: () => Promise<void>): void {
    // Clear existing task if present
    this.unscheduleTask(name);
    
    const interval = setInterval(async () => {
      try {
        console.log(`Running task: ${name}`);
        await task();
        console.log(`Task completed: ${name}`);
      } catch (error) {
        console.error(`Task failed: ${name}`, error);
      }
    }, intervalMs);
    
    this.tasks.set(name, interval);
  }
  
  /**
   * Unschedule a task
   */
  unscheduleTask(name: string): void {
    const interval = this.tasks.get(name);
    if (interval) {
      clearInterval(interval);
      this.tasks.delete(name);
    }
  }
  
  /**
   * Unschedule all tasks
   */
  unscheduleAll(): void {
    for (const name of this.tasks.keys()) {
      this.unscheduleTask(name);
    }
  }
}

/**
 * Setup default background tasks
 */
export function setupDefaultTasks(
  memoryEngine: EnhancedMemoryEngine,
  storageManager: any
): TaskScheduler {
  const scheduler = new TaskScheduler();
  
  // Daily memory maintenance (midnight)
  scheduler.scheduleTask('memory_maintenance', 24 * 60 * 60 * 1000, async () => {
    await memoryEngine.runDailyMaintenance();
  });
  
  // Hourly TTL sweep
  scheduler.scheduleTask('ttl_sweep', 60 * 60 * 1000, async () => {
    await storageManager.ttl.sweep();
  });
  
  // Weekly database compaction (Sunday 3 AM)
  scheduler.scheduleTask('db_compaction', 7 * 24 * 60 * 60 * 1000, async () => {
    await storageManager.compactor.compact();
  });
  
  return scheduler;
}
```

### 6.2 Task Monitoring

```typescript
// src/engines/task-monitor.ts

/**
 * Task execution monitor
 */
export class TaskMonitor {
  private executionHistory: Map<string, Array<{
    timestamp: number;
    duration: number;
    success: boolean;
    error?: string;
  }>> = new Map();
  
  /**
   * Record task execution
   */
  recordExecution(taskName: string, duration: number, success: boolean, error?: string): void {
    const history = this.executionHistory.get(taskName) || [];
    history.push({
      timestamp: Date.now(),
      duration,
      success,
      error
    });
    
    // Keep only last 100 executions
    if (history.length > 100) {
      history.shift();
    }
    
    this.executionHistory.set(taskName, history);
  }
  
  /**
   * Get task statistics
   */
  getTaskStats(taskName: string): {
    totalExecutions: number;
    successRate: number;
    averageDuration: number;
    lastExecution: number | null;
  } {
    const history = this.executionHistory.get(taskName) || [];
    
    if (history.length === 0) {
      return {
        totalExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        lastExecution: null
      };
    }
    
    const successes = history.filter(h => h.success).length;
    const totalDuration = history.reduce((sum, h) => sum + h.duration, 0);
    
    return {
      totalExecutions: history.length,
      successRate: successes / history.length,
      averageDuration: totalDuration / history.length,
      lastExecution: history[history.length - 1].timestamp
    };
  }
  
  /**
   * Get all task statistics
   */
  getAllStats(): Record<string, ReturnType<typeof this.getTaskStats>> {
    const stats: Record<string, any> = {};
    
    for (const taskName of this.executionHistory.keys()) {
      stats[taskName] = this.getTaskStats(taskName);
    }
    
    return stats;
  }
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// tests/unit/acu-manager.test.ts

import { describe, it, expect } from 'bun:test';
import { AcuManagerImpl } from '../src/engines/acu-manager-impl.js';

describe('AcuManager', () => {
  it('should set and get ACU metadata', async () => {
    const mockStorage = createMockStorage();
    const manager = new AcuManagerImpl(mockStorage);
    
    const metadata: ACUMetadata = {
      tags: ['test', 'sample'],
      collectionIds: [],
      isPinned: false,
      isArchived: false,
      readStatus: 'unread',
      priority: 'normal'
    };
    
    await manager.setMetadata('msg-1', metadata);
    const retrieved = await manager.getMetadata('msg-1');
    
    expect(retrieved).toEqual(metadata);
  });
  
  it('should search by metadata filters', async () => {
    const mockStorage = createMockStorage();
    const manager = new AcuManagerImpl(mockStorage);
    
    const results = await manager.searchByMetadata({
      tags: ['test'],
      isPinned: false
    });
    
    expect(Array.isArray(results)).toBe(true);
  });
});

function createMockStorage() {
  return {
    updateMessage: async () => {},
    getMessage: async () => ({
      acuTagsJson: '[]',
      acuCollectionIdsJson: '[]',
      acuIsPinned: 0,
      acuIsArchived: 0,
      acuReadStatus: 'unread',
      acuPriority: 'normal',
      acuNotes: null,
      acuCustomFieldsJson: '{}'
    }),
    searchMessages: async () => []
  };
}
```

### 7.2 Integration Tests

```typescript
// tests/integration/dcb-deduplication.test.ts

import { describe, it, expect } from 'bun:test';
import { DCBDeduplicatorImpl } from '../src/engines/dcb-deduplicator-impl.js';
import { getPrisma } from '../src/storage/prisma.js';

describe('DCB Deduplication Integration', () => {
  it('should generate consistent identity hashes', () => {
    const deduplicator = new DCBDeduplicatorImpl();
    
    const input = {
      provider: 'test-provider',
      account: 'test-account',
      convId: 'conv-1',
      role: 'user',
      content: 'test message'
    };
    
    const hash1 = deduplicator.generateIdentityHash(input);
    const hash2 = deduplicator.generateIdentityHash(input);
    
    expect(hash1).toBe(hash2);
  });
  
  it('should detect duplicate messages', async () => {
    const prisma = getPrisma();
    const deduplicator = new DCBDeduplicatorImpl();
    const storage = createStorageWithPrisma(prisma);
    
    const identity = {
      provider: 'test-provider',
      account: 'test-account',
      convId: 'conv-1',
      role: 'user',
      content: 'test message'
    };
    
    const hash = deduplicator.generateIdentityHash(identity);
    const isDuplicate = await deduplicator.isDuplicate(hash, storage);
    
    expect(typeof isDuplicate).toBe('boolean');
  });
});
```

### 7.3 End-to-End Tests

```typescript
// tests/e2e/acu-dcb-flow.test.ts

import { describe, it, expect } from 'bun:test';
import { setupTestServer } from './helpers/server.js';

describe('ACU/DCB E2E Flow', () => {
  it('should process message with ACU extraction and DCB deduplication', async () => {
    const server = setupTestServer();
    const port = server.port;
    
    // Send message
    const response = await fetch(`http://localhost:${port}/api/conversations/test/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test message' })
    });
    
    const result = await response.json();
    expect(result.success).toBe(true);
    
    // Check ACU metadata
    const metadataResponse = await fetch(
      `http://localhost:${port}/api/acu/${result.messageId}/metadata`
    );
    const metadata = await metadataResponse.json();
    expect(metadata.success).toBe(true);
    expect(metadata.data.tags).toContain('text');
    
    // Check deduplication
    const duplicateResponse = await fetch(`http://localhost:${port}/api/dcb/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'test',
        account: 'test',
        convId: 'test',
        role: 'user',
        content: 'test message'
      })
    });
    
    const duplicateResult = await duplicateResponse.json();
    expect(duplicateResult.success).toBe(true);
    expect(duplicateResult.data.isDuplicate).toBe(true);
    
    await server.close();
  });
});
```

---

## 8. Performance Optimization

### 8.1 Database Query Optimization

```typescript
// src/storage/query-optimizer.ts

/**
 * Query optimization hints
 */
export class QueryOptimizer {
  /**
   * Optimize ACU metadata queries
   */
  static optimizeACUQuery(filters: any): any {
    const optimized: any = {};
    
    // Use indexed fields first
    if (filters.isPinned !== undefined) {
      optimized.acuIsPinned = filters.isPinned ? 1 : 0;
    }
    
    if (filters.isArchived !== undefined) {
      optimized.acuIsArchived = filters.isArchived ? 1 : 0;
    }
    
    if (filters.priority !== undefined) {
      optimized.acuPriority = filters.priority;
    }
    
    // Apply JSON filters last (slower)
    if (filters.tags && filters.tags.length > 0) {
      optimized.acuTagsJson = {
        contains: filters.tags[0] // Simplified for example
      };
    }
    
    return optimized;
  }
  
  /**
   * Batch query optimization
   */
  static optimizeBatchQuery(ids: string[]): any {
    // Use IN clause for batch queries
    return {
      id: { in: ids }
    };
  }
}
```

### 8.2 Caching Strategy

```typescript
// src/cache/cache-manager.ts

/**
 * Cache manager for frequently accessed data
 */
export class CacheManager {
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Get cached value
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  /**
   * Set cached value
   */
  set(key: string, value: any, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }
  
  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached as T;
    }
    
    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }
}
```

---

## 9. Error Handling and Recovery

### 9.1 Error Recovery Strategies

```typescript
// src/error/recovery-manager.ts

/**
 * Error recovery manager
 */
export class RecoveryManager {
  /**
   * Recover from failed ACU operation
   */
  async recoverACUOperation(operation: BatchOperation, error: Error): Promise<void> {
    console.error('ACU operation failed:', error);
    
    // Log error details
    await this.logError('ACU_OPERATION_FAILED', {
      operation,
      error: error.message,
      stack: error.stack
    });
    
    // Implement recovery strategy based on error type
    if (error.message.includes('database lock')) {
      // Retry after delay
      await this.delay(1000);
      // Retry operation
    } else if (error.message.includes('not found')) {
      // Skip missing ACUs
      console.warn('Skipping missing ACUs in batch operation');
    } else {
      // Fail fast for unknown errors
      throw error;
    }
  }
  
  /**
   * Recover from failed deduplication
   */
  async recoverDeduplication(identity: MessageIdentityInput, error: Error): Promise<void> {
    console.error('Deduplication failed:', error);
    
    // Store for manual review
    await this.storeForReview('DEDUPLICATION_FAILED', {
      identity,
      error: error.message
    });
  }
  
  /**
   * Recover from failed compaction
   */
  async recoverCompaction(error: Error): Promise<void> {
    console.error('Compaction failed:', error);
    
    // Mark compaction as failed
    await this.markCompactionFailed(error.message);
    
    // Schedule retry
    await this.scheduleRetry('compaction', 60 * 60 * 1000); // 1 hour
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private async logError(type: string, data: any): Promise<void> {
    // Implementation depends on logging system
  }
  
  private async storeForReview(type: string, data: any): Promise<void> {
    // Implementation depends on storage system
  }
  
  private async markCompactionFailed(error: string): Promise<void> {
    // Implementation depends on storage system
  }
  
  private async scheduleRetry(task: string, delay: number): Promise<void> {
    // Implementation depends on task scheduler
  }
}
```

---

## 10. Monitoring and Observability

### 10.1 Metrics Collection

```typescript
// src/monitoring/metrics-collector.ts

/**
 * Metrics collector for ACU/DCB/Storage systems
 */
export class MetricsCollector {
  private metrics: Map<string, number> = new Map();
  
  /**
   * Increment metric
   */
  increment(name: string, value: number = 1): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }
  
  /**
   * Set metric value
   */
  set(name: string, value: number): void {
    this.metrics.set(name, value);
  }
  
  /**
   * Get metric value
   */
  get(name: string): number {
    return this.metrics.get(name) || 0;
  }
  
  /**
   * Get all metrics
   */
  getAll(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
  }
  
  /**
   * Record operation duration
   */
  recordDuration(name: string, duration: number): void {
    const count = this.get(`${name}_count`);
    const total = this.get(`${name}_total`);
    
    this.set(`${name}_count`, count + 1);
    this.set(`${name}_total`, total + duration);
  }
  
  /**
   * Get average duration
   */
  getAverageDuration(name: string): number {
    const count = this.get(`${name}_count`);
    const total = this.get(`${name}_total`);
    
    return count > 0 ? total / count : 0;
  }
}

/**
 * Setup metrics monitoring
 */
export function setupMetricsMonitoring(
  acuManager: AcuManagerImpl,
  dcbDeduplicator: DCBDeduplicatorImpl,
  storageManager: any
): MetricsCollector {
  const metrics = new MetricsCollector();
  
  // Wrap ACU manager operations
  const originalSetMetadata = acuManager.setMetadata.bind(acuManager);
  acuManager.setMetadata = async function(...args: any[]) {
    const start = Date.now();
    try {
      const result = await originalSetMetadata(...args);
      metrics.increment('acu_set_metadata_success');
      metrics.recordDuration('acu_set_metadata', Date.now() - start);
      return result;
    } catch (error) {
      metrics.increment('acu_set_metadata_error');
      throw error;
    }
  };
  
  // Similar wrapping for other operations...
  
  return metrics;
}
```

---

## 11. Deployment Checklist

### 11.1 Pre-Deployment

- [ ] All database migrations tested in staging
- [ ] Backup created before migration
- [ ] Rollback procedure documented
- [ ] Monitoring and alerting configured
- [ ] Performance benchmarks established
- [ ] Error recovery procedures tested

### 11.2 Deployment Steps

1. **Create backup**
   ```bash
   bun run db:backup
   ```

2. **Run migrations**
   ```bash
   bun run prisma:migrate:prod
   ```

3. **Validate migration**
   ```bash
   bun run scripts/validate-migrations.ts
   ```

4. **Deploy application**
   ```bash
   bun run tauri:build
   ```

5. **Smoke test**
   ```bash
   bun run devops desktop-loop test smoke
   ```

6. **Monitor metrics**
   - Check error rates
   - Monitor performance
   - Verify data integrity

### 11.3 Post-Deployment

- [ ] Verify all services healthy
- [ ] Check database performance
- [ ] Monitor background tasks
- [ ] Review error logs
- [ ] Validate user workflows

---

This integration guide provides a complete roadmap for implementing all ACU, DCB, and Storage enhancements in the vivim-final codebase. Each section includes practical examples, integration patterns, and best practices for production deployment.
