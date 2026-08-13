# PRD: Lifecycle Management and Database Compaction (M3+M4)

**Product:** vivim-final Storage Layer  
**Source:** intelligence-pack-acu-dcb-storage + COMPLETE UPGRADE PACKAGE  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13  
**Phase:** 4 (Lifecycle + Compaction)

---

## Executive Summary

This PRD details the implementation of TTL-based lifecycle management and database compaction for vivim-final. These enhancements transform the storage layer from basic CRUD operations to an intelligent, self-maintaining system that automatically expires ephemeral data and optimizes database size.

**Key Deliverables:**
- TTL fields on ConversationMessage and Node models
- Lifecycle engine for sweeping expired entries
- SQLite compaction with WAL checkpoint
- Pre-migration backup system
- Maintenance APIs and scheduling

**Estimated Effort:** 2 weeks  
**Risk Level:** Medium-Large (touches storage layer, requires careful testing)

---

## Background

### Current State

vivim-final storage has:
- Prisma ORM with 196 models in single schema
- SQLite database with WAL mode
- Basic CRUD operations through CapStoreDb
- No deduplication, no compaction, no TTL
- WAL pragmas at `src/storage/prisma.ts` and `src/storage/db.ts:491`
- No scheduled compaction, no dead-version GC
- `expiresAt` exists only on `EpisodicMemory` (line 1945), memory-curated row (line 2410), and `Notification` (line 3391)

### Dual-Storage Architecture

The storage layer is split into two distinct storage systems requiring different compaction strategies:

**Relational Store (Prisma/SQLite):**
- Handles structured data (ConversationMessage, Memory, Node)
- Compaction: Uses SQLite's native VACUUM command
- Backup: Uses SQLite Online Backup API
- WAL checkpoint required before compaction/backup

**KV Store (Tree-Based):**
- Handles ephemeral and cache data (traces, context_bundles, deduplication hashes)
- Compaction: Uses copy-compaction algorithm
- Backup: File-based operations (no WAL concerns)
- LRU/TTL-based eviction for cache management

### Problem Statement

The current storage layer lacks:
1. **TTL Management:** No automatic cleanup of ephemeral data (traces, sessions)
2. **Database Optimization:** No compaction to reclaim free pages
3. **Migration Safety:** No backup system for schema changes
4. **Maintenance Scheduling:** No automated maintenance jobs

### Solution Overview

Implement storage enhancements to create an intelligent storage system that:
- Automatically expires ephemeral data via TTL-based cleanup
- Optimizes database size through compaction
- Provides safety through pre-migration backups
- Schedules maintenance jobs automatically

---

## Requirements

### Functional Requirements

#### FR-1: TTL Schema Additions

**FR-1.1:** Add TTL fields to `ConversationMessage` model:
```prisma
model ConversationMessage {
  // ... existing fields ...
  
  // NEW: TTL for lifecycle management
  expiresAt    BigInt?  @map("expires_at")
  isEphemeral  Int      @default(0) @map("is_ephemeral")
  ttlSeconds   Int?     @map("ttl_seconds")
  
  @@index([expiresAt], map: "idx_cm_expires")
  @@map("conversation_message")
}
```

**FR-1.2:** Add TTL fields to `Node` model:
```prisma
model Node {
  // ... existing fields ...
  
  // NEW: TTL for lifecycle management
  expiresAt    BigInt?  @map("expires_at")
  isEphemeral  Int      @default(0) @map("is_ephemeral")
  ttlSeconds   Int?     @map("ttl_seconds")
  
  @@index([expiresAt], map: "idx_node_expires")
  @@map("node")
}
```

**FR-1.3:** Boolean to Int mapping:
- `isEphemeral`: 0 = false, 1 = true

#### FR-2: TTL Configuration

