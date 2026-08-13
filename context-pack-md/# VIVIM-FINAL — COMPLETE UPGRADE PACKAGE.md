# VIVIM-FINAL — COMPLETE UPGRADE PACKAGE
## Hierarchical Eternal Memory + Storage Hardening (Dedup · TTL · Compaction · Backup)

Built **against your actual codebase conventions**: Bun + Prisma/SQLite, `.js` import extensions, Store Contract pattern (engines never touch `impl/`), ULID `newId()`, BigInt-millis timestamps, `CapStoreError` hierarchy, pino `getLogger`, `catchDebug` swallow-guarding, and the existing FSRS-6 field set already present in `schema/node-data.ts`.

Everything below is **ADD-only** (per ADR-014 / "never rewrite" invariant). No existing model is mutated.

---

## File Tree

```
UPGRADE_PACKAGE/
├── prisma/
│   └── upgrade-memory-storage.prisma
├── src/
│   ├── storage/
│   │   ├── contracts/
│   │   │   ├── memory-store.ts
│   │   │   ├── dedup-store.ts
│   │   │   ├── lifecycle-store.ts
│   │   │   └── maintenance-store.ts
│   │   └── impl/
│   │       ├── memory-store-impl.ts
│   │       ├── dedup-store-impl.ts
│   │       ├── lifecycle-store-impl.ts
│   │       └── maintenance-store-impl.ts
│   ├── engines/
│   │   ├── memory/
│   │   │   ├── types.ts
│   │   │   ├── fsrs-scheduler.ts
│   │   │   ├── relevance-decay.ts
│   │   │   ├── memory-hierarchy.ts
│   │   │   └── consolidation-pipeline.ts
│   │   └── storage/
│   │       ├── message-identity.ts
│   │       ├── dedup-manager.ts
│   │       ├── ttl-sweeper.ts
│   │       ├── compaction-manager.ts
│   │       └── backup-manager.ts
│   └── server/
│       └── maintenance-wiring.ts
├── scripts/
│   ├── backup-db.ts
│   ├── restore-db.ts
│   ├── compact-db.ts
│   └── sweep-ephemeral.ts
└── tests/unit/engines/
    ├── fsrs-scheduler.test.ts
    ├── relevance-decay.test.ts
    ├── message-identity.test.ts
    ├── ttl-sweeper.test.ts
    └── memory-hierarchy.test.ts
```

---

## 1. PRISMA SCHEMA ADDITIONS

**`prisma/upgrade-memory-storage.prisma`** — append to `prisma/schema.prisma`, then `bunx prisma db push --skip-generate`.

```prisma
// ═══════════════════════════════════════════════════════════════════
// L-MEM: Hierarchical Eternal Memory — FSRS-6 queryable spine
// ctx: memory. ADD-only. The durable artifact lives in the universal
// Node layer (cap-store.memory); this is the materialized query spine
// (same pattern as AgentSession / EntityContainer beside Nodes).
// ═══════════════════════════════════════════════════════════════════
model MemoryRecord {
  id                    String  @id
  agentId               String  @default("system") @map("agent_id")
  nodeId                String? @map("node_id") // → Node(cap-store.memory)
  memoryType            String  @map("memory_type")
  category              String
  subcategory           String?
  content               String
  summary               String?
  tagsJson              String  @default("[]") @map("tags_json")
  importance            Float   @default(0.5)
  relevance             Float   @default(0.5)
  // FSRS-6 (mirrors MemoryDataSchema)
  stability             Float   @default(1.0)
  difficulty            Float   @default(0.3)
  dueDate               BigInt  @map("due_date")
  lastReview            BigInt? @map("last_review")
  reviewCount           Int     @default(0) @map("review_count")
  fsrsState             String  @default("New") @map("fsrs_state")
  // Hierarchy / lifecycle
  consolidationStatus   String  @default("unconsolidated") @map("consolidation_status")
  accessCount           Int     @default(0) @map("access_count")
  lastAccessedAt        BigInt? @map("last_accessed_at")
  isPinned              Int     @default(0) @map("is_pinned")
  isEternal             Int     @default(0) @map("is_eternal")
  isArchived            Int     @default(0) @map("is_archived")
  sourceConversationIdsJson String @default("[]") @map("source_conversation_ids_json")
  occurredAt            BigInt? @map("occurred_at")
  expiresAt             BigInt? @map("expires_at") // TTL for non-eternal ephemera
  embeddingId           String? @map("embedding_id") // → MemoryEmbedding
  createdAt             BigInt  @map("created_at")
  updatedAt             BigInt  @map("updated_at")

  @@index([agentId, dueDate], map: "idx_mr_due")
  @@index([agentId, fsrsState], map: "idx_mr_state")
  @@index([agentId, isEternal], map: "idx_mr_eternal")
  @@index([consolidationStatus], map: "idx_mr_consolidation")
  @@index([lastAccessedAt], map: "idx_mr_access")
  @@index([expiresAt], map: "idx_mr_expires")
  @@index([nodeId], map: "idx_mr_node")
  @@map("memory_record")
}

// ═══════════════════════════════════════════════════════════════════
// L-DEDUP: Cross-provider message identity (SHA256)
// ctx: storage. Prevents duplicate messages across sync/import and
// links the same logical message seen on chatgpt/claude/gemini.
// ═══════════════════════════════════════════════════════════════════
model MessageIdentityRecord {
  id             String  @id
  identity       String  @unique // SHA256 identity hash
  conversationId String  @map("conversation_id")
  providerId     String  @map("provider_id")
  accountId      String  @map("account_id")
  role           String
  contentHash    String  @map("content_hash")
  providerMsgId  String? @map("provider_msg_id")
  sourcesJson    String  @default("[]") @map("sources_json") // merged provenance
  messageId      String? @map("message_id") // canonical ConversationMessage.id
  nodeId         String? @map("node_id") // → Node(cap-store.message)
  createdAt      BigInt  @map("created_at")
  updatedAt      BigInt  @map("updated_at")

  @@index([conversationId], map: "idx_mir_conv")
  @@index([providerId, accountId], map: "idx_mir_provider")
  @@index([contentHash], map: "idx_mir_hash")
  @@map("message_identity_record")
}

// ═══════════════════════════════════════════════════════════════════
// L-OPS: Lifecycle + maintenance audit
// ctx: storage.
// ═══════════════════════════════════════════════════════════════════
model LifecycleSweepLog {
  id            String @id
  tree          String
  mode          String // 'ttl' | 'cap'
  cutoffTs      BigInt? @map("cutoff_ts")
  maxEntries    Int?   @map("max_entries")
  deletedCount  Int    @default(0) @map("deleted_count")
  exemptedCount Int    @default(0) @map("exempted_count") // pinned/eternal skipped
  durationMs    Int    @default(0) @map("duration_ms")
  ts            BigInt
  @@index([tree, ts], map: "idx_lsl_tree")
  @@map("lifecycle_sweep_log")
}

model MaintenanceOpLog {
  id         String  @id
  op         String // 'compact' | 'backup' | 'restore' | 'checkpoint'
  ok         Int     @default(1)
  beforeBytes BigInt? @map("before_bytes")
  afterBytes  BigInt? @map("after_bytes")
  backupPath  String? @map("backup_path")
  durationMs  Int     @default(0) @map("duration_ms")
  error       String?
  ts          BigInt
  @@index([op, ts], map: "idx_mol_op")
  @@map("maintenance_op_log")
}

model BackupRecord {
  id         String @id
  dbPath     String @map("db_path")
  backupPath String @unique @map("backup_path")
  version    String // schema/protocol version tag
  sizeBytes  BigInt @map("size_bytes")
  sha256     String
  createdAt  BigInt @map("created_at")
  @@index([dbPath, createdAt], map: "idx_br_db")
  @@map("backup_record")
}
```

---

## 2. STORAGE CONTRACTS

**`src/storage/contracts/memory-store.ts`**

```ts
// src/storage/contracts/memory-store.ts
// MemoryStore — FSRS-6 queryable spine contract. Engines depend on this only.

export interface MemoryRecordRow {
  id: string
  agentId: string
  nodeId: string | null
  memoryType: string
  category: string
  subcategory: string | null
  content: string
  summary: string | null
  tagsJson: string
  importance: number
  relevance: number
  stability: number
  difficulty: number
  dueDate: number
  lastReview: number | null
  reviewCount: number
  fsrsState: string
  consolidationStatus: string
  accessCount: number
  lastAccessedAt: number | null
  isPinned: boolean
  isEternal: boolean
  isArchived: boolean
  sourceConversationIdsJson: string
  occurredAt: number | null
  expiresAt: number | null
  embeddingId: string | null
  createdAt: number
  updatedAt: number
}

export interface MemoryRecordInput {
  id?: string
  agentId?: string
  nodeId?: string | null
  memoryType: string
  category: string
  subcategory?: string | null
  content: string
  summary?: string | null
  tags?: string[]
  importance?: number
  sourceConversationIds?: string[]
  occurredAt?: number | null
  expiresAt?: number | null
  embeddingId?: string | null
}

export interface MemoryQueryOpts {
  agentId?: string
  memoryType?: string
  isEternal?: boolean
  isPinned?: boolean
  isArchived?: boolean
  consolidationStatus?: string
  dueBefore?: number
  minImportance?: number
  limit?: number
  offset?: number
}

export interface MemoryStore {
  create(input: MemoryRecordInput): Promise<MemoryRecordRow>
  get(id: string): Promise<MemoryRecordRow | null>
  update(
    id: string,
    patch: Partial<
      Pick<
        MemoryRecordRow,
        | 'relevance'
        | 'stability'
        | 'difficulty'
        | 'dueDate'
        | 'lastReview'
        | 'reviewCount'
        | 'fsrsState'
        | 'consolidationStatus'
        | 'accessCount'
        | 'lastAccessedAt'
        | 'isPinned'
        | 'isEternal'
        | 'isArchived'
        | 'summary'
        | 'embeddingId'
      >
    >,
  ): Promise<MemoryRecordRow>
  query(opts: MemoryQueryOpts): Promise<MemoryRecordRow[]>
  collectDue(agentId: string, now: number, limit: number): Promise<MemoryRecordRow[]>
  listEternal(agentId: string, limit?: number): Promise<MemoryRecordRow[]>
  delete(id: string): Promise<void>
}
```

**`src/storage/contracts/dedup-store.ts`**

```ts
// src/storage/contracts/dedup-store.ts
// DedupStore — cross-provider message identity contract.

export interface MessageIdentityRow {
  id: string
  identity: string
  conversationId: string
  providerId: string
  accountId: string
  role: string
  contentHash: string
  providerMsgId: string | null
  sourcesJson: string
  messageId: string | null
  nodeId: string | null
  createdAt: number
  updatedAt: number
}

export interface MessageIdentityInput {
  identity: string
  conversationId: string
  providerId: string
  accountId: string
  role: string
  contentHash: string
  providerMsgId?: string | null
  sources: string[]
  messageId?: string | null
  nodeId?: string | null
}

export interface DedupStore {
  getByIdentity(identity: string): Promise<MessageIdentityRow | null>
  exists(conversationId: string, identity: string): Promise<boolean>
  upsert(input: MessageIdentityInput): Promise<{ row: MessageIdentityRow; created: boolean }>
  mergeSources(identity: string, newSources: string[]): Promise<{ changed: boolean; sources: string[] }>
  listByConversation(conversationId: string, limit?: number): Promise<MessageIdentityRow[]>
}
```

