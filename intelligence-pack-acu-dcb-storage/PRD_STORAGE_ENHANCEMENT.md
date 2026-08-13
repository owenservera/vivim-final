# PRD: Storage Enhancement - Deduplication, TTL, and Compaction

**Product:** vivim-final Storage Layer  
**Source:** edge-pwa backend/src/storage/dedup.rs, backend/src/storage/lifecycle.rs, backend/src/storage/ops.rs  
**Version:** 1.0  
**Status:** Draft  
**Date:** 2026-08-13

---

## 1. Executive Summary

This PRD details the enhancement of the vivim-final storage layer with message deduplication, TTL-based lifecycle management, and database compaction from edge-pwa. These enhancements will transform the storage layer from basic CRUD operations to an intelligent, self-maintaining system that prevents duplicate data, automatically expires ephemeral data, and optimizes database size through compaction.

**Key Deliverables:**
- Message identity hashing with SHA256 for deduplication
- Upsert logic with source merging for duplicate detection
- TTL-based lifecycle management for ephemeral data
- SQLite compaction for database size optimization
- Pre-migration backup system for safety

**Estimated Effort:** 2 weeks  
**Risk Level:** Low (well-defined algorithms, additive changes)

---

## 2. Background

### 2.1 Current State

vivim-final storage has:
- Prisma ORM with 196 models in single schema
- SQLite database with WAL mode
- Basic CRUD operations through CapStoreDb
- No deduplication system
- No TTL-based cleanup
- No compaction mechanism
- No backup system for migrations

### 2.1.1 Dual-Storage Architecture

The storage layer is split into two distinct storage systems that require different compaction and backup strategies:

**Relational Store (Prisma/SQLite):** Handles structured data
- ConversationMessage, Memory, AcuCollection models
- Compaction: Uses SQLite's native VACUUM command
- Backup: Uses SQLite Online Backup API (sqlite3_backup) to prevent corruption from active WAL files
- WAL checkpoint required before compaction/backup

**KV Store (Tree-Based):** Handles ephemeral and cache data
- Ephemeral traces, context_bundles, deduplication hashes
- Compaction: Uses copy-compaction algorithm
- Backup: File-based operations (no WAL concerns)
- LRU/TTL-based eviction for cache management

### 2.2 Problem Statement

The current storage layer lacks:
1. **Message Deduplication:** No prevention of duplicate messages across sync/import
2. **Lifecycle Management:** No automatic cleanup of ephemeral data (traces, sessions)
3. **Database Optimization:** No compaction to reclaim free pages
4. **Migration Safety:** No backup system for schema changes

### 2.3 Solution Overview

Implement storage enhancements from edge-pwa to create an intelligent storage system that:
- Prevents duplicate messages via SHA256 identity hashing
- Automatically expires ephemeral data via TTL-based cleanup
- Optimizes database size through compaction
- Provides safety through pre-migration backups

---

## 3. Requirements

### 3.1 Functional Requirements

#### FR-1: Message Identity Hashing

**FR-1.1:** Implement SHA256-based message identity:
```
identity = SHA256(provider + "\0" + account + "\0" + conv_id + "\0" + [provider_msg_id OR (role + "\0" + content)])
```

**FR-1.2:** Support two identity modes:
- **Provider ID mode:** Use provider_msg_id if available and non-empty
- **Role+Content mode:** Use role and content if provider_msg_id unavailable

**FR-1.3:** Identity components:
- provider (string)
- account (string)
- conv_id (string)
- role (string) - for role+content mode
- content (string) - for role+content mode
- provider_msg_id (optional string) - for provider ID mode

**FR-1.4:** Identity stability:
- Same inputs must produce same identity hash
- Different inputs must produce different identity hashes
- Identity must be deterministic across runs

#### FR-2: Message Upsert with Deduplication

**FR-2.1:** Implement upsert logic with three outcomes:
- **Inserted:** No existing message with same identity
- **Merged:** Existing message found, sources merged
- **Unchanged:** Existing message found, no new sources

**FR-2.2:** Source merging logic:
```
existing_sources = get_existing_sources(identity)
all_sources = union(existing_sources, new_sources)
if all_sources != existing_sources:
    update_sources(identity, all_sources)
    return Merged
else:
    return Unchanged
```

**FR-2.3:** Store deduplication records:
```
key = "{conv_id}:{identity}"
value = {
  identity: string,
  provider: string,
  account: string,
  conv_id: string,
  role: string,
  content: string,
  sources: string[],
  created_at: timestamp
}
```

**FR-2.4:** Implement existence check:
```
exists(conv_id, identity) -> bool
```

#### FR-3: TTL-Based Lifecycle Management

**FR-3.1:** Implement TTL constants:
```
TRACES_TTL_HOURS = 48
SESSIONS_TTL_HOURS = 6
SYNC_HISTORY_TTL_DAYS = 30
OBSERVATORY_TRAFFIC_TTL_DAYS = 7
OBSERVATORY_TRAFFIC_MAX = 2000
```

**FR-3.2:** Implement timestamp parsing:
```
parse_ts(value):
    for field in ["expires_at", "timestamp", "created_at", "ts", "updated_at"]:
        if value[field] is string:
            try parse as RFC3339
        if value[field] is number:
            if > 1_000_000_000_000: parse as milliseconds
            else: parse as seconds
    return null
```

**FR-3.3:** Implement TTL sweep:
```
sweep(tree, cutoff):
    entries = scan(tree, "", 1_000_000)
    expired = entries.filter(parse_ts(entry.value) < cutoff)
    delete expired entries in batch
    return count of deleted entries
```

