# PRD: Universal Node Layer v2 — Fully Compliant, Time-Travelable, Rebuildable Second Brain

**Status:** Draft for implementation
**Author:** Product + Engineering (generated)
**Source of leverage:** `vivim-app-og/.../edge-pwa/backend` (reDB Rust reference implementation)
**Target system:** `vivim-final` (Bun + Prisma + TypeScript, SQLite)

---

## 1. Context & Problem

`vivim-final` introduced a universal `Node` abstraction with the stated objective: *"ALL data passing through the system is stored as a Node — reproducible from raw source (remux), forkable (parentId), and time-travelable (immutable ids + schemaVersion)."*

The current `Node` (`src/schema/node.ts`) and its storage (`node`/`node_edge` tables, `NodeStoreImpl`) satisfy **forkable** and **raw-source preservation**, but fall short on three of the four stated pillars:

1. **Not fully "compliant"** — `NodeBase` is a thin container. It lacks the metadata the reference OG system proves is necessary for a real second brain: content integrity/dedup hashes, lifecycle state, security level, content typing, provenance (author/signature), access-control lists, and quality scoring.
2. **Not genuinely "time-travelable"** — only `schemaVersion` exists. There is no version chain, no content hash, no point-in-time recovery, and no history query. "Time travel" is currently a promise, not a mechanism.
3. **Graph is a single point of failure** — `node_edge` is written once at `putNode` time. There is no way to rebuild the edge graph from `rawSource`, so corruption or drift in the materialized graph is unrecoverable.

The OG `vivim-app-og` project (Rust reDB) has already solved these problems in production: its `AtomicChatUnit` is a complete, battle-tested node shape; its `temporal_log` provides a real version chain; its `Memory` struct carries FSRS-6 spaced-repetition + temporal validity; and its Cozo graph layer is a **rebuildable** projection from source (ADR-001).

**Decision:** Adopt the OG designs into our `Node` layer rather than reinvent them. This PRD specifies a full vertical slice.

---

## 2. Goals & Non-Goals

### Goals
- G1. Extend `NodeBase` with ACU-proven fields (integrity, lifecycle, provenance, ACL, quality).
- G2. Add a real version chain (`NodeVersion`) enabling point-in-time read + full history (time travel).
- G3. Add memory lifecycle + FSRS-6 spaced-repetition fields to memory-type nodes.
- G4. Add entity alias→canonical resolution and a `rebuildGraphFromNodes()` primitive (graph rebuildable from `rawSource`).
- G5. Wire the capture path so every persisted node is hashed, versioned, ACL-defaulted, and edge-materialized — with version rows written automatically.

### Non-Goals (this PRD)
- NG1. Vector/HNSW index (OG dropped it as too costly; columns kept for forward-compat only).
- NG2. Real LLM-based entity disambiguation (we add the *table + API*; resolution method stays `hash`/`canonical` only).
- NG3. Multi-device sync/replication (`device_id`, `rev`, `updated_by` columns are deferred).
- NG4. Replacing existing legacy per-type tables — the `Node` layer is additive.

---

## 3. Success Metrics
- S1. `bun run typecheck` → 0 `src/` errors.
- S2. New `NodeStore` tests pass: version row written on `putNode`; `getNodeHistory` returns ordered chain; `resolveAlias`/`registerAlias` round-trip; `rebuildGraphFromNodes` repopulates `node_edge` from `rawSource`.
- S3. Sending a chat message yields: 1 `cap-store.message` node, 1 `NodeVersion` row, ≥1 `node_edge` row, non-null `content_hash`, `state='active'`, `version=1`.
- S4. `bun run devops invariants check` passes (Governor Canon, Store Contracts, Phase Gates respected).
- S5. Dedup: a second `putNode` with an identical `contentHash`+`type` is rejected unless `force: true`.

---

## 4. Requirements

### 4.1 Node schema extension (`src/schema/node.ts`)
Add to `NodeBase` (all additive, backward-compatible with existing seeded nodes):