**`src/storage/contracts/lifecycle-store.ts`**

```ts
// src/storage/contracts/lifecycle-store.ts
// LifecycleStore — TTL/cap sweep data access. Returns only keys + metadata so the
// sweeper can apply eternal/pin exemptions before deleting.

export interface EphemeralEntry {
  id: string
  ts: number | null // parsed timestamp (ms) used for TTL ordering
  isPinned: boolean
  isEternal: boolean
}

export interface SweepCandidate {
  tree: 'traces' | 'semantic_memories' | 'parser_logs' | 'nodes' | 'memories'
  entries: EphemeralEntry[]
}

export interface LifecycleStore {
  // Each scanner returns candidates with pin/eternal flags for exemption.
  scanTraces(cutoff: number, limit: number): Promise<EphemeralEntry[]>
  scanExpiredSemanticMemories(cutoff: number, limit: number): Promise<EphemeralEntry[]>
  scanExpiredMemoryRecords(now: number, limit: number): Promise<EphemeralEntry[]>
  scanParserLogs(cutoff: number, limit: number): Promise<EphemeralEntry[]>
  deleteTraces(ids: string[]): Promise<number>
  deleteSemanticMemories(ids: string[]): Promise<number>
  deleteMemoryRecords(ids: string[]): Promise<number>
  deleteParserLogs(ids: string[]): Promise<number>
  logSweep(row: {
    tree: string
    mode: 'ttl' | 'cap'
    cutoffTs?: number | null
    maxEntries?: number | null
    deletedCount: number
    exemptedCount: number
    durationMs: number
  }): Promise<void>
}
```

**`src/storage/contracts/maintenance-store.ts`**

```ts
// src/storage/contracts/maintenance-store.ts
// MaintenanceStore — compaction/backup primitive access. Raw PRAGMA/VACUUM lives
// here so engines never issue raw SQL directly.

export interface DbStats {
  fileBytes: number
  pageSize: number
  pageCount: number
  freelistCount: number
  liveBytes: number
  reclaimableBytes: number
  liveRatio: number
}

export interface BackupRow {
  id: string
  dbPath: string
  backupPath: string
  version: string
  sizeBytes: number
  sha256: string
  createdAt: number
}

export interface MaintenanceStore {
  getDbPath(): string
  checkpoint(): Promise<{ busy: number; log: number; checkpointed: number }>
  vacuum(): Promise<void>
  integrityCheck(): Promise<boolean>
  getStats(): Promise<DbStats>
  logOp(row: {
    op: string
    ok: boolean
    beforeBytes?: number | null
    afterBytes?: number | null
    backupPath?: string | null
    durationMs: number
    error?: string | null
  }): Promise<void>
  recordBackup(row: Omit<BackupRow, 'id'>): Promise<BackupRow>
  listBackups(dbPath: string): Promise<BackupRow[]>
  deleteBackup(backupPath: string): Promise<void>
}
```

---

## 3. STORAGE IMPLEMENTATIONS

**`src/storage/impl/memory-store-impl.ts`**

```ts
// src/storage/impl/memory-store-impl.ts
// Prisma-backed MemoryStore. Engines never import this directly (Store Contracts).
import { newId } from '../../ids.js'
import type {
  MemoryQueryOpts,
  MemoryRecordInput,
  MemoryRecordRow,
  MemoryStore,
} from '../contracts/memory-store.js'

type PrismaLike = {
  memoryRecord: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>
    findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>
    update(args: {
      where: { id: string }
      data: Record<string, unknown>
    }): Promise<Record<string, unknown>>
    findMany(args: {
      where?: Record<string, unknown>
      orderBy?: Record<string, string>[]
      take?: number
      skip?: number
    }): Promise<Record<string, unknown>[]>
    delete(args: { where: { id: string } }): Promise<unknown>
  }
}

function toRow(raw: Record<string, unknown>): MemoryRecordRow {
  return {
    id: String(raw.id),
    agentId: String(raw.agentId),
    nodeId: (raw.nodeId as string | null) ?? null,
    memoryType: String(raw.memoryType),
    category: String(raw.category),
    subcategory: (raw.subcategory as string | null) ?? null,
    content: String(raw.content),
    summary: (raw.summary as string | null) ?? null,
    tagsJson: String(raw.tagsJson ?? '[]'),
    importance: Number(raw.importance),
    relevance: Number(raw.relevance),
    stability: Number(raw.stability),
    difficulty: Number(raw.difficulty),
    dueDate: Number(raw.dueDate),
    lastReview: raw.lastReview == null ? null : Number(raw.lastReview),
    reviewCount: Number(raw.reviewCount),
    fsrsState: String(raw.fsrsState),
    consolidationStatus: String(raw.consolidationStatus),
    accessCount: Number(raw.accessCount),
    lastAccessedAt: raw.lastAccessedAt == null ? null : Number(raw.lastAccessedAt),
    isPinned: Number(raw.isPinned) === 1,
    isEternal: Number(raw.isEternal) === 1,
    isArchived: Number(raw.isArchived) === 1,
    sourceConversationIdsJson: String(raw.sourceConversationIdsJson ?? '[]'),
    occurredAt: raw.occurredAt == null ? null : Number(raw.occurredAt),
    expiresAt: raw.expiresAt == null ? null : Number(raw.expiresAt),
    embeddingId: (raw.embeddingId as string | null) ?? null,
    createdAt: Number(raw.createdAt),
    updatedAt: Number(raw.updatedAt),
  }
}

export class MemoryStoreImpl implements MemoryStore {
  constructor(private prisma: PrismaLike) {}

  async create(input: MemoryRecordInput): Promise<MemoryRecordRow> {
    const now = Date.now()
    const raw = await this.prisma.memoryRecord.create({
      data: {
        id: input.id ?? newId(),
        agentId: input.agentId ?? 'system',
        nodeId: input.nodeId ?? null,
        memoryType: input.memoryType,
        category: input.category,
        subcategory: input.subcategory ?? null,
        content: input.content,
        summary: input.summary ?? null,
        tagsJson: JSON.stringify(input.tags ?? []),
        importance: input.importance ?? 0.5,
        relevance: input.importance ?? 0.5,
        stability: 1.0,
        difficulty: 0.3,
        dueDate: now,
        fsrsState: 'New',
        consolidationStatus: 'unconsolidated',
        sourceConversationIdsJson: JSON.stringify(input.sourceConversationIds ?? []),
        occurredAt: input.occurredAt ?? null,
        expiresAt: input.expiresAt ?? null,
        embeddingId: input.embeddingId ?? null,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toRow(raw)
  }

  async get(id: string): Promise<MemoryRecordRow | null> {
    const raw = await this.prisma.memoryRecord.findUnique({ where: { id } })
    return raw ? toRow(raw) : null
  }

  async update(
    id: string,
    patch: Partial<Record<string, unknown>>,
  ): Promise<MemoryRecordRow> {
    const data: Record<string, unknown> = { ...patch, updatedAt: Date.now() }
    // Boolean → Int(0/1) coercion for SQLite
    for (const k of ['isPinned', 'isEternal', 'isArchived']) {
      if (typeof data[k] === 'boolean') data[k] = data[k] ? 1 : 0
    }
    for (const k of ['dueDate', 'lastReview', 'lastAccessedAt']) {
      if (typeof data[k] === 'number') data[k] = BigInt(Math.floor(data[k] as number))
    }
    const raw = await this.prisma.memoryRecord.update({ where: { id }, data })
    return toRow(raw)
  }

  async query(opts: MemoryQueryOpts): Promise<MemoryRecordRow[]> {
    const where: Record<string, unknown> = {}
    if (opts.agentId) where.agentId = opts.agentId
    if (opts.memoryType) where.memoryType = opts.memoryType
    if (opts.isEternal !== undefined) where.isEternal = opts.isEternal ? 1 : 0
    if (opts.isPinned !== undefined) where.isPinned = opts.isPinned ? 1 : 0
    if (opts.isArchived !== undefined) where.isArchived = opts.isArchived ? 1 : 0
    if (opts.consolidationStatus) where.consolidationStatus = opts.consolidationStatus
    if (opts.dueBefore !== undefined) where.dueDate = { lte: BigInt(opts.dueBefore) }
    if (opts.minImportance !== undefined) where.importance = { gte: opts.minImportance }
    const raws = await this.prisma.memoryRecord.findMany({
      where,
      orderBy: [{ relevance: 'desc' }, { createdAt: 'desc' }],
      take: opts.limit ?? 100,
      skip: opts.offset ?? 0,
    })
    return raws.map(toRow)
  }

  async collectDue(agentId: string, now: number, limit: number): Promise<MemoryRecordRow[]> {
    const raws = await this.prisma.memoryRecord.findMany({
      where: {
        agentId,
        isArchived: 0,
        dueDate: { lte: BigInt(now) },
      },
      orderBy: [{ dueDate: 'asc' }],
      take: limit,
    })
    return raws.map(toRow)
  }

  async listEternal(agentId: string, limit = 500): Promise<MemoryRecordRow[]> {
    const raws = await this.prisma.memoryRecord.findMany({
      where: { agentId, isEternal: 1, isArchived: 0 },
      orderBy: [{ importance: 'desc' }],
      take: limit,
    })
    return raws.map(toRow)
  }

  async delete(id: string): Promise<void> {
    await this.prisma.memoryRecord.delete({ where: { id } })
  }
}
```

**`src/storage/impl/dedup-store-impl.ts`**