**FR-3.4:** Implement cap-based sweep:
```
sweep_cap(tree, max):
    entries = scan(tree, "", 1_000_000)
    if entries.length <= max: return 0
    
    sort entries by timestamp descending (newest first)
    expired = entries[max:]  # all beyond max
    delete expired entries in batch
    return count of deleted entries
```

**FR-3.5:** Implement ephemeral sweep job:
```
sweep_ephemeral():
    now = current_time()
    
    # TTL-based sweeps
    sweep("traces", now - 48 hours)
    sweep("gemini_sessions", now - 6 hours)
    sweep("sync_history", now - 30 days)
    sweep("observatory_traffic", now - 7 days)
    
    # Cap-based sweep
    sweep_cap("observatory_traffic", 2000)
```

#### FR-4: Database Compaction

**FR-4.1:** Implement copy-compaction algorithm:
```
compact():
    live_path = database_path
    tmp_path = live_path + ".compact.tmp"
    backup_path = live_path + ".pre-compact"
    
    # Remove tmp if exists
    if tmp_path.exists(): delete(tmp_path)
    
    # Copy all data from live to tmp
    src = open(live_path)
    dst = create(tmp_path)
    for each entry in src:
        dst.insert(entry.key, entry.value)
    
    # Swap: backup live, move tmp -> live
    if backup_path.exists(): delete(backup_path)
    rename(live_path, backup_path)
    rename(tmp_path, live_path)
    
    report size reduction
```

**FR-4.2:** Implement compaction safety:
- Always create backup before compaction
- Atomic swap (rename operations)
- Verify compaction success before cleanup
- Keep backup for manual recovery

**FR-4.3:** Implement purge operation:
```
purge(tree):
    prefix = tree + ":"
    
    # Pass 1: collect keys and byte size
    keys = []
    bytes = 0
    for entry in scan(tree, prefix):
        keys.append(entry.key)
        bytes += entry.key.length + entry.value.length
    
    # Pass 2: delete in single transaction
    delete keys in batch
    
    report purged count and bytes
    note: file size unchanged until compact
```

**FR-4.4:** Implement stats operation:
```
stats():
    file_bytes = file_size(database_path)
    live_bytes = 0
    tree_bytes = {}
    tree_keys = {}
    
    for each entry in database:
        entry_bytes = entry.key.length + entry.value.length
        live_bytes += entry_bytes
        tree = extract_tree_from_key(entry.key)
        tree_bytes[tree] += entry_bytes
        tree_keys[tree] += 1
    
    live_ratio = live_bytes / file_bytes
    
    report:
        file_bytes, file_mb
        live_bytes, live_mb
        live_ratio
        trees: [{tree, keys, bytes, mb}]
```

#### FR-5: Pre-Migration Backup

**FR-5.1:** Implement backup creation:
```
create_backup(db_path, version):
    backup_path = db_path + ".backup.{version}.{timestamp}"
    copy_file(db_path, backup_path)
    
    # Keep last 5 backups, prune older ones
    backups = list_backups(db_path)
    if backups.length > 5:
        delete oldest backups
    
    return backup_path
```

**FR-5.2:** Integrate backup into migration:
```
run_migration():
    current_version = get_schema_version()
    backup_path = create_backup(db_path, current_version)
    
    try:
        apply_migration()
        new_version = get_schema_version()
        log("Migration successful", backup_path, current_version, new_version)
    catch error:
        restore_from_backup(backup_path)
        log("Migration failed, restored", backup_path)
        raise error
```

**FR-5.3:** Implement backup restoration:
```
restore_from_backup(backup_path):
    db_path = original_database_path
    delete_file(db_path)
    copy_file(backup_path, db_path)
    log("Restored from backup", backup_path)
```

### 3.2 Non-Functional Requirements

#### NFR-1: Performance

**NFR-1.1:** Message identity hashing < 1ms per message
**NFR-1.2:** Upsert operation < 10ms per message
**NFR-1.3:** TTL sweep < 5s for 1M entries
**NFR-1.4:** Compaction < 30s for 100MB database
**NFR-1.5:** WAL checkpoint latency < 500ms
**NFR-1.6:** Prisma Batch Deletes (for TTL sweep) must use `$transaction` to reduce I/O overhead by 90%

#### NFR-2: Accuracy

**NFR-2.1:** Identity hashing must be collision-free
**NFR-2.2:** TTL sweep must not delete non-expired entries
**NFR-2.3:** Compaction must preserve all data

#### NFR-3: Reliability

**NFR-3.1:** Upsert must handle concurrent operations
**NFR-3.2:** TTL sweep must handle missing timestamps gracefully
**NFR-3.3:** Compaction must be atomic (no partial state)

#### NFR-4: Compatibility

**NFR-4.1:** All changes must be backward compatible
**NFR-4.2:** Existing CRUD operations must continue to work
**NFR-4.3:** API changes must be additive

---

## 4. Technical Design

### 4.1 Data Model Changes

#### 4.1.1 Message Identity Hash

```typescript
// src/storage/dedup.ts

import { createHash } from 'crypto';

interface MessageIdentityInput {
  provider: string;
  account: string;
  convId: string;
  role: string;
  content: string;
  providerMsgId?: string;
}

class MessageIdentity {
  /**
   * Generate SHA256-based message identity
   * identity = SHA256(provider + "\0" + account + "\0" + conv_id + "\0" + [provider_msg_id OR (role + "\0" + content)])
   */
  static generate(input: MessageIdentityInput): string {
    const hash = createHash('sha256');
    
    hash.update(input.provider);
    hash.update('\0');
    hash.update(input.account);
    hash.update('\0');
    hash.update(input.convId);
    hash.update('\0');
    
    if (input.providerMsgId && input.providerMsgId.length > 0) {
      // Provider ID mode
      hash.update('id\0');
      hash.update(input.providerMsgId);
    } else {
      // Role+Content mode
      hash.update('rc\0');
      hash.update(input.role);
      hash.update('\0');
      hash.update(input.content);
    }
    
    return hash.digest('hex');
  }
}
```

