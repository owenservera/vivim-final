# Node-Layer v2 — Full Schema Reference

## Prisma Models

### `Node` — Universal entity

Every datum in the system is a `Node`. The `type` field discriminates the data shape; `dataJson`, `edgesJson`, and `metaJson` hold the payload. ACU-proven fields (from OG `AtomicChatUnit`) provide content integrity, lifecycle, provenance, access control, and quality scoring.

```prisma
model Node {
  id             String  @id
  type           String  @map("type")          // "cap-store.message", "cap-store.memory", etc.
  parentId       String? @map("parent_id")     // Fork parent (lineage)

  // Schema
  schemaVersion  Int     @default(1) @map("schema_version")

  // Payload
  rawSource      String? @map("raw_source")    // Unparsed original payload (for remux)
  dataJson       String  @default("{}") @map("data_json")   // Typed Node.data
  edgesJson      String  @default("[]") @map("edges_json")  // Outgoing edges (graph)
  metaJson       String  @default("{}") @map("meta_json")   // Arbitrary k/v metadata
  searchText     String  @default("") @map("search_text")   // Free-text search index

  // Provenance
  conversationId String? @map("conversation_id")
  messageId      String? @map("message_id")
  sourceParser   String? @map("source_parser")

  // ACU-proven fields (from OG AtomicChatUnit)
  contentHash    String? @map("content_hash")   // SHA-256 content integrity hash
  version        Int     @default(1) @map("version")         // Monotonic edit version
  state          String  @default("active") @map("state")    // "active" | "archived" | "deleted" | "superseded"
  securityLevel  Int?    @map("security_level")               // 0=public ... 5=top secret
  contentType    String? @map("content_type")                 // "message", "memory", "document", etc.
  authorDid      String? @map("author_did")                  // "user" | "assistant" | DID string
  signature      String? @map("signature")                   // Cryptographic signature (future)
  aclJson        String  @default("{}") @map("acl_json")     // Access control list
  qualityJson    String  @default("{}") @map("quality_json") // Curation quality scores

  // Temporal validity (OG Memory validFrom / validUntil)
  validFrom      BigInt? @map("valid_from")
  validUntil     BigInt? @map("valid_until")

  // Version chain predecessor
  parentVersion  Int?    @map("parent_version")

  // Timestamps
  createdAt      BigInt  @map("created_at")
  updatedAt      BigInt  @map("updated_at")

  // Relations
  parent         Node?    @relation("NodeParent", fields: [parentId], references: [id])
  children       Node[]   @relation("NodeParent")
  outgoingEdges  NodeEdge[] @relation("EdgeSource")
  incomingEdges  NodeEdge[] @relation("EdgeTarget")
  versions       NodeVersion[] @relation("NodeVersions")
}
```

**Indexes:** `type`, `parentId`, `conversationId`, `messageId`, `createdAt`, `searchText`, `contentHash`, `state`.

### `NodeEdge` — Materialized graph edge

Denormalized from `edgesJson` for efficient graph traversal (indexed by source, target, edge type).

```prisma
model NodeEdge {
  id             String  @id
  sourceId       String  @map("source_id")
  targetId       String  @map("target_id")
  edgeType       String  @map("edge_type")       // "responds_to", "follows", "references", etc.
  label          String? @map("label")
  weight         Float?  @map("weight")           // Edge weight / confidence
  propertiesJson String  @default("{}") @map("properties_json")
  createdAt      BigInt  @map("created_at")

  source         Node @relation("EdgeSource", fields: [sourceId], references: [id])
  target         Node @relation("EdgeTarget", fields: [targetId], references: [id])

  @@unique([sourceId, targetId, edgeType])
}
```

**Indexes:** `sourceId`, `targetId`, `edgeType`. Unique constraint on `(sourceId, targetId, edgeType)` prevents duplicate edges.

### `NodeVersion` — Time-travel version chain

One row per mutation. Enables exact point-in-time reads (`getNodeAtVersion`) and full history traversal (`getNodeHistory`).

```prisma
model NodeVersion {
  id           String  @id
  nodeId       String  @map("node_id")
  version      Int     @map("version")
  hash         String                     // content hash at this version
  contentRef   String  @map("content_ref") // dataJson payload at this version
  op           String                     // "create" | "update" | "supersede"
  parentVersion Int?   @map("parent_version")
  createdAt    BigInt  @map("created_at")

  node         Node @relation("NodeVersions", fields: [nodeId], references: [id])

  @@unique([nodeId, version])
}
```