```ts
// src/storage/impl/dedup-store-impl.ts
import { newId } from '../../ids.js'
import type {
  DedupStore,
  MessageIdentityInput,
  MessageIdentityRow,
} from '../contracts/dedup-store.js'

type PrismaLike = {
  messageIdentityRecord: {
    findUnique(args: { where: { identity: string } }): Promise<Record<string, unknown> | null>
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>
    update(args: {
      where: { identity: string }
      data: Record<string, unknown>
    }): Promise<Record<string, unknown>>
    findMany(args: {
      where?: Record<string, unknown>
      take?: number
      orderBy?: Record<string, string>[]
    }): Promise<Record<string, unknown>[]>
  }
}

function toRow(raw: Record<string, unknown>): MessageIdentityRow {
  return {
    id: String(raw.id),
    identity: String(raw.identity),
    conversationId: String(raw.conversationId),
    providerId: String(raw.providerId),
    accountId: String(raw.accountId),
    role: String(raw.role),
    contentHash: String(raw.contentHash),
    providerMsgId: (raw.providerMsgId as string | null) ?? null,
    sourcesJson: String(raw.sourcesJson ?? '[]'),
    messageId: (raw.messageId as string | null) ?? null,
    nodeId: (raw.nodeId as string | null) ?? null,
    createdAt: Number(raw.createdAt),
    updatedAt: Number(raw.updatedAt),
  }
}

export class DedupStoreImpl implements DedupStore {
  constructor(private prisma: PrismaLike) {}

  async getByIdentity(identity: string): Promise<MessageIdentityRow | null> {
    const raw = await this.prisma.messageIdentityRecord.findUnique({ where: { identity } })
    return raw ? toRow(raw) : null
  }

  async exists(conversationId: string, identity: string): Promise<boolean> {
    const row = await this.getByIdentity(identity)
    return row !== null && row.conversationId === conversationId
  }

  async upsert(
    input: MessageIdentityInput,
  ): Promise<{ row: MessageIdentityRow; created: boolean }> {
    const existing = await this.getByIdentity(input.identity)
    const now = Date.now()
    if (existing) {
      const merged = await this.mergeSources(input.identity, input.sources)
      const raw = await this.prisma.messageIdentityRecord.update({
        where: { identity: input.identity },
        data: {
          sourcesJson: JSON.stringify(merged.sources),
          messageId: input.messageId ?? existing.messageId,
          nodeId: input.nodeId ?? existing.nodeId,
          updatedAt: now,
        },
      })
      return { row: toRow(raw), created: false }
    }
    const raw = await this.prisma.messageIdentityRecord.create({
      data: {
        id: newId(),
        identity: input.identity,
        conversationId: input.conversationId,
        providerId: input.providerId,
        accountId: input.accountId,
        role: input.role,
        contentHash: input.contentHash,
        providerMsgId: input.providerMsgId ?? null,
        sourcesJson: JSON.stringify(input.sources),
        messageId: input.messageId ?? null,
        nodeId: input.nodeId ?? null,
        createdAt: now,
        updatedAt: now,
      },
    })
    return { row: toRow(raw), created: true }
  }

  async mergeSources(
    identity: string,
    newSources: string[],
  ): Promise<{ changed: boolean; sources: string[] }> {
    const existing = await this.getByIdentity(identity)
    if (!existing) return { changed: false, sources: newSources }
    const prev: string[] = JSON.parse(existing.sourcesJson)
    const merged = Array.from(new Set([...prev, ...newSources]))
    const changed = merged.length !== prev.length
    if (changed) {
      await this.prisma.messageIdentityRecord.update({
        where: { identity },
        data: { sourcesJson: JSON.stringify(merged), updatedAt: Date.now() },
      })
    }
    return { changed, sources: merged }
  }

  async listByConversation(
    conversationId: string,
    limit = 200,
  ): Promise<MessageIdentityRow[]> {
    const raws = await this.prisma.messageIdentityRecord.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'asc' }],
      take: limit,
    })
    return raws.map(toRow)
  }
}
```

**`src/storage/impl/lifecycle-store-impl.ts`**

```ts
// src/storage/impl/lifecycle-store-impl.ts
import { newId } from '../../ids.js'
import type { EphemeralEntry, LifecycleStore } from '../contracts/lifecycle-store.js'

type PrismaLike = {
  traceEntry: {
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<{ count: number }>
  }
  semanticMemory: {
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<{ count: number }>
  }
  memoryRecord: {
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<{ count: number }>
  }
  parserExecutionLog: {
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>
    deleteMany(args: { where: { id: { in: string[] } } }): Promise<{ count: number }>
  }
  lifecycleSweepLog: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>
  }
}

export class LifecycleStoreImpl implements LifecycleStore {
  constructor(private prisma: PrismaLike) {}

  async scanTraces(cutoff: number, limit: number): Promise<EphemeralEntry[]> {
    const raws = await this.prisma.traceEntry.findMany({
      where: { ts: { lt: BigInt(cutoff) } },
      take: limit,
      orderBy: [{ ts: 'asc' }],
    })
    return raws.map((r) => ({
      id: String(r.id),
      ts: Number(r.ts),
      isPinned: false,
      isEternal: false,
    }))
  }

  async scanExpiredSemanticMemories(cutoff: number, limit: number): Promise<EphemeralEntry[]> {
    const raws = await this.prisma.semanticMemory.findMany({
      where: { expiresAt: { not: null, lt: BigInt(cutoff) } },
      take: limit,
    })
    return raws.map((r) => ({
      id: String(r.id),
      ts: r.expiresAt == null ? null : Number(r.expiresAt),
      isPinned: false,
      isEternal: false,
    }))
  }

  async scanExpiredMemoryRecords(now: number, limit: number): Promise<EphemeralEntry[]> {
    const raws = await this.prisma.memoryRecord.findMany({
      where: {
        expiresAt: { not: null, lt: BigInt(now) },
        isEternal: 0,
        isPinned: 0,
      },
      take: limit,
    })
    return raws.map((r) => ({
      id: String(r.id),
      ts: r.expiresAt == null ? null : Number(r.expiresAt),
      isPinned: Number(r.isPinned) === 1,
      isEternal: Number(r.isEternal) === 1,
    }))
  }

  async scanParserLogs(cutoff: number, limit: number): Promise<EphemeralEntry[]> {
    const raws = await this.prisma.parserExecutionLog.findMany({
      where: { createdAt: { lt: BigInt(cutoff) } },
      take: limit,
      orderBy: [{ createdAt: 'asc' }],
    })
    return raws.map((r) => ({
      id: String(r.id),
      ts: Number(r.createdAt),
      isPinned: false,
      isEternal: false,
    }))
  }

  async deleteTraces(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    return (await this.prisma.traceEntry.deleteMany({ where: { id: { in: ids } } })).count
  }
  async deleteSemanticMemories(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    return (await this.prisma.semanticMemory.deleteMany({ where: { id: { in: ids } } })).count
  }
  async deleteMemoryRecords(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    return (await this.prisma.memoryRecord.deleteMany({ where: { id: { in: ids } } })).count
  }
  async deleteParserLogs(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0
    return (await this.prisma.parserExecutionLog.deleteMany({ where: { id: { in: ids } } })).count
  }

  async logSweep(row: {
    tree: string
    mode: 'ttl' | 'cap'
    cutoffTs?: number | null
    maxEntries?: number | null
    deletedCount: number
    exemptedCount: number
    durationMs: number
  }): Promise<void> {
    await this.prisma.lifecycleSweepLog.create({
      data: {
        id: newId(),
        tree: row.tree,
        mode: row.mode,
        cutoffTs: row.cutoffTs == null ? null : BigInt(row.cutoffTs),
        maxEntries: row.maxEntries ?? null,
        deletedCount: row.deletedCount,
        exemptedCount: row.exemptedCount,
        durationMs: row.durationMs,
        ts: Date.now(),
      },
    })
  }
}
```

**`src/storage/impl/maintenance-store-impl.ts`**

```ts
// src/storage/impl/maintenance-store-impl.ts
// Raw PRAGMA / VACUUM live here. Engines call the contract, never raw SQL.
import { createHash } from 'node:crypto'
import { newId } from '../../ids.js'
import type {
  BackupRow,
  DbStats,
  MaintenanceStore,
} from '../contracts/maintenance-store.js'

type PrismaLike = {
  $queryRawUnsafe<T = unknown>(sql: string): Promise<T>
  $executeRawUnsafe(sql: string): Promise<number>
  maintenanceOpLog: { create(args: { data: Record<string, unknown> }): Promise<unknown> }
  backupRecord: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>
    findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>
    delete(args: { where: { backupPath: string } }): Promise<unknown>
  }
}

export class MaintenanceStoreImpl implements MaintenanceStore {
  constructor(
    private prisma: PrismaLike,
    private dbPath: string,
  ) {}

  getDbPath(): string {
    return this.dbPath
  }

  async checkpoint(): Promise<{ busy: number; log: number; checkpointed: number }> {
    // TRUNCATE flushes WAL into the main DB and resets the WAL file — required
    // before file-copy backup or VACUUM so no committed data is left in -wal.
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ busy: bigint; log: bigint; checkpointed: bigint }>
    >('PRAGMA wal_checkpoint(TRUNCATE);')
    const r = rows[0] ?? { busy: 0n, log: 0n, checkpointed: 0n }
    return { busy: Number(r.busy), log: Number(r.log), checkpointed: Number(r.checkpointed) }
  }

  async vacuum(): Promise<void> {
    // VACUUM cannot run inside a transaction; $executeRawUnsafe runs autocommit.
    await this.prisma.$executeRawUnsafe('VACUUM;')
  }

  async integrityCheck(): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ integrity_check: string }>>(
      'PRAGMA integrity_check;',
    )
    return rows[0]?.integrity_check === 'ok'
  }

  async getStats(): Promise<DbStats> {
    const [pc, ps, fl] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ page_count: bigint }>>('PRAGMA page_count;'),
      this.prisma.$queryRawUnsafe<Array<{ page_size: bigint }>>('PRAGMA page_size;'),
      this.prisma.$queryRawUnsafe<Array<{ freelist_count: bigint }>>('PRAGMA freelist_count;'),
    ])
    const pageCount = Number(pc[0]?.page_count ?? 0n)
    const pageSize = Number(ps[0]?.page_size ?? 4096n)
    const freelistCount = Number(fl[0]?.freelist_count ?? 0n)
    const fileBytes = pageCount * pageSize
    const reclaimableBytes = freelistCount * pageSize
    const liveBytes = fileBytes - reclaimableBytes
    return {
      fileBytes,
      pageSize,
      pageCount,
      freelistCount,
      liveBytes,
      reclaimableBytes,
      liveRatio: fileBytes > 0 ? liveBytes / fileBytes : 1,
    }
  }

  async logOp(row: {
    op: string
    ok: boolean
    beforeBytes?: number | null
    afterBytes?: number | null
    backupPath?: string | null
    durationMs: number
    error?: string | null
  }): Promise<void> {
    await this.prisma.maintenanceOpLog.create({
      data: {
        id: newId(),
        op: row.op,
        ok: row.ok ? 1 : 0,
        beforeBytes: row.beforeBytes == null ? null : BigInt(row.beforeBytes),
        afterBytes: row.afterBytes == null ? null : BigInt(row.afterBytes),
        backupPath: row.backupPath ?? null,
        durationMs: row.durationMs,
        error: row.error ?? null,
        ts: Date.now(),
      },
    })
  }

  async recordBackup(row: Omit<BackupRow, 'id'>): Promise<BackupRow> {
    const raw = await this.prisma.backupRecord.create({
      data: {
        id: newId(),
        dbPath: row.dbPath,
        backupPath: row.backupPath,
        version: row.version,
        sizeBytes: BigInt(row.sizeBytes),
        sha256: row.sha256,
        createdAt: row.createdAt,
      },
    })
    return {
      id: String(raw.id),
      dbPath: String(raw.dbPath),
      backupPath: String(raw.backupPath),
      version: String(raw.version),
      sizeBytes: Number(raw.sizeBytes),
      sha256: String(raw.sha256),
      createdAt: Number(raw.createdAt),
    }
  }

  async listBackups(dbPath: string): Promise<BackupRow[]> {
    const raws = await this.prisma.backupRecord.findMany({
      where: { dbPath },
      orderBy: [{ createdAt: 'desc' }],
    })
    return raws.map((r) => ({
      id: String(r.id),
      dbPath: String(r.dbPath),
      backupPath: String(r.backupPath),
      version: String(r.version),
      sizeBytes: Number(r.sizeBytes),
      sha256: String(r.sha256),
      createdAt: Number(r.createdAt),
    }))
  }

  async deleteBackup(backupPath: string): Promise<void> {
    await this.prisma.backupRecord.delete({ where: { backupPath } })
  }
}

export function sha256Hex(buf: Buffer | Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}
```