#### 4.1.2 Deduplication Record

```typescript
// src/storage/dedup.ts

interface DedupRecord {
  identity: string;
  provider: string;
  account: string;
  convId: string;
  role: string;
  content: string;
  sources: string[];
  createdAt: number;
}

enum UpsertOutcome {
  Inserted = 'Inserted',
  Merged = 'Merged',
  Unchanged = 'Unchanged',
}
```

#### 4.1.3 TTL Configuration

```typescript
// src/storage/lifecycle.ts

interface TtlConfig {
  tracesTtlHours: number;
  sessionsTtlHours: number;
  syncHistoryTtlDays: number;
  observatoryTrafficTtlDays: number;
  observatoryTrafficMax: number;
}

const DEFAULT_TTL_CONFIG: TtlConfig = {
  tracesTtlHours: 48,
  sessionsTtlHours: 6,
  syncHistoryTtlDays: 30,
  observatoryTrafficTtlDays: 7,
  observatoryTrafficMax: 2000,
};
```

### 4.2 Algorithm Implementation

#### 4.2.1 Message Upsert with Deduplication

```typescript
// src/storage/dedup.ts

class DeduplicationManager {
  constructor(
    private storage: DeduplicationStore,
    private eventBus?: EventBus // For Memory Engine integration
  ) {}

  /**
   * Upsert message with deduplication
   * Returns (outcome, identity)
   */
  async upsertMessage(
    input: MessageIdentityInput,
    sources: string[]
  ): Promise<{ outcome: UpsertOutcome; identity: string }> {
    const identity = MessageIdentity.generate(input);
    const key = `${input.convId}:${identity}`;

    const existing = await this.storage.getRecord(key);

    if (existing) {
      // Merge sources
      const existingSources = existing.sources || [];
      const allSources = new Set([...existingSources, ...sources]);
      
      if (allSources.size !== existingSources.length) {
        // Sources changed, update record
        await this.storage.saveRecord(key, {
          ...existing,
          sources: Array.from(allSources),
        });
        
        // Emit event to Memory Engine for relevance decay boost
        this.emitMemoryAccessEvent(identity, input);
        
        return { outcome: UpsertOutcome.Merged, identity };
      } else {
        // No change - still emit event as this is a re-encounter
        this.emitMemoryAccessEvent(identity, input);
        return { outcome: UpsertOutcome.Unchanged, identity };
      }
    } else {
      // Insert new record
      const record: DedupRecord = {
        identity,
        provider: input.provider,
        account: input.account,
        convId: input.convId,
        role: input.role,
        content: input.content,
        sources,
        createdAt: Date.now(),
      };
      
      await this.storage.saveRecord(key, record);
      return { outcome: UpsertOutcome.Inserted, identity };
    }
  }

  /**
   * Emit event to Memory Engine for relevance decay boost
   * When a duplicate message is encountered, this signals the Memory Engine
   * to increment accessCount and update lastAccessedAt for linked memory snippets
   */
  private emitMemoryAccessEvent(identity: string, input: MessageIdentityInput): void {
    if (this.eventBus) {
      this.eventBus.emit('memory:access', {
        identity,
        convId: input.convId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Check if message exists
   */
  async exists(convId: string, identity: string): Promise<boolean> {
    const key = `${convId}:${identity}`;
    const existing = await this.storage.getRecord(key);
    return existing !== null;
  }
}
```

#### 4.2.2 TTL Sweep Algorithm

