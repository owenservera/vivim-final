# Node-Layer v2 — Universal Compliant `Node` Database

## Design Rationale

Every piece of data in `vivim-final` lands as a `Node` — messages, memories, emails, documents, contacts, tasks, events, media, artifacts, bookmarks, notes, notebooks, ACUs (Atomic Chat Units). This is the **second brain** core: a time-travelable, forkable, remuxable graph database where nothing flowing through the system is dropped.

The design is adopted 1:1 from the proven `vivim-app-og` reDB application (single `redb` table with composite `tree:key` keys, ~40 trees, Cozo graph projection, temporal version chain). We port the field structure and invariants but use **Prisma ORM + SQLite** for portability.

**OG reference documents** (read-only, at `vivim-app-og/.../backend/src/`):
- `schema_models.rs` — `AtomicChatUnit` (ACU fields), `Memory` (FSRS-6)
- `memory_engine.rs` — FSRS-6 spaced repetition (stability/difficulty/dueDate/fsrsState)
- `storage/temporal.rs` — `temporal_log` version chain
- `cortex/lcg/schema.rs` — `EntityAlias` → canonical resolution
- `cozo_layer.rs` — ADR-001: graph is a projection, rebuildable from source

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Node Store Contract                    │
│     (src/storage/contracts/node-store.ts)                 │
├─────────────────────────────────────────────────────────┤
│                    Node Store Impl                        │
│     (src/storage/impl/node-store-impl.ts)                 │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│   Node   │ NodeEdge │ NodeVer. │NodeAlias │  Schema Reg │
│ (entity) │ (graph)  │(history) │ (merge)  │(cap-store.*)│
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

## Key Concepts

### 1. Universal Node (`prisma/schema.prisma` → `Node`)
Every data type is stored as a row in the `node` table. The `type` discriminator (e.g. `cap-store.message`, `cap-store.memory`) maps to a registered Zod schema via `schemaRegistry`. ACU-proven fields (`contentHash`, `version`, `state`, `securityLevel`, `contentType`, `authorDid`, `signature`, `acl`, `quality`) provide content integrity, lifecycle management, provenance, access control, and curation scoring.

### 2. Time Travel (`NodeVersion`)
Every mutation writes a `NodeVersion` row (op: `create` | `update` | `supersede`). The current node always reflects the latest version; `getNodeAtVersion(nodeId, version)` reads the exact historical payload.

### 3. Entity Merge (`NodeAlias`)
Alias → canonical resolution enables entity merging. `resolveAlias(aliasId)` returns the canonical node id. Multiple aliases can point to the same canonical node (OG `EntityAlias`).

### 4. Rebuildable Graph (`NodeEdge`)
Materialized edge table denormalized from each node's `edgesJson`. `rebuildGraphFromNodes()` clears and re-materializes all edges — the graph is a projection, rebuildable from source (ADR-001).

### 5. FSRS-6 Spaced Repetition
Memory nodes carry FSRS-6 fields (`stability`, `difficulty`, `dueDate`, `fsrsState`) for scheduling reviews in the second brain. Initial state is `New` (stability=1.0, difficulty=0.3).

## Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` (Node + NodeEdge + NodeVersion + NodeAlias) | DB schema |
| `prisma/migrations/20260718022736_universal_node_layer/` | Base Node layer migration |
| `prisma/migrations/20260718041000_node_layer_v2/` | ACU fields + version + alias migration |
| `src/schema/node.ts` | `NodeBase`, `Edge`, `NodeType`, `NodeAcl`, `NodeQuality`, `NodeState`, `createNode()` |
| `src/schema/node-data.ts` | Zod data shapes: Memory (+FSRS-6), Acu, Notebook, Note, Bookmark, Artifact, Document, Email |
| `src/schema/schemas.ts` | `registerAllSchemas()` — registers all `cap-store.*` schemas |
| `src/ids.ts` | `newId()` (ULID), `hashContent()` (SHA-256 with FNV fallback) |
| `src/storage/contracts/node-store.ts` | `NodeStoreContract` interface |
| `src/storage/impl/node-store-impl.ts` | `NodeStoreImpl` — Prisma-backed implementation |
| `src/engines/conversation-manager.ts` | `captureAsNode()` — auto-captures messages as Nodes |
| `src/engines/memory-engine.ts` | `recordMemory()` — emits FSRS-6 memory Nodes |
| `tests/unit/storage/impl/node-store-impl.test.ts` | Unit tests (version chain, alias, rebuild, dedup) |
| `scripts/_record_node_migration.ts` | Migration recording pattern |
| `scripts/_record_node_layer_v2.ts` | v2 migration recorder |