---

## 4. MEMORY ENGINES

**`src/engines/memory/types.ts`**

```ts
// src/engines/memory/types.ts
// Shared memory-domain types. Aligns with MemoryDataSchema (schema/node-data.ts)
// and the PRD Memory Engine Enhancement.

export type FsrsState = 'New' | 'Learning' | 'Review' | 'Relearning'

export type MemoryType =
  | 'Episodic'
  | 'Semantic'
  | 'Procedural'
  | 'Factual'
  | 'Preference'
  | 'Identity'
  | 'Relationship'
  | 'Goal'
  | 'Project'
  | 'Custom'

export type ConsolidationStatus =
  | 'unconsolidated'
  | 'consolidating'
  | 'consolidated'
  | 'eternal'
  | 'deprecated'

export const DEFAULT_CATEGORY_MAP: Record<MemoryType, string> = {
  Episodic: 'conversation_summary',
  Semantic: 'knowledge',
  Procedural: 'howto',
  Factual: 'biography',
  Preference: 'like',
  Identity: 'role',
  Relationship: 'person_info',
  Goal: 'goal',
  Project: 'project',
  Custom: 'custom',
}

// 4-tier hierarchy (Working / Episodic / Semantic / Eternal)
export type MemoryTier = 'working' | 'episodic' | 'semantic' | 'eternal'

/** Rating scale for FSRS-6 reviews. */
export type FsrsRating = 1 | 2 | 3 | 4 // Again | Hard | Good | Easy

export interface MemoryReviewInput {
  memoryId: string
  rating: FsrsRating
  now?: number
}

export interface ContextSnippet {
  memoryId: string
  memoryType: string
  category: string
  snippet: string
  tokens: number
  relevance: number
  isEternal: boolean
}

export interface ContextRetrievalResult {
  snippets: ContextSnippet[]
  totalTokens: number
}
```

**`src/engines/memory/fsrs-scheduler.ts`**

```ts
// src/engines/memory/fsrs-scheduler.ts
// FSRS-6 spaced repetition — pure functions, zero I/O. Formulas match
// ALGORITHMS_REFERENCE.md §1.1 exactly.
import type { FsrsRating, FsrsState } from './types.js'

const CONVERSION_FACTOR = -Math.log(0.9) / Math.log(2) // ≈ 9.49
const MIN_STABILITY = 0.5

const BASE_RATING: Record<FsrsRating, number> = { 4: 4.0, 3: 2.0, 2: 1.0, 1: 0.5 }
const RATING_DIFFICULTY: Record<FsrsRating, number> = { 4: 0.1, 3: 0.3, 2: 0.6, 1: 0.9 }
const DIFFICULTY_DELTA: Record<FsrsRating, number> = { 4: -0.08, 3: 0.0, 2: 0.08, 1: 0.2 }
const RATING_FACTOR: Record<FsrsRating, number> = { 4: 1.3, 3: 1.0, 2: 0.8, 1: 0.2 }
const RATING_SCALE: Record<FsrsRating, number> = { 4: 1.3, 3: 1.0, 2: 0.8, 1: 1.0 }
const LEARNING_STEP_DAYS: Record<FsrsRating, number> = { 4: 4.0, 3: 1.0, 2: 0.5, 1: 0.25 }

export interface FsrsMemoryState {
  stability: number
  difficulty: number
  dueDate: number
  lastReview: number | null
  reviewCount: number
  fsrsState: FsrsState
  importance: number
}

export class FsrsScheduler {
  static retrievability(stability: number, elapsedDays: number): number {
    if (stability <= 0) return 0
    return Math.pow(0.9, elapsedDays / stability)
  }

  static initialStability(rating: FsrsRating, importance: number): number {
    return BASE_RATING[rating] * (1 + importance)
  }

  static initialDifficulty(rating: FsrsRating): number {
    return Math.max(0, Math.min(1, RATING_DIFFICULTY[rating]))
  }

  static nextDifficulty(current: number, rating: FsrsRating): number {
    return Math.max(0.05, Math.min(0.95, current + DIFFICULTY_DELTA[rating]))
  }

  static nextStability(
    stability: number,
    difficulty: number,
    retrievability: number,
    rating: FsrsRating,
  ): number {
    const next = stability * Math.exp(0.9 * (1 - difficulty) * retrievability * RATING_FACTOR[rating])
    return Math.max(MIN_STABILITY, next)
  }

  static nextIntervalDays(stability: number, rating: FsrsRating): number {
    return Math.max(1.0, stability * CONVERSION_FACTOR * RATING_SCALE[rating])
  }

  /**
   * Apply a review rating and return the next scheduled state.
   * Pure — callers persist via MemoryStore.
   */
  static applyReview(mem: FsrsMemoryState, rating: FsrsRating, now = Date.now()): FsrsMemoryState {
    const reviewCount = mem.reviewCount + 1
    const lastReview = now
    const elapsedDays = mem.lastReview ? (now - mem.lastReview) / 86_400_000 : 0

    let stability: number
    let difficulty: number
    let fsrsState: FsrsState
    let intervalDays: number

    switch (mem.fsrsState) {
      case 'New':
      case 'Learning':
        stability = this.initialStability(rating, mem.importance)
        difficulty = this.initialDifficulty(rating)
        fsrsState = rating >= 3 ? 'Review' : 'Learning'
        intervalDays = LEARNING_STEP_DAYS[rating]
        break
      case 'Review': {
        const r = this.retrievability(mem.stability, elapsedDays)
        difficulty = this.nextDifficulty(mem.difficulty, rating)
        stability = this.nextStability(mem.stability, difficulty, r, rating)
        fsrsState = rating === 1 ? 'Relearning' : 'Review'
        intervalDays = this.nextIntervalDays(stability, rating)
        break
      }
      case 'Relearning':
        stability = Math.max(mem.stability * 0.5, MIN_STABILITY)
        difficulty = this.nextDifficulty(mem.difficulty, rating)
        fsrsState = rating >= 3 ? 'Review' : 'Relearning'
        intervalDays = rating >= 3 ? stability * 0.5 : 0.1
        break
    }

    return {
      stability,
      difficulty,
      fsrsState,
      reviewCount,
      lastReview,
      dueDate: now + intervalDays * 86_400_000,
      importance: mem.importance,
    }
  }
}
```

**`src/engines/memory/relevance-decay.ts`**

```ts
// src/engines/memory/relevance-decay.ts
// Relevance decay — 30-day half-life. Pure. ALGORITHMS_REFERENCE §1.2.

const HALF_LIFE_DAYS = 30
const MAX_ACCESS_BOOST = 0.2
const ACCESS_BOOST_FACTOR = 0.02

export class RelevanceDecay {
  /**
   * Eternal and pinned memories never decay (the "forever" guarantee).
   */
  static calculate(opts: {
    baseRelevance: number
    accessCount: number
    lastAccessedAt: number | null
    isPinned: boolean
    isEternal: boolean
    now?: number
  }): number {
    if (opts.isPinned || opts.isEternal) return 1.0
    let relevance = opts.baseRelevance
    relevance += Math.min(MAX_ACCESS_BOOST, opts.accessCount * ACCESS_BOOST_FACTOR)
    if (opts.lastAccessedAt != null) {
      const now = opts.now ?? Date.now()
      const days = Math.max(0, (now - opts.lastAccessedAt) / 86_400_000)
      const decayFactor = Math.pow(0.5, days / HALF_LIFE_DAYS)
      relevance *= 0.5 + 0.5 * decayFactor
    }
    return Math.max(0, Math.min(1, relevance))
  }

  static recordAccess(opts: { accessCount: number; now?: number }): {
    accessCount: number
    lastAccessedAt: number
  } {
    return { accessCount: opts.accessCount + 1, lastAccessedAt: opts.now ?? Date.now() }
  }
}
```

**`src/engines/memory/memory-hierarchy.ts`**