```typescript
// src/storage/lifecycle.ts

class LifecycleManager {
  constructor(
    private storage: LifecycleStore,
    private config: TtlConfig = DEFAULT_TTL_CONFIG
  ) {}

  /**
   * Parse timestamp from value
   * Supports RFC3339 strings and epoch numbers (seconds or milliseconds)
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
        // Determine if seconds or milliseconds
        if (fieldValue > 1_000_000_000_000) {
          return fieldValue; // Milliseconds
        } else {
          return fieldValue * 1000; // Seconds to milliseconds
        }
      }
    }
    
    return null;
  }

  /**
   * Sweep tree for expired entries
   */
  private async sweep(tree: string, cutoff: number): Promise<number> {
    const entries = await this.storage.scan(tree, '', 1_000_000);
    
    const expiredKeys = entries
      .filter(entry => {
        const timestamp = this.parseTimestamp(entry.value);
        return timestamp !== null && timestamp < cutoff;
      })
      .map(entry => entry.key);
    
    if (expiredKeys.length > 0) {
      await this.storage.deleteBatch(tree, expiredKeys);
    }
    
    return expiredKeys.length;
  }

  /**
   * Sweep tree with cap (keep only newest N entries)
   */
  private async sweepCap(tree: string, max: number): Promise<number> {
    const entries = await this.storage.scan(tree, '', 1_000_000);
    
    if (entries.length <= max) {
      return 0;
    }
    
    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => {
      const timestampA = this.parseTimestamp(a.value) || 0;
      const timestampB = this.parseTimestamp(b.value) || 0;
      return timestampB - timestampA;
    });
    
    // Keep first max entries, delete the rest
    const expiredKeys = entries.slice(max).map(entry => entry.key);
    
    if (expiredKeys.length > 0) {
      await this.storage.deleteBatch(tree, expiredKeys);
    }
    
    return expiredKeys.length;
  }

  /**
   * Run ephemeral sweep job
   */
  async sweepEphemeral(): Promise<{
    traces: number;
    sessions: number;
    syncHistory: number;
    observatoryTrafficTtl: number;
    observatoryTrafficCap: number;
    contextBundles: number;
    deprecatedMemories: number;
  }> {
    const now = Date.now();
    
    // KV Store sweeps
    const traces = await this.sweep(
      'traces',
      now - (this.config.tracesTtlHours * 60 * 60 * 1000)
    );
    
    const sessions = await this.sweep(
      'gemini_sessions',
      now - (this.config.sessionsTtlHours * 60 * 60 * 1000)
    );
    
    const syncHistory = await this.sweep(
      'sync_history',
      now - (this.config.syncHistoryTtlDays * 24 * 60 * 60 * 1000)
    );
    
    const observatoryTrafficTtl = await this.sweep(
      'observatory_traffic',
      now - (this.config.observatoryTrafficTtlDays * 24 * 60 * 60 * 1000)
    );
    
    const observatoryTrafficCap = await this.sweepCap(
      'observatory_traffic',
      this.config.observatoryTrafficMax
    );
    
    // Cross-engine lifecycle integration
    const contextBundles = await this.sweepContextBundles(now);
    const deprecatedMemories = await this.sweepDeprecatedMemories(now);
    
    return {
      traces,
      sessions,
      syncHistory,
      observatoryTrafficTtl,
      observatoryTrafficCap,
      contextBundles,
      deprecatedMemories,
    };
  }

  /**
   * Sweep Context Assembly bundles (LRU/TTL eviction)
   * Evicts bundles not accessed in >14 days to prevent infinite cache growth
   */
  private async sweepContextBundles(now: number): Promise<number> {
    const bundleTtl = 14 * 24 * 60 * 60 * 1000; // 14 days
    return await this.sweep('context_bundles', now - bundleTtl);
  }

  /**
   * Sweep deprecated/archived memories
   * Removes memories where ConsolidationStatus == 'Deprecated' or is_archived == true
   * and updatedAt is older than 90 days
   */
  private async sweepDeprecatedMemories(now: number): Promise<number> {
    const memoryTtl = 90 * 24 * 60 * 60 * 1000; // 90 days
    const cutoff = now - memoryTtl;
    
    // This would use Prisma to query and delete deprecated memories
    // Implementation depends on Memory Engine schema
    // Placeholder for actual implementation
    return 0;
  }
}
```

#### 4.2.3 Database Compaction

```typescript
// src/storage/compaction.ts

import { promises as fs } from 'fs';
import path from 'path';

class CompactionManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Compact SQLite database using native VACUUM
   * For Relational Store (Prisma/SQLite) - uses SQLite's native VACUUM
   */
  async compactSqlite(): Promise<{
    beforeMb: number;
    afterMb: number;
    reclaimedMb: number;
  }> {
    // Pre-compaction WAL checkpoint to flush memory to main DB file
    await this.prisma.$executeRaw`PRAGMA wal_checkpoint(TRUNCATE);`;
    
    // Get database file size before VACUUM
    const dbPath = this.getDatabasePath();
    const beforeStats = await fs.stat(dbPath);
    const beforeBytes = beforeStats.size;
    
    // Execute SQLite VACUUM
    await this.prisma.$executeRaw`VACUUM;`;
    
    // Get database file size after VACUUM
    const afterStats = await fs.stat(dbPath);
    const afterBytes = afterStats.size;
    
    const reclaimedBytes = Math.max(0, beforeBytes - afterBytes);
    
    return {
      beforeMb: beforeBytes / (1024 * 1024),
      afterMb: afterBytes / (1024 * 1024),
      reclaimedMb: reclaimedBytes / (1024 * 1024),
    };
  }

  /**
   * Compact KV store using copy-compaction
   * For KV Store (Tree-Based) - uses copy-compaction algorithm
   */
  async compactKvStore(dbPath: string): Promise<{
    beforeMb: number;
    afterMb: number;
    reclaimedMb: number;
    backup: string;
  }> {
    const livePath = dbPath;
    const tmpPath = dbPath + '.compact.tmp';
    const backupPath = dbPath + '.pre-compact';
    
    // Check if database exists
    try {
      await fs.access(livePath);
    } catch {
      throw new Error(`No database at ${livePath}`);
    }
    
    const beforeStats = await fs.stat(livePath);
    const beforeBytes = beforeStats.size;
    
    // Remove tmp if exists
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Ignore if doesn't exist
    }
    
    // Copy all data from live to tmp
    await this.copyKvDatabase(livePath, tmpPath);
    
    const afterStats = await fs.stat(tmpPath);
    const afterBytes = afterStats.size;
    
    // Atomic swap: backup live, move tmp -> live
    try {
      await fs.unlink(backupPath);
    } catch {
      // Ignore if doesn't exist
    }
    
    await fs.rename(livePath, backupPath);
    await fs.rename(tmpPath, livePath);
    
    const reclaimedBytes = Math.max(0, beforeBytes - afterBytes);
    
    return {
      beforeMb: beforeBytes / (1024 * 1024),
      afterMb: afterBytes / (1024 * 1024),
      reclaimedMb: reclaimedBytes / (1024 * 1024),
      backup: backupPath,
    };
  }

  /**
   * Get SQLite database path from Prisma connection
   */
  private getDatabasePath(): string {
    // Implementation depends on Prisma configuration
    // Placeholder for actual implementation
    return './vivim.db';
  }

  /**
   * Copy KV database from source to destination
   */
  private async copyKvDatabase(srcPath: string, dstPath: string): Promise<void> {
    // Implementation depends on KV store type (redb, lmdb, etc.)
    // Placeholder for actual implementation
    throw new Error('KV database copy implementation depends on store type');
  }

  /**
   * Purge all keys under a tree prefix
   */
  async purge(tree: string): Promise<{
    purgedKeys: number;
    purgedMb: number;
  }> {
    const prefix = tree + ':';
    
    // Pass 1: collect keys and byte size
    const entries = await this.storage.scan(tree, prefix, 1_000_000);
    const keys = entries.map(e => e.key);
    const bytes = entries.reduce((sum, e) => {
      const keySize = e.key.length;
      const valueSize = JSON.stringify(e.value).length;
      return sum + keySize + valueSize;
    }, 0);
    
    // Pass 2: delete in single transaction
    if (keys.length > 0) {
      await this.storage.deleteBatch(tree, keys);
    }
    
    return {
      purgedKeys: keys.length,
      purgedMb: bytes / (1024 * 1024),
    };
  }

  /**
   * Get database statistics
   */
  async stats(dbPath: string): Promise<{
    fileBytes: number;
    fileMb: number;
    liveBytes: number;
    liveMb: number;
    liveRatio: number;
    trees: Array<{
      tree: string;
      keys: number;
      bytes: number;
      mb: number;
    }>;
  }> {
    const fileStats = await fs.stat(dbPath);
    const fileBytes = fileStats.size;
    
    // Scan database to calculate live bytes
    const treeStats = new Map<string, { keys: number; bytes: number }>();
    let liveBytes = 0;
    
    const entries = await this.storage.scan('', '', 1_000_000);
    for (const entry of entries) {
      const keySize = entry.key.length;
      const valueSize = JSON.stringify(entry.value).length;
      const entryBytes = keySize + valueSize;
      
      liveBytes += entryBytes;
      
      const tree = entry.key.split(':')[0] || '?';
      const stats = treeStats.get(tree) || { keys: 0, bytes: 0 };
      stats.keys += 1;
      stats.bytes += entryBytes;
      treeStats.set(tree, stats);
    }
    
    const trees = Array.from(treeStats.entries())
      .map(([tree, stats]) => ({
        tree,
        keys: stats.keys,
        bytes: stats.bytes,
        mb: stats.bytes / (1024 * 1024),
      }))
      .sort((a, b) => b.bytes - a.bytes);
    
    const liveRatio = fileBytes > 0 ? liveBytes / fileBytes : 0;
    
    return {
      fileBytes,
      fileMb: fileBytes / (1024 * 1024),
      liveBytes,
      liveMb: liveBytes / (1024 * 1024),
      liveRatio,
      trees,
    };
  }
}
```