| Field | Type | Source (OG) | Purpose |
|---|---|---|---|
| `contentHash` | `string?` | `AtomicChatUnit.contentHash` | Dedup + integrity; computed from `rawSource ?? JSON(data)`. |
| `version` | `number` | `AtomicChatUnit.version` | Starts 1; increments on each `updateNode`. |
| `state` | `'draft'\|'active'\|'superseded'\|'archived'` | `AtomicChatUnit.state` | Lifecycle. |
| `securityLevel` | `number?` | `AtomicChatUnit.securityLevel` | Sensitivity tiering. |
| `contentType` | `string?` | `AtomicChatUnit.contentType` | e.g. `message`, `memory`, `document`. |
| `authorDid` | `string?` | `AtomicChatUnit.authorDid` | Provenance. |
| `signature` | `string?` | `AtomicChatUnit.signature` | Tamper-evidence. |
| `acl` | `{ sharingPolicy: string; sharingCircles: string[]; canView: boolean; canAnnotate: boolean; canRemix: boolean; canReshare: boolean }?` | `AtomicChatUnit.sharing*` | Access control. |
| `quality` | `{ overall?: number; structuralIntegrity?: number; uniqueness?: number }?` | `AtomicChatUnit.quality*` | Curation scoring. |
| `validFrom` | `number?` | `Memory.validFrom` / LCG `valid_from` | Temporal validity window start. |
| `validUntil` | `number?` | `Memory.validUntil` / LCG `superseded_at` | Temporal validity window end. |
| `parentVersion` | `number?` | LCG `parent` (version chain) | Predecessor version in the chain. |

- Extend `Edge` with optional `weight?: number` (OG `AcuLink.weight`).
- Add `NodeType` members: `cap-store.memory`, `cap-store.notebook`, `cap-store.note`, `cap-store.bookmark`, `cap-store.artifact`, `cap-store.acu`.
- `createNode()` defaults: `version: 1`, `state: 'active'`, `schemaVersion: 1`.
- New helper `hashContent(node): string` (stable SHA-256 of canonicalized content) in `src/schema/node-hash.ts`.

### 4.2 Typed `Node.data` shapes (`src/schema/node-data.ts`, new)
Zod schemas mirroring OG `schema_models.rs`:
- `MemoryNodeData`: `content, summary?, memoryType, category, importance:number, relevance:number, sourceConversationIds:string[], sourceMessageIds:string[], occurredAt?, validFrom?, validUntil?, isPinned:boolean, isArchived:boolean, consolidationStatus, accessCount:number` **+ FSRS-6**: `stability:number, difficulty:number, dueDate:number, lastReview?:number, reviewCount:number, fsrsState: 'New'|'Learning'|'Review'|'Relearning'`.
- `MessageNodeData`: `role, text, blockCount, messageIndex?`.
- `AcuNodeData`, `NoteNodeData`, `BookmarkNodeData`, `ArtifactNodeData`, `DocumentNodeData`, `EmailNodeData` — faithful minimal copies of OG structs.
- Register all in `SchemaRegistry` via `registerAllSchemas()` (`src/schema/schemas.ts`).

### 4.3 Database schema (Prisma + migration)
**Extend `Node` model** (`prisma/schema.prisma`):
`content_hash, version Int @default(1), state String @default("active"), security_level Int?, content_type String?, author_did String?, signature String?, acl_json String @default("{}"), quality_json String @default("{}"), valid_from BigInt?, valid_until BigInt?, parent_version Int?` (index `content_hash`, `state`, `version`).

**New `NodeVersion` model** (mirror OG `temporal_log`):
`id, nodeId, version Int, hash, contentRef, op ('create'|'update'|'supersede'), parentVersion Int?, createdAt BigInt` — `@@unique([nodeId, version])`, `@@index([nodeId])`.

**New `NodeAlias` model** (mirror OG `EntityAlias`):
`id, aliasId, canonicalId, method, confidence Float, createdAt BigInt` — `@@unique([aliasId])`, `@@index([canonicalId])`.

**Migration:** `prisma/migrations/<ts>_node_layer_v2/migration.sql` in the project's `-- CreateTable` format; applied via `bunx prisma db push --skip-generate`; recorded in `migration_log` (reuse `scripts/_record_node_migration.ts` pattern).

### 4.4 Storage contract (`src/storage/contracts/node-store.ts` + `NodeStoreImpl`)
Extend `NodeStoreContract` and implement in `NodeStoreImpl`:
- `putNode(node)` → also writes a `NodeVersion` (`op:'create'`, `parentVersion` from node) and dedup-checks `contentHash`+`type`.
- `updateNode(id, patch)` → increments `version`, sets `parentVersion`, `state`, writes `NodeVersion` (`op:'update'`/`'supersede'`).
- `getNodeAtVersion(id, version): NodeRow | null` (point-in-time).
- `getNodeHistory(id): NodeVersion[]` (ordered by version).
- `resolveAlias(aliasId): string | null` and `registerAlias(aliasId, canonicalId, method, confidence)`.
- `rebuildGraphFromNodes(): Promise<{scanned:number; inserted:number}>` → re-derive `node_edge` from each node's `rawSource`/edges (ADR-001 rebuildability).
- `NodeRow` extended with the new columns.