```ts
// src/engines/memory/memory-hierarchy.ts
// 4-tier Hierarchical Context-Aware Eternal Memory orchestrator.
//   Tier1 working  → ephemeral traces (TTL-swept)
//   Tier2 episodic → FSRS-managed, decays unless pinned
//   Tier3 semantic → consolidated facts, FSRS-reinforced
//   Tier4 eternal  → immune to decay + TTL, pre-compiled into identity bundles
// Engines depend on MemoryStore contract only.
import { EngineError } from '../../errors.js'
import { getLogger } from '../../lib/logger.js'
import type { MemoryStore, MemoryRecordRow } from '../../storage/contracts/memory-store.js'
import type { NodeStoreContract } from '../../storage/contracts/node-store.js'
import { createNode } from '../../schema/node.js'
import { FsrsScheduler } from './fsrs-scheduler.js'
import { RelevanceDecay } from './relevance-decay.js'
import {
  DEFAULT_CATEGORY_MAP,
  type ConsolidationStatus,
  type ContextRetrievalResult,
  type ContextSnippet,
  type FsrsRating,
  type MemoryTier,
  type MemoryType,
} from './types.js'

const log = getLogger('memory-hierarchy')

export interface MemoryHierarchyConfig {
  eternalImportanceThreshold: number // ≥ this AND high stability → eternal
  eternalStabilityThreshold: number
  defaultContextTokens: number
  minImportance: number
}

const DEFAULT_CONFIG: MemoryHierarchyConfig = {
  eternalImportanceThreshold: 0.8,
  eternalStabilityThreshold: 6.0,
  defaultContextTokens: 1200,
  minImportance: 0.4,
}

export class MemoryHierarchy {
  constructor(
    private memoryStore: MemoryStore,
    private nodeStore: NodeStoreContract | null,
    private config: MemoryHierarchyConfig = DEFAULT_CONFIG,
  ) {}

  // ── Tier classification ─────────────────────────────────────────────────
  classifyTier(memoryType: MemoryType, status: ConsolidationStatus, isEternal: boolean): MemoryTier {
    if (isEternal || status === 'eternal') return 'eternal'
    if (memoryType === 'Episodic') return 'episodic'
    if (status === 'consolidated' || memoryType === 'Semantic' || memoryType === 'Factual') {
      return 'semantic'
    }
    return 'working'
  }

  // ── Record: capture → persist spine + durable Node ─────────────────────
  async record(input: {
    content: string
    summary?: string
    memoryType: MemoryType
    category?: string
    importance?: number
    tags?: string[]
    agentId?: string
    sourceConversationIds?: string[]
    isEternal?: boolean
  }): Promise<MemoryRecordRow> {
    const category = input.category ?? DEFAULT_CATEGORY_MAP[input.memoryType]
    // Persist the durable artifact in the universal Node layer when available.
    let nodeId: string | null = null
    if (this.nodeStore) {
      try {
        const node = createNode('cap-store.memory', {
          content: input.content,
          summary: input.summary,
          memoryType: input.memoryType,
          category,
          tags: input.tags ?? [],
          importance: input.importance ?? 0.5,
          relevance: input.importance ?? 0.5,
          sourceConversationIds: input.sourceConversationIds ?? [],
          sourceMessageIds: [],
          isPinned: false,
          isArchived: false,
          consolidationStatus: input.isEternal ? 'eternal' : 'unconsolidated',
          accessCount: 0,
          stability: 1.0,
          difficulty: 0.3,
          dueDate: Date.now(),
          reviewCount: 0,
          fsrsState: 'New',
        })
        await this.nodeStore.putNode(node)
        nodeId = node.id
      } catch (e) {
        // Node capture is best-effort; the relational spine still persists.
        log.warn({ err: String(e) }, 'memory-hierarchy: node capture failed')
      }
    }
    return this.memoryStore.create({
      agentId: input.agentId ?? 'system',
      nodeId,
      memoryType: input.memoryType,
      category,
      content: input.content,
      summary: input.summary,
      tags: input.tags,
      importance: input.importance,
      sourceConversationIds: input.sourceConversationIds,
    })
  }

  // ── FSRS-6 review ──────────────────────────────────────────────────────
  async applyReview(memoryId: string, rating: FsrsRating, now = Date.now()): Promise<MemoryRecordRow> {
    const mem = await this.memoryStore.get(memoryId)
    if (!mem) throw new EngineError(`Memory not found: ${memoryId}`)
    const next = FsrsScheduler.applyReview(
      {
        stability: mem.stability,
        difficulty: mem.difficulty,
        dueDate: mem.dueDate,
        lastReview: mem.lastReview,
        reviewCount: mem.reviewCount,
        fsrsState: mem.fsrsState as never,
        importance: mem.importance,
      },
      rating,
      now,
    )
    return this.memoryStore.update(memoryId, {
      stability: next.stability,
      difficulty: next.difficulty,
      dueDate: next.dueDate,
      lastReview: next.lastReview,
      reviewCount: next.reviewCount,
      fsrsState: next.fsrsState,
    })
  }

  async collectDue(agentId: string, limit = 50, now = Date.now()): Promise<MemoryRecordRow[]> {
    return this.memoryStore.collectDue(agentId, now, limit)
  }

  // ── Eternal graduation ─────────────────────────────────────────────────
  /**
   * Promote a memory to the Eternal tier. Eternal memories are immune to
   * relevance decay and TTL sweep, and are candidates for identity bundles.
   */
  async promoteToEternal(memoryId: string): Promise<MemoryRecordRow> {
    const mem = await this.memoryStore.get(memoryId)
    if (!mem) throw new EngineError(`Memory not found: ${memoryId}`)
    return this.memoryStore.update(memoryId, {
      isEternal: true,
      consolidationStatus: 'eternal',
      relevance: 1.0,
    })
  }

  /**
   * Auto-scan consolidated memories and graduate those crossing the
   * importance+stability threshold to Eternal.
   */
  async autoGraduateEternal(agentId: string): Promise<number> {
    const candidates = await this.memoryStore.query({
      agentId,
      consolidationStatus: 'consolidated',
      isEternal: false,
      minImportance: this.config.eternalImportanceThreshold,
      limit: 500,
    })
    let promoted = 0
    for (const c of candidates) {
      if (c.stability >= this.config.eternalStabilityThreshold) {
        await this.promoteToEternal(c.id)
        promoted++
      }
    }
    if (promoted > 0) log.info({ agentId, promoted }, 'memory-hierarchy: eternal graduation')
    return promoted
  }

  // ── Relevance refresh ──────────────────────────────────────────────────
  async refreshRelevance(agentId: string, now = Date.now()): Promise<number> {
    const memories = await this.memoryStore.query({ agentId, limit: 2000 })
    let updated = 0
    for (const m of memories) {
      const relevance = RelevanceDecay.calculate({
        baseRelevance: m.importance,
        accessCount: m.accessCount,
        lastAccessedAt: m.lastAccessedAt,
        isPinned: m.isPinned,
        isEternal: m.isEternal,
        now,
      })
      if (Math.abs(relevance - m.relevance) > 0.001) {
        await this.memoryStore.update(m.id, { relevance })
        updated++
      }
    }
    return updated
  }

  async recordAccess(memoryId: string, now = Date.now()): Promise<void> {
    const mem = await this.memoryStore.get(memoryId)
    if (!mem) return
    const next = RelevanceDecay.recordAccess({ accessCount: mem.accessCount, now })
    await this.memoryStore.update(memoryId, {
      accessCount: next.accessCount,
      lastAccessedAt: next.lastAccessedAt,
    })
  }

  // ── Context-aware retrieval (token-bounded, eternal-first) ─────────────
  async retrieveForContext(
    agentId: string,
    maxTokens = this.config.defaultContextTokens,
    minImportance = this.config.minImportance,
  ): Promise<ContextRetrievalResult> {
    const memories = await this.memoryStore.query({
      agentId,
      isArchived: false,
      minImportance,
      limit: 1000,
    })
    // Eternal + pinned float to the top; then relevance desc.
    const sorted = [...memories].sort((a, b) => {
      const aKey = a.isEternal || a.isPinned ? 1 : 0
      const bKey = b.isEternal || b.isPinned ? 1 : 0
      if (aKey !== bKey) return bKey - aKey
      return b.relevance - a.relevance
    })
    const snippets: ContextSnippet[] = []
    let totalTokens = 0
    for (const m of sorted) {
      const snippet = m.summary || m.content
      const tokens = Math.ceil(snippet.length / 4)
      if (totalTokens + tokens > maxTokens) break
      snippets.push({
        memoryId: m.id,
        memoryType: m.memoryType,
        category: m.category,
        snippet,
        tokens,
        relevance: m.relevance,
        isEternal: m.isEternal,
      })
      totalTokens += tokens
    }
    return { snippets, totalTokens }
  }
}
```

**`src/engines/memory/consolidation-pipeline.ts`**

```ts
// src/engines/memory/consolidation-pipeline.ts
// Background consolidation: episodic → semantic extraction hook, eternal
// graduation, deprecated pruning. Wired into a scheduled job / automation.
import { getLogger } from '../../lib/logger.js'
import type { MemoryStore } from '../../storage/contracts/memory-store.js'
import { MemoryHierarchy } from './memory-hierarchy.js'

const log = getLogger('consolidation-pipeline')

export interface ConsolidationReport {
  scanned: number
  consolidated: number
  eternalized: number
  deprecated: number
  durationMs: number
}

/**
 * Extraction hook — plug in a local LLM (Ollama/LM Studio) or heuristics to
 * derive Semantic facts from Episodic memories. Default is a pass-through
 * heuristic so the pipeline runs with zero external deps.
 */
export type SemanticExtractor = (episodicContent: string) => Promise<
  Array<{ content: string; category?: string; importance?: number }>
>

const defaultExtractor: SemanticExtractor = async (content) => {
  // Heuristic: sentences containing "prefer|always|never|decided|use" become facts.
  const facts = content
    .split(/[.\n]/)
    .map((s) => s.trim())
    .filter((s) => /\b(prefer|always|never|decided|uses?|chose)\b/i.test(s) && s.length > 8)
  return facts.map((f) => ({ content: f, category: 'knowledge', importance: 0.7 }))
}

export class ConsolidationPipeline {
  constructor(
    private hierarchy: MemoryHierarchy,
    private memoryStore: MemoryStore,
    private extractor: SemanticExtractor = defaultExtractor,
  ) {}

  async run(agentId: string): Promise<ConsolidationReport> {
    const start = Date.now()
    let scanned = 0
    let consolidated = 0

    // 1) Consolidate unconsolidated episodic memories into semantic facts.
    const episodic = await this.memoryStore.query({
      agentId,
      memoryType: 'Episodic',
      consolidationStatus: 'unconsolidated',
      limit: 200,
    })
    for (const ep of episodic) {
      scanned++
      await this.memoryStore.update(ep.id, { consolidationStatus: 'consolidating' })
      try {
        const facts = await this.extractor(ep.content)
        for (const fact of facts) {
          await this.hierarchy.record({
            content: fact.content,
            memoryType: 'Semantic',
            category: fact.category,
            importance: fact.importance ?? 0.6,
            agentId,
            sourceConversationIds: JSON.parse(ep.sourceConversationIdsJson),
          })
        }
        await this.memoryStore.update(ep.id, { consolidationStatus: 'consolidated' })
        consolidated++
      } catch (e) {
        log.warn({ err: String(e), memoryId: ep.id }, 'consolidation: extraction failed')
        await this.memoryStore.update(ep.id, { consolidationStatus: 'unconsolidated' })
      }
    }

    // 2) Graduate high-value consolidated memories to Eternal.
    const eternalized = await this.hierarchy.autoGraduateEternal(agentId)

    // 3) Mark stale low-relevance archived memories deprecated (TTL-sweepable).
    const stale = await this.memoryStore.query({
      agentId,
      isArchived: true,
      isEternal: false,
      limit: 500,
    })
    let deprecated = 0
    const cutoff = Date.now() - 90 * 86_400_000
    for (const m of stale) {
      if (m.relevance < 0.1 && m.updatedAt < cutoff) {
        await this.memoryStore.update(m.id, { consolidationStatus: 'deprecated' })
        deprecated++
      }
    }

    const durationMs = Date.now() - start
    log.info({ agentId, scanned, consolidated, eternalized, deprecated }, 'consolidation complete')
    return { scanned, consolidated, eternalized, deprecated, durationMs }
  }
}
```

---

## 5. STORAGE ENGINES

**`src/engines/storage/message-identity.ts`**

```ts
// src/engines/storage/message-identity.ts
// SHA256 cross-provider message identity. ALGORITHMS_REFERENCE §3.1.
// identity = SHA256(provider \0 account \0 conv_id \0 [ id\0 msgId | rc\0 role \0 content ])
import { createHash } from 'node:crypto'

export interface MessageIdentityInput {
  provider: string
  account: string
  convId: string
  role: string
  content: string
  providerMsgId?: string | null
}

const SEP = '\0'
const ID_PREFIX = 'id\0'
const RC_PREFIX = 'rc\0'

export class MessageIdentity {
  static generate(input: MessageIdentityInput): string {
    const h = createHash('sha256')
    h.update(input.provider)
    h.update(SEP)
    h.update(input.account)
    h.update(SEP)
    h.update(input.convId)
    h.update(SEP)
    if (input.providerMsgId && input.providerMsgId.length > 0) {
      h.update(ID_PREFIX)
      h.update(input.providerMsgId)
    } else {
      h.update(RC_PREFIX)
      h.update(input.role)
      h.update(SEP)
      h.update(input.content)
    }
    return h.digest('hex')
  }

  /** Content-only hash for Node.contentHash / dedup secondary index. */
  static contentHash(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex')
  }
}
```

**`src/engines/storage/dedup-manager.ts`**