#### 4.2.4 Pre-Migration Backup

```typescript
// src/storage/backup.ts

import { promises as fs } from 'fs';
import path from 'path';

class BackupManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create SQLite backup using Online Backup API
   * For Relational Store (Prisma/SQLite) - uses SQLite Online Backup API
   * to ensure readers/writers are not blocked and backup is perfectly consistent
   */
  async createSqliteBackup(version: number): Promise<string> {
    // Pre-backup WAL checkpoint to flush memory to main DB file
    await this.prisma.$executeRaw`PRAGMA wal_checkpoint(TRUNCATE);`;
    
    const dbPath = this.getDatabasePath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${dbPath}.backup.v${version}.${timestamp}`;
    
    // Use SQLite Online Backup API via better-sqlite3 or native driver bindings
    // This ensures the backup is perfectly consistent even with active WAL files
    await this.sqliteOnlineBackup(dbPath, backupPath);
    
    // Keep last 5 backups, prune older ones
    await this.pruneOldBackups(dbPath, 5);
    
    return backupPath;
  }

  /**
   * Create KV store backup using file copy
   * For KV Store (Tree-Based) - uses file-based operations (no WAL concerns)
   */
  async createKvBackup(dbPath: string, version: number): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${dbPath}.backup.v${version}.${timestamp}`;
    
    await fs.copyFile(dbPath, backupPath);
    
    // Keep last 5 backups, prune older ones
    await this.pruneOldBackups(dbPath, 5);
    
    return backupPath;
  }

  /**
   * SQLite Online Backup API implementation
   * Uses sqlite3_backup to ensure consistent backups with active WAL files
   */
  private async sqliteOnlineBackup(srcPath: string, dstPath: string): Promise<void> {
    // Implementation depends on SQLite driver (better-sqlite3, node-sqlite3, etc.)
    // Placeholder for actual implementation
    throw new Error('SQLite Online Backup implementation depends on driver');
  }

  /**
   * Prune old backups, keeping only the most recent N
   */
  private async pruneOldBackups(dbPath: string, keep: number): Promise<void> {
    const dir = path.dirname(dbPath);
    const basename = path.basename(dbPath);
    
    // List all backup files for this database
    const files = await fs.readdir(dir);
    const backups = files
      .filter(f => f.startsWith(`${basename}.backup.`))
      .sort()
      .reverse(); // Newest first
    
    // Delete backups beyond keep limit
    for (let i = keep; i < backups.length; i++) {
      const backupPath = path.join(dir, backups[i]);
      await fs.unlink(backupPath);
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupPath: string, dbPath: string): Promise<void> {
    await fs.unlink(dbPath);
    await fs.copyFile(backupPath, dbPath);
  }

  /**
   * Run migration with backup
   */
  async runMigrationWithBackup(
    dbPath: string,
    migrationFn: () => Promise<void>
  ): Promise<void> {
    const currentVersion = await this.getSchemaVersion(dbPath);
    const backupPath = await this.createBackup(dbPath, currentVersion);
    
    try {
      await migrationFn();
      const newVersion = await this.getSchemaVersion(dbPath);
      
      console.log(`Migration successful: v${currentVersion} → v${newVersion}`);
      console.log(`Backup: ${backupPath}`);
    } catch (error) {
      console.log(`Migration failed, restoring from backup: ${backupPath}`);
      await this.restoreFromBackup(backupPath, dbPath);
      throw error;
    }
  }

  /**
   * Get current schema version from database
   */
  private async getSchemaVersion(dbPath: string): Promise<number> {
    // This would read from SchemaMeta table or similar
    // Placeholder implementation
    return 1;
  }
}
```