### 4.5 Capture wiring (`src/engines/conversation-manager.ts`)
In the existing `captureAsNode()` (added this session):
- Compute `contentHash`, set `version:1`, `state:'active'`, `contentType:'message'`, `authorDid` (from account), `acl` defaults, optional `quality`.
- Link assistant message node `parentId` → user message node (fork chain).
- Memory extraction (`memory-engine.ts`) emits `cap-store.memory` nodes carrying FSRS-6 fields + `validFrom/validUntil`.
- `putNode` automatically writes the `NodeVersion` row (per 4.4).

---

## 5. Architecture & Data Flow

```
captureAsNode()                      NodeStoreImpl.putNode()
   build NodeBase (ACU fields)  ──▶    ├─ hash content → contentHash
                                          ├─ INSERT node (version=1, state=active, acl, ...)
                                          ├─ INSERT node_version (op=create, hash, contentRef)
                                          ├─ dedup check on (type, contentHash)
                                          └─ materialize node_edge rows
                                                 │
                                                 ▼
                                      rebuildGraphFromNodes()  (recoverable from rawSource)
```

Time travel: `getNodeHistory(id)` → `SELECT * FROM node_version WHERE nodeId=? ORDER BY version`.
Entity resolution: `registerAlias(aliasId, canonicalId)` → `resolveAlias()` returns canonical for contacts/entities.

---

## 6. Invariants & Constraints (must respect)
- **Governor Canon:** Only `ChromeGovernor` touches CDP. No engine in this PRD imports `BunCdpClient`.
- **Store Contracts:** Engines depend on `src/storage/contracts/*.ts`, never `src/storage/impl/*.ts`.
- **Research-First:** This PRD is the research output (OG code already read); implementation follows.
- **Phase Gates:** Schema → contract → impl → capture wiring → tests, in order.
- **Additive only:** existing `node` rows remain valid (new columns nullable/defaulted).

---

## 7. Implementation Steps (atomic, ordered)
1. `src/schema/node.ts` — extend `NodeBase`, `Edge`, `NodeType`; add `hashContent` helper (`src/schema/node-hash.ts`); update `createNode` defaults.
2. `src/schema/node-data.ts` — Zod `data` shapes (memory+FSRS, message, acu, note, bookmark, artifact, document, email); register in `schemas.ts`.
3. `prisma/schema.prisma` — extend `Node`; add `NodeVersion`, `NodeAlias`; generate migration SQL.
4. `bunx prisma db push --skip-generate` + record migration in `migration_log`.
5. `src/storage/contracts/node-store.ts` — extend `NodeRow` + `NodeStoreContract` (version/alias/rebuild methods).
6. `src/storage/impl/node-store-impl.ts` — implement all new methods.
7. `src/engines/conversation-manager.ts` — enrich `captureAsNode()` with ACU fields + fork link.
8. `src/engines/memory-engine.ts` — emit `cap-store.memory` nodes with FSRS + validity.
9. Tests: `tests/unit/storage/impl/node-store-impl.test.ts` (version chain, history, alias, rebuild, dedup).
10. `bun run typecheck` → 0 errors; boot `:9420`; send message; assert node+version+edge+hash.
11. `bun run devops invariants check`.

---

## 8. Risks & Mitigations
- **R1:** `contentRef` storage cost — mitigate: `contentRef` = `rawSource ?? dataJson` pointer, not a copy; hashed for dedup only.
- **R2:** `rebuildGraphFromNodes` scanning large tables — mitigate: paginated scan (like OG `scan(tree,'',500_000)`), run as a maintenance op, not on hot path.
- **R3:** Breaking existing seeded nodes missing new fields — mitigate: all new columns nullable/defaulted; `fromRow` tolerates missing keys.

---

## 9. Acceptance Criteria
All of S1–S5 (§3) must pass. The `Node` layer must demonstrably support: hash-based dedup, version-chain time travel, ACL/lifecycle/provenance metadata, FSRS memory scheduling fields, alias→canonical resolution, and source-rebuildable graph — fulfilling the original "fully compliant, time-travelable, forkable, remuxable" objective.