```ts
// src/engines/storage/dedup-manager.ts
// Upsert with source merging across providers. Returns Inserted/Merged/Unchanged.
import type { DedupStore } from '../../storage/contracts/dedup-store.js'
import { MessageIdentity, type MessageIdentityInput } from './message-identity.js'

export enum UpsertOutcome {
  Inserted = 'Inserted',
  Merged = 'Merged',
  Unchanged = 'Unchanged',
}

export interface DedupUpsertResult {
  outcome: UpsertOutcome
  identity: string
  messageId: string | null
  sources: string[]
}

export class DedupManager {
  constructor(private store: DedupStore) {}

  async upsertMessage(
    input: MessageIdentityInput,
    sources: string[],
    refs?: { messageId?: string | null; nodeId?: string | null },
  ): Promise<DedupUpsertResult> {
    const identity = MessageIdentity.generate(input)
    const existing = await this.store.getByIdentity(identity)

    if (!existing) {
      const { row } = await this.store.upsert({
        identity,
        conversationId: input.convId,
        providerId: input.provider,
        accountId: input.account,
        role: input.role,
        contentHash: MessageIdentity.contentHash(input.content),
        providerMsgId: input.providerMsgId ?? null,
        sources,
        messageId: refs?.messageId ?? null,
        nodeId: refs?.nodeId ?? null,
      })
      return { outcome: UpsertOutcome.Inserted, identity, messageId: row.messageId, sources }
    }

    const { changed, sources: merged } = await this.store.mergeSources(identity, sources)
    return {
      outcome: changed ? UpsertOutcome.Merged : UpsertOutcome.Unchanged,
      identity,
      messageId: existing.messageId,
      sources: merged,
    }
  }

  async exists(convId: string, identity: string): Promise<boolean> {
    return this.store.exists(convId, identity)
  }
}
```

**`src/engines/storage/ttl-sweeper.ts`**

```ts
// src/engines/storage/ttl-sweeper.ts
// TTL + cap-based ephemeral sweep. Eternal/pinned entries are ALWAYS exempt.
import { getLogger } from '../../lib/logger.js'
import type { LifecycleStore, EphemeralEntry } from '../../storage/contracts/lifecycle-store.js'

const log = getLogger('ttl-sweeper')

export const DEFAULT_TTL_CONFIG = {
  tracesTtlHours: 48,
  sessionsTtlHours: 6,
  syncHistoryTtlDays: 30,
  parserLogsTtlDays: 7,
  memoryEphemeralGraceDays: 30,
}

export interface SweepReport {
  traces: number
  semanticExpired: number
  memoryExpired: number
  parserLogs: number
  exempted: number
  durationMs: number
}

const HOUR = 3_600_000
const DAY = 86_400_000

export class TtlSweeper {
  constructor(
    private store: LifecycleStore,
    private config = DEFAULT_TTL_CONFIG,
    private scanLimit = 100_000,
  ) {}

  private partitionExempt(entries: EphemeralEntry[]): {
    deletable: string[]
    exempted: number
  } {
    const deletable: string[] = []
    let exempted = 0
    for (const e of entries) {
      if (e.isPinned || e.isEternal) {
        exempted++
      } else {
        deletable.push(e.id)
      }
    }
    return { deletable, exempted }
  }

  async sweepEphemeral(now = Date.now()): Promise<SweepReport> {
    const start = Date.now()
    let exempted = 0

    // Traces (48h)
    const traces = await this.store.scanTraces(now - this.config.tracesTtlHours * HOUR, this.scanLimit)
    const tracesDel = await this.store.deleteTraces(traces.map((t) => t.id))
    await this.store.logSweep({
      tree: 'traces', mode: 'ttl', cutoffTs: now - this.config.tracesTtlHours * HOUR,
      deletedCount: tracesDel, exemptedCount: 0, durationMs: Date.now() - start,
    })

    // Expired semantic memories (expiresAt passed)
    const sem = await this.store.scanExpiredSemanticMemories(now, this.scanLimit)
    const semDel = await this.store.deleteSemanticMemories(sem.map((s) => s.id))

    // Expired non-eternal memory records (TTL grace)
    const mem = await this.store.scanExpiredMemoryRecords(now, this.scanLimit)
    const memPart = this.partitionExempt(mem)
    exempted += memPart.exempted
    const memDel = await this.store.deleteMemoryRecords(memPart.deletable)

    // Parser execution logs (7d diagnostic retention)
    const plogs = await this.store.scanParserLogs(now - this.config.parserLogsTtlDays * DAY, this.scanLimit)
    const plogDel = await this.store.deleteParserLogs(plogs.map((p) => p.id))

    const durationMs = Date.now() - start
    log.info(
      { tracesDel, semDel, memDel, plogDel, exempted, durationMs },
      'ttl-sweeper: sweep complete',
    )
    return {
      traces: tracesDel,
      semanticExpired: semDel,
      memoryExpired: memDel,
      parserLogs: plogDel,
      exempted,
      durationMs,
    }
  }
}
```

**`src/engines/storage/compaction-manager.ts`**

```ts
// src/engines/storage/compaction-manager.ts
// SQLite compaction via WAL checkpoint + VACUUM (relational store). Bloat is
// measured with page_count/freelist_count — no full-table scans needed.
import { getLogger } from '../../lib/logger.js'
import { EngineError } from '../../errors.js'
import type { MaintenanceStore, DbStats } from '../../storage/contracts/maintenance-store.js'

const log = getLogger('compaction-manager')

export interface CompactionResult {
  beforeBytes: number
  afterBytes: number
  reclaimedBytes: number
  liveRatioBefore: number
  liveRatioAfter: number
  durationMs: number
}

export class CompactionManager {
  constructor(private store: MaintenanceStore) {}

  async stats(): Promise<DbStats> {
    return this.store.getStats()
  }

  /**
   * Compact only when reclaimable space justifies it. Threshold guards against
   * VACUUM churn on a healthy DB.
   */
  async maybeCompact(opts: { minReclaimableBytes?: number; minReclaimRatio?: number } = {}): Promise<
    CompactionResult | null
  > {
    const minBytes = opts.minReclaimableBytes ?? 10 * 1024 * 1024 // 10 MB
    const minRatio = opts.minReclaimRatio ?? 0.15 // ≥15% bloat
    const before = await this.store.getStats()
    if (before.reclaimableBytes < minBytes || before.reclaimableBytes / before.fileBytes < minRatio) {
      return null
    }
    return this.compact()
  }

  async compact(): Promise<CompactionResult> {
    const start = Date.now()
    const before = await this.store.getStats()
    try {
      // Flush WAL so VACUUM sees all committed data.
      await this.store.checkpoint()
      await this.store.vacuum()
      const ok = await this.store.integrityCheck()
      if (!ok) throw new EngineError('Compaction failed integrity_check')
      const after = await this.store.getStats()
      const result: CompactionResult = {
        beforeBytes: before.fileBytes,
        afterBytes: after.fileBytes,
        reclaimedBytes: Math.max(0, before.fileBytes - after.fileBytes),
        liveRatioBefore: before.liveRatio,
        liveRatioAfter: after.liveRatio,
        durationMs: Date.now() - start,
      }
      await this.store.logOp({
        op: 'compact', ok: true,
        beforeBytes: before.fileBytes, afterBytes: after.fileBytes,
        durationMs: result.durationMs,
      })
      log.info({ reclaimedBytes: result.reclaimedBytes }, 'compaction complete')
      return result
    } catch (e) {
      await this.store.logOp({
        op: 'compact', ok: false, durationMs: Date.now() - start, error: String(e),
      })
      throw e
    }
  }
}
```

**`src/engines/storage/backup-manager.ts`**

```ts
// src/engines/storage/backup-manager.ts
// Pre-migration / pre-compaction backups. WAL is checkpointed (TRUNCATE) before
// copying so the copied file contains all committed data. Keeps last N backups.
// NOTE: For a hot DB under active writes, prefer the SQLite Online Backup API
// (better-sqlite3 `.backup()`); checkpoint+copy is safe for a quiescent/local app.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getLogger } from '../../lib/logger.js'
import { EngineError } from '../../errors.js'
import type { MaintenanceStore } from '../../storage/contracts/maintenance-store.js'
import { sha256Hex } from '../../storage/impl/maintenance-store-impl.js'

const log = getLogger('backup-manager')

export interface BackupResult {
  backupPath: string
  sizeBytes: number
  sha256: string
  pruned: number
}

export class BackupManager {
  constructor(
    private store: MaintenanceStore,
    private keep = 5,
  ) {}

  async createBackup(version: string, now = Date.now()): Promise<BackupResult> {
    const dbPath = this.store.getDbPath()
    await fs.access(dbPath).catch(() => {
      throw new EngineError(`No database at ${dbPath}`)
    })
    // Ensure all committed data is in the main file before copying.
    await this.store.checkpoint()

    const stamp = new Date(now).toISOString().replace(/[:.]/g, '-')
    const backupPath = `${dbPath}.backup.v${version}.${stamp}`
    await fs.copyFile(dbPath, backupPath)

    const buf = await fs.readFile(backupPath)
    const sizeBytes = buf.length
    const sha = sha256Hex(buf)
    await this.store.recordBackup({
      dbPath, backupPath, version, sizeBytes, sha256: sha, createdAt: now,
    })
    await this.store.logOp({
      op: 'backup', ok: true, backupPath, beforeBytes: sizeBytes, durationMs: 0,
    })

    const pruned = await this.pruneOldBackups(dbPath)
    log.info({ backupPath, sizeBytes, pruned }, 'backup created')
    return { backupPath, sizeBytes, sha256: sha, pruned }
  }

  private async pruneOldBackups(dbPath: string): Promise<number> {
    const backups = await this.store.listBackups(dbPath)
    let pruned = 0
    // listBackups returns newest-first
    for (const b of backups.slice(this.keep)) {
      try {
        await fs.unlink(b.backupPath)
      } catch {
        /* already gone */
      }
      await this.store.deleteBackup(b.backupPath)
      pruned++
    }
    return pruned
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    const dbPath = this.store.getDbPath()
    await fs.access(backupPath).catch(() => {
      throw new EngineError(`Backup not found: ${backupPath}`)
    })
    // Verify backup integrity via checksum before overwriting live DB.
    const backups = await this.store.listBackups(dbPath)
    const record = backups.find((b) => b.backupPath === backupPath)
    const buf = await fs.readFile(backupPath)
    if (record && sha256Hex(buf) !== record.sha256) {
      throw new EngineError('Backup checksum mismatch — refusing to restore')
    }
    await fs.copyFile(backupPath, dbPath)
    await this.store.logOp({ op: 'restore', ok: true, backupPath, durationMs: 0 })
    log.info({ backupPath }, 'restored from backup')
  }

  /**
   * Run an arbitrary migration/compaction with automatic backup + rollback.
   */
  async withBackup<T>(version: string, fn: () => Promise<T>): Promise<T> {
    const backup = await this.createBackup(version)
    try {
      return await fn()
    } catch (e) {
      log.warn({ err: String(e) }, 'operation failed, restoring backup')
      await this.restoreFromBackup(backup.backupPath)
      throw e
    }
  }
}
```

---

## 6. SERVER WIRING

**`src/server/maintenance-wiring.ts`**