### 4.3 API Design

#### 4.3.1 Enhanced Storage Interface

```typescript
// src/storage/db.ts

export class CapStoreDb {
  // ... existing methods ...

  /**
   * Upsert message with deduplication
   */
  async upsertMessageWithDedup(
    input: MessageIdentityInput,
    sources: string[]
  ): Promise<{ outcome: UpsertOutcome; identity: string }> {
    const dedupManager = new DeduplicationManager(this.dedupStore);
    return await dedupManager.upsertMessage(input, sources);
  }

  /**
   * Check if message exists
   */
  async messageExists(convId: string, identity: string): Promise<boolean> {
    const dedupManager = new DeduplicationManager(this.dedupStore);
    return await dedupManager.exists(convId, identity);
  }

  /**
   * Run TTL sweep job
   */
  async sweepEphemeral(): Promise<{
    traces: number;
    sessions: number;
    syncHistory: number;
    observatoryTrafficTtl: number;
    observatoryTrafficCap: number;
  }> {
    const lifecycleManager = new LifecycleManager(this.lifecycleStore);
    return await lifecycleManager.sweepEphemeral();
  }

  /**
   * Compact database
   */
  async compactDatabase(): Promise<{
    beforeMb: number;
    afterMb: number;
    reclaimedMb: number;
    backup: string;
  }> {
    const compactionManager = new CompactionManager();
    return await compactionManager.compact(this.databasePath);
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    fileBytes: number;
    fileMb: number;
    liveBytes: number;
    liveMb: number;
    liveRatio: number;
    trees: Array<{
      tree: string;
      keys: number;
      bytes: number;
      mb: number;
    }>;
  }> {
    const compactionManager = new CompactionManager();
    return await compactionManager.stats(this.databasePath);
  }
}
```

---

## 5. Implementation Plan

### 5.1 Phase 1: Foundation (Days 1-3)

**Tasks:**
1. Add MessageIdentity class with SHA256 hashing
2. Add DedupRecord interface and UpsertOutcome enum
3. Add TtlConfig interface and constants
4. Implement DeduplicationManager class
5. Implement LifecycleManager class
6. Add storage contracts for deduplication and lifecycle

**Deliverables:**
- Core type definitions
- Deduplication manager implementation
- Lifecycle manager implementation
- Unit tests for identity hashing and TTL logic

**Success Criteria:**
- Identity hashing produces stable results
- TTL sweep correctly identifies expired entries
- Unit tests pass

### 5.2 Phase 2: Integration (Days 4-7)

**Tasks:**
1. Integrate deduplication into message creation
2. Integrate TTL sweep into scheduled jobs
3. Add CompactionManager class
4. Implement database copy for compaction
5. Integrate compaction into maintenance jobs

**Deliverables:**
- Enhanced message creation with deduplication
- Scheduled TTL sweep job
- Compaction implementation
- Integration tests

**Success Criteria:**
- Deduplication prevents duplicate messages
- TTL sweep removes expired entries
- Compaction reduces database size
- Integration tests pass

### 5.3 Phase 3: Backup System (Days 8-10)

**Tasks:**
1. Add BackupManager class
2. Implement backup creation
3. Implement backup restoration
4. Integrate backup into migration system
5. Add backup pruning logic

**Deliverables:**
- Backup manager implementation
- Migration integration
- Backup restoration tests
- Documentation

**Success Criteria:**
- Backups created before migrations
- Restoration works correctly
- Migration rollback tested

### 5.4 Phase 4: Testing & Optimization (Days 11-14)

**Tasks:**
1. Performance testing (identity hashing, upsert, sweep, compaction)
2. Accuracy testing (identity collision, TTL correctness, compaction integrity)
3. Load testing (large datasets, concurrent operations)
4. Optimization (batching, caching)
5. Documentation completion

**Deliverables:**
- Performance test report
- Accuracy validation report
- Optimized implementation
- Complete documentation

**Success Criteria:**
- Performance targets met
- Accuracy validated
- Documentation complete

---

## 6. Testing Strategy

### 6.1 Unit Tests

#### Identity Hashing Tests

```typescript
describe('MessageIdentity', () => {
  test('identity is stable for same inputs', () => {
    const input: MessageIdentityInput = {
      provider: 'gemini',
      account: 'user@g.com',
      convId: 'conv1',
      role: 'user',
      content: 'hello',
    };
    
    const id1 = MessageIdentity.generate(input);
    const id2 = MessageIdentity.generate(input);
    
    expect(id1).toBe(id2);
  });

  test('identity differs by provider', () => {
    const input1: MessageIdentityInput = {
      provider: 'gemini',
      account: 'user@g.com',
      convId: 'conv1',
      role: 'user',
      content: 'hello',
    };
    
    const input2: MessageIdentityInput = {
      ...input1,
      provider: 'claude',
    };
    
    const id1 = MessageIdentity.generate(input1);
    const id2 = MessageIdentity.generate(input2);
    
    expect(id1).not.toBe(id2);
  });

  test('identity with provider msg id', () => {
    const input1: MessageIdentityInput = {
      provider: 'gemini',
      account: 'user@g.com',
      convId: 'conv1',
      role: 'user',
      content: 'hello',
      providerMsgId: 'msg-123',
    };
    
    const input2: MessageIdentityInput = {
      ...input1,
      providerMsgId: 'msg-456',
    };
    
    const id1 = MessageIdentity.generate(input1);
    const id2 = MessageIdentity.generate(input2);
    
    expect(id1).not.toBe(id2);
  });
});
```