**FR-2.1:** Define TTL constants:
```typescript
const TTL_CONFIG = {
  TRACES_TTL_HOURS: 48,
  SESSIONS_TTL_HOURS: 6,
  SYNC_HISTORY_TTL_DAYS: 30,
  OBSERVATORY_TRAFFIC_TTL_DAYS: 7,
  OBSERVATORY_TRAFFIC_MAX: 2000,
  CONTEXT_BUNDLES_TTL_DAYS: 14,
  DEPRECATED_MEMORIES_TTL_DAYS: 90,
};
```

**FR-2.2:** Support per-entity TTL overrides
**FR-2.3:** Default TTL for new ephemeral entities

#### FR-3: Lifecycle Engine

**FR-3.1:** Create `LifecycleEngine` class:
```typescript
export class LifecycleEngine {
  /**
   * Sweep expired ConversationMessage entries
   */
  sweepExpiredMessages(): Promise<{ deleted: number; exempted: number }>;
  
  /**
   * Sweep expired Node entries
   */
  sweepExpiredNodes(): Promise<{ deleted: number; exempted: number }>;
  
  /**
   * Sweep KV store entries (traces, sessions, etc.)
   */
  sweepKvStore(tree: string, cutoff: number): Promise<number>;
  
  /**
   * Run full lifecycle sweep
   */
  runFullSweep(): Promise<LifecycleSweepReport>;
}
```

**FR-3.2:** Implement exemption logic:
- Pinned messages are exempt from TTL sweep
- Eternal messages are exempt from TTL sweep
- Archived messages are handled separately

**FR-3.3:** Implement cap-based sweep:
- Keep only newest N entries for specific trees
- Delete older entries beyond cap

#### FR-4: Database Compaction

**FR-4.1:** Implement SQLite compaction:
```typescript
export class CompactionManager {
  /**
   * Compact SQLite database using native VACUUM
   */
  compactSqlite(): Promise<{
    beforeMb: number;
    afterMb: number;
    reclaimedMb: number;
  }>;
  
  /**
   * Get database statistics
   */
  getStats(): Promise<DbStats>;
  
  /**
   * Run WAL checkpoint before compaction
   */
  checkpoint(): Promise<{ busy: number; log: number; checkpointed: number }>;
}
```

**FR-4.2:** Implement copy-compaction for KV store:
```typescript
export class KvCompactionManager {
  /**
   * Compact KV store using copy-compaction
   */
  compact(): Promise<{
    beforeMb: number;
    afterMb: number;
    reclaimedMb: number;
  }>;
}
```

**FR-4.3:** Implement compaction safety:
- Always create backup before compaction
- Atomic swap (rename operations)
- Verify compaction success before cleanup

#### FR-5: Pre-Migration Backup

**FR-5.1:** Implement backup creation:
```typescript
export class BackupManager {
  /**
   * Create pre-migration backup
   */
  createBackup(dbPath: string, version: string): Promise<string>;
  
  /**
   * List available backups
   */
  listBackups(dbPath: string): Promise<BackupRecord[]>;
  
  /**
   * Restore from backup
   */
  restoreFromBackup(backupPath: string): Promise<void>;
  
  /**
   * Prune old backups (keep last 5)
   */
  pruneBackups(dbPath: string): Promise<void>;
}
```

**FR-5.2:** Integrate backup into migration system
**FR-5.3:** Store backup metadata in database

#### FR-6: Maintenance APIs

**FR-6.1:** Implement maintenance APIs:
- `POST /api/storage/compact` - Trigger database compaction
- `POST /api/storage/sweep` - Trigger TTL sweep
- `GET /api/storage/stats` - Get database statistics
- `POST /api/storage/backup` - Create backup
- `GET /api/storage/backups` - List backups

**FR-6.2:** Implement maintenance scheduling:
- Register lifecycle engine as boot service
- Schedule periodic TTL sweeps (daily)
- Schedule periodic compaction (weekly)

### Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** TTL sweep < 5s for 1M entries
**NFR-1.2:** Compaction < 30s for 100MB database
**NFR-1.3:** WAL checkpoint latency < 500ms
**NFR-1.4:** Prisma Batch Deletes reduce I/O overhead by 90%