```ts
// src/server/maintenance-wiring.ts
// Composition root for the storage-hardening engines. Call from your bootstrap
// (capability-bootstrap.ts) after the Prisma client is ready. Feature-flagged.
import { config, getDataDir, getDbPath } from '../config.js'
import { getLogger } from '../lib/logger.js'
import { MemoryStoreImpl } from '../storage/impl/memory-store-impl.js'
import { DedupStoreImpl } from '../storage/impl/dedup-store-impl.js'
import { LifecycleStoreImpl } from '../storage/impl/lifecycle-store-impl.js'
import { MaintenanceStoreImpl } from '../storage/impl/maintenance-store-impl.js'
import { MemoryHierarchy } from '../engines/memory/memory-hierarchy.js'
import { ConsolidationPipeline } from '../engines/memory/consolidation-pipeline.js'
import { DedupManager } from '../engines/storage/dedup-manager.js'
import { TtlSweeper } from '../engines/storage/ttl-sweeper.js'
import { CompactionManager } from '../engines/storage/compaction-manager.js'
import { BackupManager } from '../engines/storage/backup-manager.js'

const log = getLogger('maintenance-wiring')

const FEATURES = {
  dedup: process.env.FEATURE_DEDUPLICATION === 'true',
  ttl: process.env.FEATURE_TTL_SWEEP === 'true',
  compaction: process.env.FEATURE_COMPACTION === 'true',
  backup: process.env.FEATURE_MIGRATION_BACKUP === 'true',
  hierarchy: process.env.FEATURE_MEMORY_HIERARCHY === 'true',
}

export interface MaintenanceBundle {
  memoryHierarchy: MemoryHierarchy
  consolidation: ConsolidationPipeline
  dedup: DedupManager
  ttlSweeper: TtlSweeper
  compaction: CompactionManager
  backup: BackupManager
  runDailyMaintenance(): Promise<void>
}

// `prisma` is your live PrismaClient; `nodeStore` is optional (NodeStoreContract).
export function wireMaintenance(
  prisma: unknown,
  nodeStore: import('../storage/contracts/node-store.js').NodeStoreContract | null,
): MaintenanceBundle {
  const p = prisma as never
  const memoryStore = new MemoryStoreImpl(p)
  const dedupStore = new DedupStoreImpl(p)
  const lifecycleStore = new LifecycleStoreImpl(p)
  const maintenanceStore = new MaintenanceStoreImpl(p, getDbPath())

  const memoryHierarchy = new MemoryHierarchy(memoryStore, nodeStore)
  const consolidation = new ConsolidationPipeline(memoryHierarchy, memoryStore)
  const dedup = new DedupManager(dedupStore)
  const ttlSweeper = new TtlSweeper(lifecycleStore)
  const compaction = new CompactionManager(maintenanceStore)
  const backup = new BackupManager(maintenanceStore, 5)

  async function runDailyMaintenance(): Promise<void> {
    const version = 'daily'
    try {
      if (FEATURES.backup) await backup.createBackup(version)
      if (FEATURES.ttl) await ttlSweeper.sweepEphemeral()
      if (FEATURES.hierarchy) {
        await memoryHierarchy.refreshRelevance('system')
        await consolidation.run('system')
      }
      if (FEATURES.compaction) await compaction.maybeCompact()
      log.info('daily maintenance complete')
    } catch (e) {
      log.error({ err: String(e) }, 'daily maintenance failed')
    }
  }

  log.info({ features: FEATURES, dataDir: getDataDir() }, 'maintenance wired')
  return { memoryHierarchy, consolidation, dedup, ttlSweeper, compaction, backup, runDailyMaintenance }
}
```

**PRAGMA startup config** — add to your server boot (before first query) for the memory workload:

```ts
// one-time at boot (via MaintenanceStore or a raw bootstrap hook)
await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;')
await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL;')
await prisma.$executeRawUnsafe('PRAGMA cache_size = -20000;') // 20MB
await prisma.$executeRawUnsafe('PRAGMA temp_store = MEMORY;')
await prisma.$executeRawUnsafe('PRAGMA mmap_size = 268435456;') // 256MB
```

---

## 7. OPS SCRIPTS

**`scripts/backup-db.ts`**

```ts
// scripts/backup-db.ts — bun run scripts/backup-db.ts [version]
import { getDbPath } from '../src/config.js'
import { MaintenanceStoreImpl } from '../src/storage/impl/maintenance-store-impl.js'
import { BackupManager } from '../src/engines/storage/backup-manager.js'
import { getPrisma } from '../src/storage/db.js' // your existing Prisma accessor

const version = process.argv[2] ?? 'manual'
const prisma = getPrisma() as never
const store = new MaintenanceStoreImpl(prisma, getDbPath())
const backup = new BackupManager(store, 5)
const result = await backup.createBackup(version)
console.log(JSON.stringify(result, null, 2))
process.exit(0)
```

**`scripts/restore-db.ts`**

```ts
// scripts/restore-db.ts — bun run scripts/restore-db.ts <backupPath>
import { getDbPath } from '../src/config.js'
import { MaintenanceStoreImpl } from '../src/storage/impl/maintenance-store-impl.js'
import { BackupManager } from '../src/engines/storage/backup-manager.js'
import { getPrisma } from '../src/storage/db.js'

const backupPath = process.argv[2]
if (!backupPath) {
  console.error('usage: bun run scripts/restore-db.ts <backupPath>')
  process.exit(1)
}
const prisma = getPrisma() as never
const store = new MaintenanceStoreImpl(prisma, getDbPath())
const backup = new BackupManager(store)
await backup.restoreFromBackup(backupPath)
console.log('restored:', backupPath)
process.exit(0)
```

**`scripts/compact-db.ts`**

```ts
// scripts/compact-db.ts — bun run scripts/compact-db.ts [--force]
import { getDbPath } from '../src/config.js'
import { MaintenanceStoreImpl } from '../src/storage/impl/maintenance-store-impl.js'
import { CompactionManager } from '../src/engines/storage/compaction-manager.js'
import { getPrisma } from '../src/storage/db.js'

const force = process.argv.includes('--force')
const prisma = getPrisma() as never
const store = new MaintenanceStoreImpl(prisma, getDbPath())
const compaction = new CompactionManager(store)

const before = await compaction.stats()
console.log('before:', JSON.stringify(before, null, 2))
const result = force ? await compaction.compact() : await compaction.maybeCompact()
if (result) console.log('compacted:', JSON.stringify(result, null, 2))
else console.log('compaction skipped (below threshold)')
process.exit(0)
```

**`scripts/sweep-ephemeral.ts`**

```ts
// scripts/sweep-ephemeral.ts — bun run scripts/sweep-ephemeral.ts
import { LifecycleStoreImpl } from '../src/storage/impl/lifecycle-store-impl.js'
import { TtlSweeper } from '../src/engines/storage/ttl-sweeper.js'
import { getPrisma } from '../src/storage/db.js'

const prisma = getPrisma() as never
const store = new LifecycleStoreImpl(prisma)
const sweeper = new TtlSweeper(store)
const report = await sweeper.sweepEphemeral()
console.log(JSON.stringify(report, null, 2))
process.exit(0)
```

---

## 8. UNIT TESTS

**`tests/unit/engines/fsrs-scheduler.test.ts`**

```ts
import { describe, expect, test } from 'bun:test'
import { FsrsScheduler, type FsrsMemoryState } from '../../../src/engines/memory/fsrs-scheduler.js'

function mem(overrides: Partial<FsrsMemoryState> = {}): FsrsMemoryState {
  return {
    stability: 2.0,
    difficulty: 0.3,
    dueDate: Date.now(),
    lastReview: Date.now() - 2 * 86_400_000,
    reviewCount: 1,
    fsrsState: 'Review',
    importance: 0.5,
    ...overrides,
  }
}

describe('FsrsScheduler', () => {
  test('retrievability at one stability = 0.9', () => {
    expect(FsrsScheduler.retrievability(10, 10)).toBeCloseTo(0.9, 2)
  })
  test('retrievability decays past stability', () => {
    expect(FsrsScheduler.retrievability(10, 20)).toBeCloseTo(0.81, 2)
  })
  test('initial stability boosted by importance', () => {
    expect(FsrsScheduler.initialStability(4, 0.5)).toBeCloseTo(6.0, 2)
    expect(FsrsScheduler.initialStability(4, 1.0)).toBeCloseTo(8.0, 2)
  })
  test('difficulty clamps to [0.05, 0.95]', () => {
    expect(FsrsScheduler.nextDifficulty(0.9, 4)).toBeCloseTo(0.82, 2)
    expect(FsrsScheduler.nextDifficulty(0.05, 1)).toBeCloseTo(0.25, 2)
  })
  test('New→Review on Good rating', () => {
    const next = FsrsScheduler.applyReview(mem({ fsrsState: 'New' }), 3)
    expect(next.fsrsState).toBe('Review')
    expect(next.stability).toBeGreaterThan(0)
    expect(next.dueDate).toBeGreaterThan(Date.now())
  })
  test('Review→Relearning on Again rating', () => {
    const next = FsrsScheduler.applyReview(mem({ fsrsState: 'Review' }), 1)
    expect(next.fsrsState).toBe('Relearning')
  })
  test('stability never below minimum', () => {
    const next = FsrsScheduler.applyReview(mem({ fsrsState: 'Relearning', stability: 0.1 }), 1)
    expect(next.stability).toBeGreaterThanOrEqual(0.5)
  })
  test('Easy grows stability more than Hard', () => {
    const easy = FsrsScheduler.applyReview(mem(), 4)
    const hard = FsrsScheduler.applyReview(mem(), 2)
    expect(easy.stability).toBeGreaterThan(hard.stability)
  })
})
```

**`tests/unit/engines/relevance-decay.test.ts`**

```ts
import { describe, expect, test } from 'bun:test'
import { RelevanceDecay } from '../../../src/engines/memory/relevance-decay.js'

const DAY = 86_400_000
const now = Date.now()

describe('RelevanceDecay', () => {
  test('eternal never decays', () => {
    const r = RelevanceDecay.calculate({
      baseRelevance: 0.5, accessCount: 0, lastAccessedAt: now - 365 * DAY,
      isPinned: false, isEternal: true, now,
    })
    expect(r).toBe(1.0)
  })
  test('pinned never decays', () => {
    const r = RelevanceDecay.calculate({
      baseRelevance: 0.3, accessCount: 0, lastAccessedAt: now - 100 * DAY,
      isPinned: true, isEternal: false, now,
    })
    expect(r).toBe(1.0)
  })
  test('access boost caps at 0.2', () => {
    const r5 = RelevanceDecay.calculate({
      baseRelevance: 0.5, accessCount: 5, lastAccessedAt: null, isPinned: false, isEternal: false, now,
    })
    const r50 = RelevanceDecay.calculate({
      baseRelevance: 0.5, accessCount: 50, lastAccessedAt: null, isPinned: false, isEternal: false, now,
    })
    expect(r5).toBeCloseTo(0.6, 2)
    expect(r50).toBeCloseTo(0.7, 2)
  })
  test('30-day half-life halves the decay component', () => {
    const r = RelevanceDecay.calculate({
      baseRelevance: 0.5, accessCount: 0, lastAccessedAt: now - 30 * DAY,
      isPinned: false, isEternal: false, now,
    })
    // decayFactor=0.5 → 0.5 * (0.5 + 0.5*0.5) = 0.375
    expect(r).toBeCloseTo(0.375, 2)
  })
  test('clamps to [0,1]', () => {
    const r = RelevanceDecay.calculate({
      baseRelevance: 0.99, accessCount: 100, lastAccessedAt: now, isPinned: false, isEternal: false, now,
    })
    expect(r).toBeLessThanOrEqual(1)
  })
})
```