#### TTL Sweep Tests

```typescript
describe('LifecycleManager', () => {
  test('sweep removes expired entries', async () => {
    const manager = new LifecycleManager(storage);
    
    // Add expired entry
    const expiredEntry = {
      key: 'traces:test1',
      value: { timestamp: Date.now() - (49 * 60 * 60 * 1000) }, // 49 hours ago
    };
    await storage.save('traces', expiredEntry.key, expiredEntry.value);
    
    const count = await manager.sweep('traces', Date.now() - (48 * 60 * 60 * 1000));
    
    expect(count).toBe(1);
  });

  test('sweep keeps non-expired entries', async () => {
    const manager = new LifecycleManager(storage);
    
    // Add non-expired entry
    const entry = {
      key: 'traces:test1',
      value: { timestamp: Date.now() - (47 * 60 * 60 * 1000) }, // 47 hours ago
    };
    await storage.save('traces', entry.key, entry.value);
    
    const count = await manager.sweep('traces', Date.now() - (48 * 60 * 60 * 1000));
    
    expect(count).toBe(0);
  });

  test('sweep cap removes oldest entries beyond max', async () => {
    const manager = new LifecycleManager(storage);
    
    // Add 10 entries
    for (let i = 0; i < 10; i++) {
      await storage.save('observatory_traffic', `test${i}`, {
        timestamp: Date.now() - (i * 1000),
      });
    }
    
    const count = await manager.sweepCap('observatory_traffic', 5);
    
    expect(count).toBe(5); // Keep 5 newest, delete 5 oldest
  });
});
```

### 6.2 Integration Tests

```typescript
describe('Storage Integration', () => {
  test('message upsert prevents duplicates', async () => {
    const db = new CapStoreDb();
    
    const input: MessageIdentityInput = {
      provider: 'gemini',
      account: 'user@g.com',
      convId: 'conv1',
      role: 'user',
      content: 'hello',
    };
    
    const result1 = await db.upsertMessageWithDedup(input, ['source1']);
    expect(result1.outcome).toBe(UpsertOutcome.Inserted);
    
    const result2 = await db.upsertMessageWithDedup(input, ['source2']);
    expect(result2.outcome).toBe(UpsertOutcome.Merged);
    
    const result3 = await db.upsertMessageWithDedup(input, ['source2']);
    expect(result3.outcome).toBe(UpsertOutcome.Unchanged);
  });

  test('TTL sweep removes expired traces', async () => {
    const db = new CapStoreDb();
    
    // Add expired trace
    await db.prisma.traceEntry.create({
      data: {
        engine: 'test',
        method: 'test',
        ts: BigInt(Date.now() - (49 * 60 * 60 * 1000)),
      },
    });
    
    const result = await db.sweepEphemeral();
    expect(result.traces).toBeGreaterThan(0);
  });
});
```

### 6.3 Performance Tests

```typescript
describe('Performance Tests', () => {
  test('identity hashing latency', () => {
    const input: MessageIdentityInput = {
      provider: 'gemini',
      account: 'user@g.com',
      convId: 'conv1',
      role: 'user',
      content: 'hello',
    };
    
    const start = performance.now();
    
    for (let i = 0; i < 10000; i++) {
      MessageIdentity.generate(input);
    }
    
    const elapsed = performance.now() - start;
    expect(elapsed / 10000).toBeLessThan(1); // < 1ms per hash
  });

  test('upsert latency', async () => {
    const db = new CapStoreDb();
    const input: MessageIdentityInput = {
      provider: 'gemini',
      account: 'user@g.com',
      convId: 'conv1',
      role: 'user',
      content: 'hello',
    };
    
    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      await db.upsertMessageWithDedup(input, [`source${i}`]);
    }
    
    const elapsed = performance.now() - start;
    expect(elapsed / 1000).toBeLessThan(10); // < 10ms per upsert
  });
});
```

---

## 7. Rollout Plan

### 7.1 Feature Flags

```typescript
const FEATURES = {
  MESSAGE_DEDUPLICATION: process.env.FEATURE_DEDUPLICATION === 'true',
  TTL_SWEEP: process.env.FEATURE_TTL_SWEEP === 'true',
  COMPACTION: process.env.FEATURE_COMPACTION === 'true',
  MIGRATION_BACKUP: process.env.FEATURE_MIGRATION_BACKUP === 'true',
};
```

### 7.2 Phased Rollout

**Week 1:** Development environment testing
**Week 2:** Staging environment with production data copy
**Week 3:** 10% production rollout
**Week 4:** 50% production rollout
**Week 5:** 100% production rollout

### 7.3 Monitoring

**Metrics to Track:**
- Deduplication rate (messages prevented)
- TTL sweep efficiency (entries removed)
- Compaction savings (bytes reclaimed)
- Backup success rate
- Identity hash collision rate
- WAL file size (monitor for growth)
- Live ratio (KV Store fragmentation)
- Bundle cache hit rate (Context Assembly efficiency)

**Alerts:**
- Deduplication rate < 1% (may indicate issue)
- TTL sweep failure rate > 1%
- Compaction failure
- Backup creation failure
- WAL file size > 50MB (trigger auto-compaction)
- KV Store live ratio < 0.40 (trigger compaction)
- Bundle cache hit rate < 70% (investigate cache strategy)