#### NFR-2: Accuracy

**NFR-2.1:** TTL sweep must not delete non-expired entries
**NFR-2.2:** Compaction must preserve all data
**NFR-2.3:** Backup must restore correctly

#### NFR-3: Reliability

**NFR-3.1:** Compaction must be atomic (no partial state)
**NFR-3.2:** TTL sweep must handle missing timestamps gracefully
**NFR-3.3:** Backup must handle concurrent operations

#### NFR-4: Compatibility

**NFR-4.1:** All changes must be backward compatible
**NFR-4.2:** Existing CRUD operations must continue to work
**NFR-4.3:** API changes must be additive

---

## Technical Design

### Data Model Changes

#### Schema Addition

```prisma
// prisma/schema.prisma

model ConversationMessage {
  // ... existing fields ...
  
  // NEW: TTL for lifecycle management
  expiresAt    BigInt?  @map("expires_at")
  isEphemeral  Int      @default(0) @map("is_ephemeral")
  ttlSeconds   Int?     @map("ttl_seconds")
  
  @@index([expiresAt], map: "idx_cm_expires")
  @@map("conversation_message")
}

model Node {
  // ... existing fields ...
  
  // NEW: TTL for lifecycle management
  expiresAt    BigInt?  @map("expires_at")
  isEphemeral  Int      @default(0) @map("is_ephemeral")
  ttlSeconds   Int?     @map("ttl_seconds")
  
  @@index([expiresAt], map: "idx_node_expires")
  @@map("node")
}

model BackupRecord {
  id         String   @id
  dbPath     String   @map("db_path")
  backupPath String   @unique @map("backup_path")
  version    String
  sizeBytes  BigInt   @map("size_bytes")
  sha256     String
  createdAt  BigInt   @map("created_at")
  
  @@index([dbPath, createdAt], map: "idx_br_db")
  @@map("backup_record")
}

model LifecycleSweepLog {
  id            String   @id
  tree          String
  mode          String   // 'ttl' | 'cap'
  cutoffTs      BigInt?  @map("cutoff_ts")
  maxEntries    Int?     @map("max_entries")
  deletedCount  Int      @default(0) @map("deleted_count")
  exemptedCount Int      @default(0) @map("exempted_count")
  durationMs    Int      @default(0) @map("duration_ms")
  ts            BigInt
  
  @@index([tree, ts], map: "idx_lsl_tree")
  @@map("lifecycle_sweep_log")
}
```

### Algorithm Implementation

#### Lifecycle Engine