### `NodeAlias` — Entity alias → canonical resolution

Enables contacts/entities to be merged under a single canonical node id (OG `EntityAlias`).

```prisma
model NodeAlias {
  id          String  @id
  aliasId     String  @map("alias_id")      // The alias (e.g. email, username)
  canonicalId String  @map("canonical_id")  // The canonical node id
  method      String                        // "merge" | "dedup" | "import"
  confidence  Float   @default(1.0)
  createdAt   BigInt  @map("created_at")

  @@unique([aliasId])
}
```

## Registered Node Types (`cap-store.*`)

Registered in `src/schema/schemas.ts` → `registerAllSchemas()`.

| Type | Data Shape | Source |
|------|-----------|--------|
| `cap-store.message` | `MessageData` (role, parts, rawSource, parseVersion, model, finishReason) | `src/schema/message.ts` |
| `cap-store.conversation` | `ConversationData` (title, provider, model, messageIds) | `src/schema/message.ts` |
| `cap-store.memory` | `MemoryData` (content, FSRS-6, validity, importance) | `src/schema/node-data.ts` |
| `cap-store.acu` | `AcuData` (full OG AtomicChatUnit: authorDid, contentHash, acuType, sharing*, quality*) | `src/schema/node-data.ts` |
| `cap-store.notebook` | `NotebookData` (ownerId, name, entryIds) | `src/schema/node-data.ts` |
| `cap-store.note` | `NoteData` (title, body, tags, attachments) | `src/schema/node-data.ts` |
| `cap-store.bookmark` | `BookmarkData` (url, title, description, favicon) | `src/schema/node-data.ts` |
| `cap-store.artifact` | `ArtifactData` (artifactType, title, contentRef, sourceConversationId) | `src/schema/node-data.ts` |
| `cap-store.document` | `DocumentNodeData` (title, body, mimeType, sourceUrl) | `src/schema/node-data.ts` |
| `cap-store.email` | `EmailNodeData` (from, to, subject, body, threadId) | `src/schema/node-data.ts` |

## NodeBase Interface (`src/schema/node.ts`)

```typescript
interface NodeBase {
  id: string
  type: NodeType | string
  parentId?: string
  schemaVersion: number
  version: number              // NEW: starts at 1
  state: string                 // NEW: "active" | "archived" | "deleted" | "superseded"
  source?: string
  data: Record<string, unknown>
  edges: Edge[]
  meta: Record<string, unknown>
  // ACU-proven fields (all NEW as optional)
  contentHash?: string
  securityLevel?: number
  contentType?: string
  authorDid?: string
  signature?: string
  acl?: Partial<NodeAcl>
  quality?: Partial<NodeQuality>
  validFrom?: number
  validUntil?: number
  parentVersion?: number
  createdAt: number
  updatedAt: number
}
```

## NodeStoreContract (`src/storage/contracts/node-store.ts`)

| Method | Purpose |
|--------|---------|
| `putNode(node)` | Insert a new node (immutable id). Writes version-1 entry. |
| `getNode(id)` | Fetch current version of a node. |
| `listNodes(opts?)` | Filtered list (type, parentId, conversationId, messageId). |
| `getChildren(id)` | Direct children (fork chain). |
| `getLineage(id)` | All ancestors via parentId chain. |
| `getRawSource(id)` | Original unparsed payload (for remux). |
| `putEdge(edge)` | Materialize a graph edge. |
| `getOutgoingEdges(sourceId)` | Outgoing edges from a node. |
| `getIncomingEdges(targetId)` | Incoming edges to a node. |
| `countNodes()` | Total node count. |
| **`updateNode(id, patch)`** | **NEW**: Bump version, write NodeVersion entry. |
| **`getNodeAtVersion(nodeId, version)`** | **NEW**: Point-in-time read. |
| **`getNodeHistory(nodeId)`** | **NEW**: Full version history. |
| **`registerAlias(aliasId, canonicalId, method, confidence?)`** | **NEW**: Register alias. |
| **`resolveAlias(aliasId)`** | **NEW**: Resolve alias → canonical id. |
| **`rebuildGraphFromNodes()`** | **NEW**: Re-materialize edges from edgesJson. |