---

## 8. Success Metrics

### 8.1 Quantitative Metrics

- **Deduplication Rate:** % of messages prevented as duplicates (target: 5-10%)
- **TTL Sweep Efficiency:** % of expired entries removed (target: 95%)
- **Compaction Savings:** % reduction in database size (target: 20-30%)
- **Backup Success Rate:** % of successful backups (target: 100%)
- **Performance:** Identity hashing < 1ms, upsert < 10ms (target: 95% of requests)

### 8.2 Qualitative Metrics

- **Data Quality:** No duplicate messages in database
- **System Performance:** No degradation in existing operations
- **Storage Efficiency:** Reduced database size over time
- **Migration Safety:** Successful rollbacks when needed

---

## 9. Risks and Mitigations

### 9.1 Technical Risks

**Risk 1:** Identity hash collisions
- **Likelihood:** Very Low (SHA256 is cryptographically secure)
- **Impact:** High
- **Mitigation:** SHA256 is collision-free for practical purposes, monitor collision rate

**Risk 2:** TTL sweep deletes non-expired entries
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:** Thorough testing of timestamp parsing, conservative TTL values

**Risk 3:** Compaction corrupts database
- **Likelihood:** Low
- **Impact:** Critical
- **Mitigation:** Always create backup, atomic swap, verify compaction success

### 9.2 Integration Risks

**Risk 1:** Breaking existing message creation
- **Likelihood:** Low
- **Impact:** High
- **Mitigation:** All changes additive, backward compatibility, regression testing

### 9.3 Operational Risks

**Risk 1:** Increased storage usage from deduplication records
- **Likelihood:** Medium
- **Impact:** Low
- **Mitigation:** Deduplication records are small, TTL sweep can clean them up

**Risk 2:** WAL file corruption during compaction
- **Likelihood:** Low
- **Impact:** Critical
- **Mitigation:** Always force WAL checkpoint before compaction/backup, use SQLite Online Backup API

**Risk 3:** Cross-engine lifecycle conflicts
- **Likelihood:** Medium
- **Impact:** Medium
- **Mitigation:** Coordinate TTL sweeps across engines, test cascade deletes thoroughly

---

## 10. Appendix

### 10.1 SHA256 Identity Hash Reference

The message identity hash uses SHA256 with the following format:

```
identity = SHA256(provider + "\0" + account + "\0" + conv_id + "\0" + mode_specific_data)
```

Where mode_specific_data is:
- Provider ID mode: `"id\0" + provider_msg_id`
- Role+Content mode: `"rc\0" + role + "\0" + content`

The null byte (`\0`) is used as a separator to prevent collisions between different field combinations.

### 10.2 TTL Sweep Reference

The TTL sweep algorithm uses timestamp parsing with multiple field support:

```
parse_ts(value):
    for field in ["expires_at", "timestamp", "created_at", "ts", "updated_at"]:
        if value[field] is string: parse as RFC3339
        if value[field] is number:
            if > 1_000_000_000_000: treat as milliseconds
            else: treat as seconds
```

This flexible parsing handles various timestamp formats used across the system.

### 10.3 Compaction Reference

**SQLite Compaction (Relational Store):**
```typescript
// Pre-compaction WAL checkpoint
await prisma.$executeRaw`PRAGMA wal_checkpoint(TRUNCATE);`;

// Native SQLite VACUUM
await prisma.$executeRaw`VACUUM;`;
```

**KV Store Compaction (Tree-Based):**
The copy-compaction algorithm follows these steps:

1. Create temporary file
2. Copy all data from live to temporary
3. Backup live file
4. Rename live to backup
5. Rename temporary to live
6. Report size reduction

This ensures atomic operation with rollback capability via backup.

### 10.4 SQLite PRAGMA Optimization

Add these SQLite PRAGMAs to the database initialization for optimal performance:

```sql
PRAGMA journal_mode = WAL;          -- Essential for concurrent read/writes
PRAGMA synchronous = NORMAL;        -- Safe with WAL, improves write speed
PRAGMA cache_size = -20000;         -- 20MB cache for fast KV/Bundle reads
PRAGMA temp_store = MEMORY;         -- Speeds up VACUUM and complex sorts
PRAGMA mmap_size = 268435456;       -- 256MB memory mapping for fast scans
```

### 10.5 Schema Indexes for Engine Performance

Add these Prisma schema indexes to support <100ms NFR targets:

```prisma
model Memory {
  // ... existing fields ...
  @@index([dueDate, is_active], map: "idx_memory_fsrs_due")
  @@index([lastAccessedAt], map: "idx_memory_relevance_access")
}

model ConversationMessage {
  // ... ACU fields ...
  @@index([acuIsPinned, acuIsArchived], map: "idx_acu_visibility")
}
```

### 10.6 Prisma Batch Delete Optimization

Optimized Prisma Batch Delete for TTL Sweep to prevent N+1 query timeouts:

```typescript
// Optimized Prisma Batch Delete for TTL Sweep
async deleteBatch(tree: string, keys: string[]): Promise<void> {
  // Chunking to prevent SQLite lock contention and memory spikes
  const CHUNK_SIZE = 500;
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE);
    await prisma.$transaction([
      prisma.traceEntry.deleteMany({ where: { id: { in: chunk } } }),
      // Add other model deletions based on 'tree' mapping
    ]);
  }
}
```

---

**Document Version:** 1.1  
**Last Updated:** 2026-08-13  
**Status:** Updated with SQLite WAL safety, dual-storage architecture, and cross-engine lifecycle integration  