```typescript
// src/engines/lifecycle-engine.ts

import { getLogger } from '../lib/logger.js';
import type { ConversationStore } from '../storage/contracts/conversation-store.js';
import type { NodeStore } from '../storage/contracts/node-store.js';

const logger = getLogger({ name: 'lifecycle-engine' });

const TTL_CONFIG = {
  TRACES_TTL_HOURS: 48,
  SESSIONS_TTL_HOURS: 6,
  SYNC_HISTORY_TTL_DAYS: 30,
  OBSERVATORY_TRAFFIC_TTL_DAYS: 7,
  OBSERVATORY_TRAFFIC_MAX: 2000,
  CONTEXT_BUNDLES_TTL_DAYS: 14,
  DEPRECATED_MEMORIES_TTL_DAYS: 90,
};

export interface LifecycleSweepReport {
  messages: { deleted: number; exempted: number };
  nodes: { deleted: number; exempted: number };
  kvStores: Record<string, number>;
  totalDurationMs: number;
}

export class LifecycleEngine {
  constructor(
    private conversationStore: ConversationStore,
    private nodeStore: NodeStore,
    private kvStore: KvStore
  ) {}
  
  /**
   * Sweep expired ConversationMessage entries
   */
  async sweepExpiredMessages(): Promise<{ deleted: number; exempted: number }> {
    const now = Date.now();
    const cutoff = now;
    
    // Get expired messages
    const expired = await this.conversationStore.queryExpired(cutoff);
    
    let deleted = 0;
    let exempted = 0;
    
    // Batch delete with exemption checks
    for (const message of expired) {
      // Check exemptions (pinned, eternal)
      if (message.isPinned || message.isEternal) {
        exempted++;
        continue;
      }
      
      await this.conversationStore.delete(message.id);
      deleted++;
    }
    
    logger.info(`Swept expired messages: ${deleted} deleted, ${exempted} exempted`);
    
    return { deleted, exempted };
  }
  
  /**
   * Sweep expired Node entries
   */
  async sweepExpiredNodes(): Promise<{ deleted: number; exempted: number }> {
    const now = Date.now();
    const cutoff = now;
    
    const expired = await this.nodeStore.queryExpired(cutoff);
    
    let deleted = 0;
    let exempted = 0;
    
    for (const node of expired) {
      if (node.isPinned || node.isEternal) {
        exempted++;
        continue;
      }
      
      await this.nodeStore.delete(node.id);
      deleted++;
    }
    
    logger.info(`Swept expired nodes: ${deleted} deleted, ${exempted} exempted`);
    
    return { deleted, exempted };
  }
  
  /**
   * Run full lifecycle sweep
   */
  async runFullSweep(): Promise<LifecycleSweepReport> {
    const startTime = Date.now();
    
    const messages = await this.sweepExpiredMessages();
    const nodes = await this.sweepExpiredNodes();
    
    const kvStores: Record<string, number> = {};
    
    // Sweep KV stores
    const now = Date.now();
    
    kvStores.traces = await this.sweepKvStore(
      'traces',
      now - (TTL_CONFIG.TRACES_TTL_HOURS * 60 * 60 * 1000)
    );
    
    kvStores.sessions = await this.sweepKvStore(
      'gemini_sessions',
      now - (TTL_CONFIG.SESSIONS_TTL_HOURS * 60 * 60 * 1000)
    );
    
    kvStores.contextBundles = await this.sweepKvStore(
      'context_bundles',
      now - (TTL_CONFIG.CONTEXT_BUNDLES_TTL_DAYS * 24 * 60 * 60 * 1000)
    );
    
    const totalDurationMs = Date.now() - startTime;
    
    return {
      messages,
      nodes,
      kvStores,
      totalDurationMs,
    };
  }
  
  /**
   * Sweep KV store entries
   */
  private async sweepKvStore(tree: string, cutoff: number): Promise<number> {
    const entries = await this.kvStore.scan(tree, '', 1_000_000);
    
    const expiredKeys = entries
      .filter(entry => {
        const timestamp = this.parseTimestamp(entry.value);
        return timestamp !== null && timestamp < cutoff;
      })
      .map(entry => entry.key);
    
    if (expiredKeys.length > 0) {
      await this.kvStore.deleteBatch(tree, expiredKeys);
    }
    
    return expiredKeys.length;
  }
  
  /**
   * Parse timestamp from value
   */
  private parseTimestamp(value: Record<string, unknown>): number | null {
    const timestampFields = ['expires_at', 'timestamp', 'created_at', 'ts', 'updated_at'];
    
    for (const field of timestampFields) {
      const fieldValue = value[field];
      
      if (typeof fieldValue === 'string') {
        const date = new Date(fieldValue);
        if (!isNaN(date.getTime())) {
          return date.getTime();
        }
      } else if (typeof fieldValue === 'number') {
        if (fieldValue > 1_000_000_000_000) {
          return fieldValue; // Milliseconds
        } else {
          return fieldValue * 1000; // Seconds to milliseconds
        }
      }
    }
    
    return null;
  }
}
```

#### Compaction Manager