**`tests/unit/engines/message-identity.test.ts`**

```ts
import { describe, expect, test } from 'bun:test'
import { MessageIdentity } from '../../../src/engines/storage/message-identity.js'

const base = {
  provider: 'chatgpt',
  account: 'user@example.com',
  convId: 'conv-1',
  role: 'user',
  content: 'hello world',
}

describe('MessageIdentity', () => {
  test('deterministic for same inputs', () => {
    expect(MessageIdentity.generate(base)).toBe(MessageIdentity.generate(base))
  })
  test('differs across providers (cross-provider isolation)', () => {
    const a = MessageIdentity.generate(base)
    const b = MessageIdentity.generate({ ...base, provider: 'claude' })
    expect(a).not.toBe(b)
  })
  test('provider-id mode differs from role/content mode', () => {
    const withId = MessageIdentity.generate({ ...base, providerMsgId: 'msg-123' })
    const noId = MessageIdentity.generate(base)
    expect(withId).not.toBe(noId)
  })
  test('different provider msg ids differ', () => {
    const a = MessageIdentity.generate({ ...base, providerMsgId: 'msg-1' })
    const b = MessageIdentity.generate({ ...base, providerMsgId: 'msg-2' })
    expect(a).not.toBe(b)
  })
  test('empty providerMsgId falls back to role/content mode', () => {
    const a = MessageIdentity.generate({ ...base, providerMsgId: '' })
    const b = MessageIdentity.generate(base)
    expect(a).toBe(b)
  })
  test('separator prevents field-boundary collisions', () => {
    const a = MessageIdentity.generate({ ...base, provider: 'ab', account: 'c' })
    const b = MessageIdentity.generate({ ...base, provider: 'a', account: 'bc' })
    expect(a).not.toBe(b)
  })
})
```

**`tests/unit/engines/ttl-sweeper.test.ts`**

```ts
import { describe, expect, test } from 'bun:test'
import { TtlSweeper } from '../../../src/engines/storage/ttl-sweeper.js'
import type { EphemeralEntry, LifecycleStore } from '../../../src/storage/contracts/lifecycle-store.js'

function makeStore(memEntries: EphemeralEntry[]): {
  store: LifecycleStore
  deleted: string[]
} {
  const deleted: string[] = []
  const noop = async () => [] as EphemeralEntry[]
  const store: LifecycleStore = {
    scanTraces: noop,
    scanExpiredSemanticMemories: noop,
    scanExpiredMemoryRecords: async () => memEntries,
    scanParserLogs: noop,
    deleteTraces: async () => 0,
    deleteSemanticMemories: async () => 0,
    deleteMemoryRecords: async (ids) => {
      deleted.push(...ids)
      return ids.length
    },
    deleteParserLogs: async () => 0,
    logSweep: async () => {},
  }
  return { store, deleted }
}

describe('TtlSweeper', () => {
  test('eternal and pinned entries are exempt from deletion', async () => {
    const entries: EphemeralEntry[] = [
      { id: 'a', ts: 1, isPinned: false, isEternal: false },
      { id: 'b', ts: 1, isPinned: true, isEternal: false },
      { id: 'c', ts: 1, isPinned: false, isEternal: true },
      { id: 'd', ts: 1, isPinned: false, isEternal: false },
    ]
    const { store, deleted } = makeStore(entries)
    const sweeper = new TtlSweeper(store)
    const report = await sweeper.sweepEphemeral()
    expect(deleted).toEqual(['a', 'd'])
    expect(report.memoryExpired).toBe(2)
    expect(report.exempted).toBe(2)
  })

  test('empty scan deletes nothing', async () => {
    const { store, deleted } = makeStore([])
    const sweeper = new TtlSweeper(store)
    const report = await sweeper.sweepEphemeral()
    expect(deleted).toEqual([])
    expect(report.memoryExpired).toBe(0)
  })
})
```

**`tests/unit/engines/memory-hierarchy.test.ts`**

```ts
import { describe, expect, test } from 'bun:test'
import { MemoryHierarchy } from '../../../src/engines/memory/memory-hierarchy.js'
import type { MemoryRecordRow, MemoryStore } from '../../../src/storage/contracts/memory-store.js'

function row(overrides: Partial<MemoryRecordRow> = {}): MemoryRecordRow {
  return {
    id: 'm1', agentId: 'system', nodeId: null, memoryType: 'Semantic',
    category: 'knowledge', subcategory: null, content: 'fact', summary: null,
    tagsJson: '[]', importance: 0.7, relevance: 0.7, stability: 8.0,
    difficulty: 0.3, dueDate: Date.now(), lastReview: null, reviewCount: 0,
    fsrsState: 'New', consolidationStatus: 'consolidated', accessCount: 0,
    lastAccessedAt: null, isPinned: false, isEternal: false, isArchived: false,
    sourceConversationIdsJson: '[]', occurredAt: null, expiresAt: null,
    embeddingId: null, createdAt: Date.now(), updatedAt: Date.now(),
    ...overrides,
  }
}

function memStore(rows: MemoryRecordRow[]): MemoryStore {
  const map = new Map(rows.map((r) => [r.id, r]))
  return {
    create: async (i) => row({ id: i.id ?? 'new', content: i.content }),
    get: async (id) => map.get(id) ?? null,
    update: async (id, patch) => {
      const r = map.get(id)!
      const next = { ...r, ...patch } as MemoryRecordRow
      map.set(id, next)
      return next
    },
    query: async (opts) =>
      rows.filter((r) => {
        if (opts.isEternal !== undefined && r.isEternal !== opts.isEternal) return false
        if (opts.consolidationStatus && r.consolidationStatus !== opts.consolidationStatus) return false
        if (opts.minImportance !== undefined && r.importance < opts.minImportance) return false
        return true
      }),
    collectDue: async () => [],
    listEternal: async () => rows.filter((r) => r.isEternal),
    delete: async (id) => {
      map.delete(id)
    },
  }
}

describe('MemoryHierarchy', () => {
  test('classifies tiers correctly', () => {
    const h = new MemoryHierarchy(memStore([]), null)
    expect(h.classifyTier('Episodic', 'unconsolidated', false)).toBe('episodic')
    expect(h.classifyTier('Semantic', 'consolidated', false)).toBe('semantic')
    expect(h.classifyTier('Identity', 'eternal', false)).toBe('eternal')
    expect(h.classifyTier('Custom', 'unconsolidated', true)).toBe('eternal')
  })

  test('promoteToEternal sets flag + status + relevance 1.0', async () => {
    const store = memStore([row()])
    const h = new MemoryHierarchy(store, null)
    const updated = await h.promoteToEternal('m1')
    expect(updated.isEternal).toBe(true)
    expect(updated.consolidationStatus).toBe('eternal')
    expect(updated.relevance).toBe(1.0)
  })

  test('autoGraduateEternal promotes high importance + stability', async () => {
    const store = memStore([
      row({ id: 'hi', importance: 0.9, stability: 10, consolidationStatus: 'consolidated' }),
      row({ id: 'lo', importance: 0.5, stability: 10, consolidationStatus: 'consolidated' }),
      row({ id: 'unstable', importance: 0.9, stability: 1, consolidationStatus: 'consolidated' }),
    ])
    const h = new MemoryHierarchy(store, null)
    const promoted = await h.autoGraduateEternal('system')
    expect(promoted).toBe(1) // only 'hi' qualifies
    expect((await store.get('hi'))!.isEternal).toBe(true)
    expect((await store.get('lo'))!.isEternal).toBe(false)
  })

  test('retrieveForContext respects token budget, eternal-first', async () => {
    const store = memStore([
      row({ id: 'e', isEternal: true, relevance: 0.5, content: 'eternal core', summary: 'eternal core' }),
      row({ id: 'n', isEternal: false, relevance: 0.9, content: 'x'.repeat(4000), summary: 'x'.repeat(4000) }),
    ])
    const h = new MemoryHierarchy(store, null)
    const result = await h.retrieveForContext('system', 50, 0.0)
    // tiny budget: only the short eternal snippet fits
    expect(result.snippets[0]?.memoryId).toBe('e')
    expect(result.totalTokens).toBeLessThanOrEqual(50)
  })
})
```

---

## 9. APPLY CHECKLIST

```bash
# 1) Append schema models
cat UPGRADE_PACKAGE/prisma/upgrade-memory-storage.prisma >> prisma/schema.prisma
bunx prisma db push --skip-generate

# 2) Copy sources (paths already match src/ layout)
#    contracts → src/storage/contracts/
#    impl      → src/storage/impl/
#    engines   → src/engines/{memory,storage}/
#    scripts   → scripts/
#    tests     → tests/unit/engines/

# 3) Wire into bootstrap (capability-bootstrap.ts) after Prisma is ready:
#    import { wireMaintenance } from './server/maintenance-wiring.js'
#    const maintenance = wireMaintenance(prisma, nodeStore)

# 4) Enable flags
export FEATURE_DEDUPLICATION=true
export FEATURE_TTL_SWEEP=true
export FEATURE_COMPACTION=true
export FEATURE_MIGRATION_BACKUP=true
export FEATURE_MEMORY_HIERARCHY=true

# 5) Verify
bun test tests/unit/engines/fsrs-scheduler.test.ts \
         tests/unit/engines/relevance-decay.test.ts \
         tests/unit/engines/message-identity.test.ts \
         tests/unit/engines/ttl-sweeper.test.ts \
         tests/unit/engines/memory-hierarchy.test.ts
bun run typecheck   # only when the full task list is done, per AGENTS.md
```

---

## Design Notes (why it's built this way)

1. **`MemoryRecord` is a materialized spine beside the Node layer** — identical to how `AgentSession`/`EntityContainer` sit next to `Node`. The durable, forkable artifact stays in `cap-store.memory` Nodes; FSRS queries hit the indexed spine. No N+1 over `dataJson`.
2. **Eternal is a first-class invariant**, not a flag you remember to check: `RelevanceDecay.calculate`, `MemoryHierarchy.retrieveForContext`, and `TtlSweeper.partitionExempt` all short-circuit on `isEternal || isPinned`. This is the "forever stores key information" guarantee enforced in three independent places.
3. **Compaction uses `page_count`/`freelist_count`** instead of scanning every row — O(1) bloat measurement, and `VACUUM` only runs when ≥15% / ≥10MB reclaimable (`maybeCompact`).
4. **Backup is checksum-verified and WAL-checkpointed** so a restored file is never torn. `withBackup()` gives migrations/compactions automatic rollback.
5. **Dedup is provider-agnostic by construction** — the SHA256 identity includes `provider\0account\0conv`, and `sourcesJson` merges provenance so the same logical message seen on ChatGPT + Claude + Gemini collapses to one record with three sources, feeding `Node.contentHash`.
6. **Engines never issue raw SQL or touch Prisma** — all PRAGMA/VACUUM/deleteMany lives behind the four Store Contracts, satisfying your layering invariant and keeping every engine unit-testable with in-memory fakes (as the tests demonstrate).

Want me to follow this with the **integration hooks** (wiring `DedupManager` into `ConversationManager.captureAsNode` and `MemoryHierarchy.retrieveForContext` into `ContextAssemblyEngine`'s identity layer), or a **Prisma migration SQL** version instead of `db push`?
