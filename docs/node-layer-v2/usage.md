# Node-Layer v2 — Usage Guide

## Creating a Node (Engine-side)

The canonical way to create a node from an engine is via the `NodeStoreContract`. All ACU-proven fields are optional but **should be populated** for full compliance.

```typescript
import { newId, hashContent } from '../ids.js'
import type { NodeStoreContract } from '../storage/contracts/node-store.js'

async function captureMyEntity(nodeStore: NodeStoreContract) {
  const now = Date.now()
  const data = { title: 'My Entity', body: '...' }
  const dataJson = JSON.stringify(data)

  await nodeStore.putNode({
    id: newId(),
    type: 'cap-store.entity',        // registered in schema registry
    schemaVersion: 1,
    version: 1,                       // starts at 1
    state: 'active',
    source: 'original raw payload',   // preserved for remux
    data,
    edges: [{
      type: 'references',
      targetId: 'some-other-node-id',
      properties: { confidence: 0.95 },
    }],
    meta: {
      conversationId: 'conv_1',
      messageId: 'msg_2',
      sourceParser: 'my-engine',
    },
    acl: {
      canView: true,
      canAnnotate: false,
      canRemix: false,
      canReshare: false,
    },
    authorDid: 'user',                // "user" | "assistant" | DID string
    contentType: 'entity',            // fine-grained classification
    securityLevel: 0,                 // 0=public
    createdAt: now,
    updatedAt: now,
  })
}
```

**Important:** `putNode` is insert-only — ids are immutable. For edits, use `updateNode`.

## Updating a Node (Version Chain)

```typescript
await nodeStore.updateNode('node-id', {
  dataJson: JSON.stringify({ text: 'edited content' }),
  state: 'archived',
  aclJson: JSON.stringify({ canView: false }),
})
```

This bumps `version` (1 → 2), stores the old version in `NodeVersion` with op `update`, and sets `parentVersion` for lineage tracking. `getNodeHistory('node-id')` returns all versions.

## Time Travel (Point-in-Time)

```typescript
// Read current version (NodeRow)
const current = await nodeStore.getNode('node-id')

// Read a specific historical version
const atV1 = await nodeStore.getNodeAtVersion('node-id', 1)

// Full version history
const history = await nodeStore.getNodeHistory('node-id')
```

## Capturing Messages as Nodes (ConversationManager)

`captureAsNode()` is called automatically in both send paths (batch and streaming). It:

1. Creates a `cap-store.message` Node for the user message
2. Returns the user node id
3. Creates a `cap-store.message` Node for the assistant message, linked to the user via `responds_to` edge

```typescript
// Internal flow (automatic, no caller action needed):
const userNodeId = await this.captureAsNode(
  conversationId, msgRow.id, 'user', message, blocks
)
await this.captureAsNode(
  conversationId, msgRow.id, 'assistant', rawBody, blocks,
  userNodeId ?? undefined,  // fork link
)
```

Each captured Node carries: `version: 1`, `state: 'active'`, `acl: { canView: true }`, `authorDid: 'user' | 'assistant'`, `contentType: 'message'`.

## Recording Memory as Nodes (MemoryEngine)

```typescript
const memId = await memoryEngine.recordMemory({
  content: 'Learned that user prefers dark mode',
  memoryType: 'semantic',
  category: 'preference',
  tags: ['ui', 'theme'],
  importance: 0.8,
  relevance: 0.6,
  sourceConversationIds: ['conv_1'],
  sourceMessageIds: ['msg_2'],
  validFrom: Date.now(),
  validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000,  // 1 year
  isPinned: false,
  isArchived: false,
  nodeStore,  // required to persist the Node
  conversationId: 'conv_1',
})
```

The emitted `cap-store.memory` Node carries FSRS-6 initial state (`stability: 1.0`, `difficulty: 0.3`, `dueDate: now`, `fsrsState: 'New'`) for spaced-repetition review scheduling.

## Alias Resolution (Entity Merge)

```typescript
// Register an alias
await nodeStore.registerAlias('user@email.com', 'canonical-node-id', 'merge', 0.9)

// Resolve alias to canonical id
const canonicalId = await nodeStore.resolveAlias('user@email.com')
// → 'canonical-node-id'

// Unknown alias returns null
const notFound = await nodeStore.resolveAlias('nobody@nowhere.com')
// → null
```

## Graph Rebuild (Rebuildable Projection)

```typescript
// Re-materialize ALL edges from every node's edgesJson
// Clears node_edge table first, then re-inserts
const edgeCount = await nodeStore.rebuildGraphFromNodes()
console.log(`Materialized ${edgeCount} edges`)
```

## Adding a New Node Type

1. **Define a Zod schema** in `src/schema/` (e.g. `src/schema/my-type.ts`)
2. **Create a `NodeSchema` object** with `type`, `version`, `schema`, `indexContent`, `embeddingText`
3. **Register** in `src/schema/schemas.ts` → `registerAllSchemas()`
4. **Optionally add the type** to the `NodeType` union in `src/schema/node.ts`
5. **Wire capture** in the relevant engine — call `nodeStore.putNode(...)` with the new type

## Migration / Schema Evolution

The Node layer uses additive migrations only (ALTER TABLE ADD COLUMN, CREATE TABLE). Migrations are recorded in `migration_log` via `CapStoreDb.applyMigration()` or the recording scripts under `scripts/_record_*.ts`.

**Adding a new Prisma field:**
```bash
# 1. Edit prisma/schema.prisma
# 2. Sync DB
DATABASE_URL="file:./dev.db" bunx prisma db push --skip-generate
# 3. Regenerate client
bunx prisma generate
# 4. Create migration SQL file
# 5. Record in migration_log (see scripts/_record_node_layer_v2.ts)
```