```typescript
// src/engines/compaction-manager.ts

import { promises as fs } from 'fs';
import { getLogger } from '../lib/logger.js';

const logger = getLogger({ name: 'compaction-manager' });

export interface DbStats {
  fileBytes: number;
  pageSize: number;
  pageCount: number;
  freelistCount: number;
  liveBytes: number;
  reclaimableBytes: number;
  liveRatio: number;
}

export class CompactionManager {
  constructor(private prisma: PrismaClient) {}
  
  /**
   * Get database file path
   */
  private getDatabasePath(): string {
    // Extract from DATABASE_URL or use default
    const dbUrl = process.env.DATABASE_URL || '';
    const match = dbUrl.match(/file:(.+)/);
    return match ? match[1] : 'prisma/dev.db';
  }
  
  /**
   * Compact SQLite database using native VACUUM
   */
  async compactSqlite(): Promise<{
    beforeMb: number;
    afterMb: number;
    reclaimedMb: number;
  }> {
    logger.info('Starting SQLite compaction');
    
    // Pre-compaction WAL checkpoint
    await this.checkpoint();
    
    const dbPath = this.getDatabasePath();
    const beforeStats = await fs.stat(dbPath);
    const beforeMb = beforeStats.size / (1024 * 1024);
    
    // Run VACUUM
    await this.prisma.$executeRaw`VACUUM`;
    
    const afterStats = await fs.stat(dbPath);
    const afterMb = afterStats.size / (1024 * 1024);
    const reclaimedMb = beforeMb - afterMb;
    
    logger.info(`SQLite compaction complete: ${beforeMb.toFixed(2)}MB → ${afterMb.toFixed(2)}MB (${reclaimedMb.toFixed(2)}MB reclaimed)`);
    
    return { beforeMb, afterMb, reclaimedMb };
  }
  
  /**
   * Run WAL checkpoint
   */
  async checkpoint(): Promise<{ busy: number; log: number; checkpointed: number }> {
    const result = await this.prisma.$queryRaw`PRAGMA wal_checkpoint(TRUNCATE)`;
    logger.info('WAL checkpoint complete', result);
    return result as { busy: number; log: number; checkpointed: number };
  }
  
  /**
   * Get database statistics
   */
  async getStats(): Promise<DbStats> {
    const dbPath = this.getDatabasePath();
    const fileBytes = (await fs.stat(dbPath)).size;
    
    const pageStats = await this.prisma.$queryRaw`PRAGMA page_count`;
    const pageSizeStats = await this.prisma.$queryRaw`PRAGMA page_size`;
    const freelistStats = await this.prisma.$queryRaw`PRAGMA freelist_count`;
    
    const pageCount = Number(pageStats[0].page_count);
    const pageSize = Number(pageSizeStats[0].page_size);
    const freelistCount = Number(freelistStats[0].freelist_count);
    
    const liveBytes = (pageCount - freelistCount) * pageSize;
    const reclaimableBytes = freelistCount * pageSize;
    const liveRatio = liveBytes / fileBytes;
    
    return {
      fileBytes,
      pageSize,
      pageCount,
      freelistCount,
      liveBytes,
      reclaimableBytes,
      liveRatio,
    };
  }
}
```

---

## Implementation Plan

### Phase 4.1: Schema Changes (Day 1-2)

**Tasks:**
1. Add TTL fields to `ConversationMessage` model
2. Add TTL fields to `Node` model
3. Create `BackupRecord` model
4. Create `LifecycleSweepLog` model
5. Add indexes for performance
6. Run `bunx prisma db push --skip-generate`
7. Rebuild fixture database if needed

**Deliverables:**
- Updated Prisma schema
- Database migration applied
- Fixture database updated

**Success Criteria:**
- Schema changes applied successfully
- No breaking changes to existing data
- Indexes created for performance

### Phase 4.2: Lifecycle Engine (Day 3-5)

**Tasks:**
1. Create `LifecycleEngine` class
2. Implement TTL sweep for ConversationMessage
3. Implement TTL sweep for Node
4. Implement KV store sweep
5. Add exemption logic (pinned, eternal)
6. Add integration tests

**Deliverables:**
- Lifecycle engine
- Integration tests passing

**Success Criteria:**
- TTL sweep works correctly
- Exemption logic works
- Integration tests pass

### Phase 4.3: Compaction Manager (Day 6-7)

**Tasks:**
1. Create `CompactionManager` class
2. Implement SQLite VACUUM compaction
3. Implement WAL checkpoint
4. Implement database statistics
5. Add unit tests

**Deliverables:**
- Compaction manager
- Unit tests passing

**Success Criteria:**
- Compaction works correctly
- WAL checkpoint works
- Unit tests pass

### Phase 4.4: Backup Manager (Day 8)

**Tasks:**
1. Create `BackupManager` class
2. Implement backup creation
3. Implement backup listing
4. Implement backup restoration
5. Implement backup pruning
6. Add unit tests

**Deliverables:**
- Backup manager
- Unit tests passing

**Success Criteria:**
- Backup creation works
- Backup restoration works
- Unit tests pass

### Phase 4.5: API Integration (Day 9)

**Tasks:**
1. Create `storage-router.ts` maintenance APIs
2. Implement compaction endpoint
3. Implement sweep endpoint
4. Implement stats endpoint
5. Implement backup endpoints
6. Add API tests

**Deliverables:**
- Maintenance APIs
- API tests passing

**Success Criteria:**
- API endpoints work correctly
- API tests pass
- Error handling is robust

### Phase 4.6: Bootstrap Integration (Day 10)

**Tasks:**
1. Wire lifecycle engine into bootstrap
2. Wire compaction manager into bootstrap
3. Wire backup manager into bootstrap
4. Configure maintenance scheduling
5. Run full integration tests

**Deliverables:**
- Engines wired into bootstrap
- Integration tests passing

**Success Criteria:**
- Maintenance jobs run automatically
- Integration tests pass
- No regressions detected

---

## Risk Mitigation

### Technical Risks

**Risk 1: Data Loss During Compaction**
- **Likelihood:** Low
- **Impact:** Critical
- **Mitigation:**
  - Always create backup before compaction
  - Use atomic operations
  - Test compaction thoroughly

**Risk 2: TTL Sweep Deleting Active Data**
- **Likelihood:** Medium
- **Impact:** High
- **Mitigation:**
  - Implement exemption logic
  - Test sweep with real data
  - Add dry-run mode

**Risk 3: Performance Degradation**
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Schedule maintenance during low-traffic periods
  - Use batch operations
  - Monitor performance

### Integration Risks

**Risk 1: Breaking Existing Storage Operations**
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:**
  - All changes are additive
  - Maintain backward compatibility
  - Comprehensive regression testing

**Risk 2: WAL Checkpoint Issues**
- **Likelihood:** Low
- **Impact:** Medium
- **Mitigation:**
  - Test WAL checkpoint with active connections
  - Handle checkpoint failures gracefully
  - Monitor WAL file size

---

## Success Metrics

### Quantitative Metrics

- **TTL Sweep Duration:** < 5s for 1M entries (target)
- **Compaction Duration:** < 30s for 100MB database (target)
- **WAL Checkpoint Latency:** < 500ms (target)
- **Space Reclaimed:** > 20% after compaction (target)

### Qualitative Metrics

- **System Stability:** No data loss
- **Performance:** No degradation during maintenance
- **Reliability:** Maintenance jobs complete successfully

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
- Feature flag can disable maintenance jobs if needed
- Database backup before deployment

---

## References

- `AGENTS.md` - Project instructions and conventions
- `intelligence-pack-acu-dcb-storage/PRD_STORAGE_ENHANCEMENT.md` - Source storage PRD
- `context-pack-md/# VIVIM-FINAL — COMPLETE UPGRADE PACKAGE.md` - Upgrade package storage section
- `src/storage/db.ts` - Existing storage implementation
