# PRD: Node Query API

- **Status:** Draft
- **Author:** Product Management (vivim-final)
- **Last Updated:** 2026-08-01
- **Feature Name:** Node Query API

---

## 1. Feature Name

**Node Query API** — REST endpoints that expose the Universal Node Layer's graph storage (nodes, edges, version chains, aliases) to clients, enabling graph traversal, time-travel queries, and content retrieval for all provider-generated data.

---

## 2. Epic

- **Epic:** Data Layer & Provider Content (`data-layer`)
- **Parent Epic Document:** [`docs/merged-design-v2/01-merged-epic.md`](../../merged-design-v2/01-merged-epic.md)
- **Parent Architecture Document:** [`docs/merged-design-v2/02-merged-architecture.md`](../../merged-design-v2/02-merged-architecture.md)
- **Schema Reference:** [`docs/merged-design-v2/03-merged-schema.md`](../../merged-design-v2/03-merged-schema.md)
- **Engine Spec:** [`docs/merged-design-v2/04-merged-engines.md`](../../merged-design-v2/04-merged-engines.md)

The Node Query API realizes the read path for the Universal Node Layer (Node + NodeEdge + NodeVersion + NodeAlias tables), which currently has a complete write path (`captureAsNode` in ConversationManager, `recordMemory` in MemoryEngine) but no API surface for clients.

---

## 3. Goal

### Problem

Every conversation message, memory, and extracted knowledge unit is captured as a Node via `captureAsNode()` and `recordMemory()`. The NodeStore contract has full graph methods (`getNode`, `getLineage`, `getChildren`, `getOutgoingEdges`, `getIncomingEdges`, `getNodeAtVersion`, `getNodeHistory`, `resolveAlias`). However, **none of these are exposed via API**. Clients (frontend, CLI, MCP, external tools) cannot:

- Retrieve a node and its typed data payload
- Traverse the conversation fork chain (assistant → user edges)
- Query version history for time-travel
- Resolve entity aliases (merged contacts, deduplicated entities)
- Filter nodes by type, conversation, or time range
- Access `rawSource` for re-parse/remux

The data is written but unreachable — a one-way sink.

### Solution

Introduce a `node-router.ts` with REST endpoints that map 1:1 to `NodeStoreContract` methods. Follow the established router pattern (see `memory-viz-router.ts`, `knowledge-router.ts`). Wire it into `server/index.ts` bootstrap.

### Impact

- **Data accessibility:** all provider-generated content becomes queryable via standard REST
- **Frontend enablement:** conversation timeline, fork visualization, memory recall, entity merge — all become possible
- **Debugging:** operators can inspect node state, version history, and edge graphs
- **Re-parse:** `rawSource` access enables re-running parsers on demand
- **Foundation:** prerequisite for semantic search over nodes, cross-conversation synthesis, and graph-based features

---

## 4. User Personas

1. **Frontend Developer** — needs to render conversation timelines, fork chains, memory graphs, and entity relationships in the UI.
2. **Platform Engineer** — needs to debug node state, inspect version history, and verify edge integrity after parser runs.
3. **Agent / Capability Runtime** — needs to query nodes programmatically for context assembly, memory recall, and cross-conversation synthesis.
4. **External Tool Integrator** — needs a stable REST API to build tooling around the knowledge graph.

---

## 5. User Stories

- As a **Frontend Developer**, I want to fetch a node by ID with its parsed `dataJson` and typed schema, so that I can render message content, memory cards, or entity details.
- As a **Frontend Developer**, I want to list nodes filtered by `type`, `conversationId`, and time range, so that I can build conversation timelines and memory views.
- As a **Frontend Developer**, I want to get a node's children (fork chain), so that I can visualize which assistant responses followed from which user messages.
- As a **Frontend Developer**, I want to get a node's outgoing and incoming edges, so that I can render relationship graphs between messages, memories, and entities.
- As a **Platform Engineer**, I want to get a node's full version history, so that I can audit what changed and when.
- As a **Platform Engineer**, I want to get a node's `rawSource`, so that I can re-run a parser or debug wire-format issues.
- As a **Platform Engineer**, I want to rebuild the materialized edge graph from nodes, so that I can repair edge consistency after migrations.
- As an **Agent Runtime**, I want to resolve an alias to its canonical node ID, so that I can merge duplicate entities.
- As an **Agent Runtime**, I want to count total nodes, so that I can report storage metrics.

---

## 6. Requirements

### 6.1 Functional Requirements

**Core CRUD**

- FR-1: `GET /api/nodes/:id` — Return a single node by ID. Include parsed `dataJson` as a structured object (not raw JSON string). Include computed fields: `childCount`, `edgeCount`.
- FR-2: `GET /api/nodes` — List nodes with query params: `type`, `conversationId`, `messageId`, `state`, `acuType`, `limit` (default 50, max 200), `offset`, `orderBy` (`createdAt`|`updatedAt`), `orderDir` (`asc`|`desc`).
- FR-3: `GET /api/nodes/count` — Return total node count. Optional `type` filter.

**Graph Traversal**

- FR-4: `GET /api/nodes/:id/children` — Return direct children of a node (fork chain).
- FR-5: `GET /api/nodes/:id/lineage` — Return the full ancestor chain (node → parent → grandparent → … → root).
- FR-6: `GET /api/nodes/:id/edges/outgoing` — Return outgoing edges from a node.
- FR-7: `GET /api/nodes/:id/edges/incoming` — Return incoming edges to a node.
- FR-8: `GET /api/nodes/:id/edges/neighbors` — Return all neighbors (union of outgoing targets + incoming sources) with edge metadata.

**Version Chain (Time Travel)**

- FR-9: `GET /api/nodes/:id/versions` — Return full version history (NodeVersion rows).
- FR-10: `GET /api/nodes/:id/versions/:version` — Return a specific version snapshot.

**Alias Resolution**

- FR-11: `GET /api/nodes/alias/:aliasId` — Resolve an alias to its canonical node ID.
- FR-12: `POST /api/nodes/alias` — Register a new alias → canonical mapping. Body: `{ aliasId, canonicalId, method, confidence? }`.

**Raw Source**

- FR-13: `GET /api/nodes/:id/raw` — Return the `rawSource` string for re-parse. 404 if null.

**Maintenance**

- FR-14: `POST /api/nodes/rebuild-graph` — Trigger `rebuildGraphFromNodes()`. Return the count of edges (re)materialized.

**Data Shape**

- FR-15: All responses MUST return `dataJson` as a parsed object (not a JSON string), with the node's registered Zod schema applied for validation.
- FR-16: All responses MUST include `createdAt` and `updatedAt` as ISO 8601 strings (convert from epoch ms).

### 6.2 Non-Functional Requirements

- NFR-1: **Performance:** Single-node lookups MUST complete in < 50ms (p95). List queries with filters MUST complete in < 200ms (p95) for datasets up to 100K nodes.
- NFR-2: **Pagination:** All list endpoints MUST support `limit`/`offset` pagination. Default `limit` = 50, max = 200.
- NFR-3: **Error handling:** MUST return structured error responses: `{ error: string, code: string }` with appropriate HTTP status codes (400, 404, 500).
- NFR-4: **Audit logging:** Every request MUST be tagged with `X-Source` header for audit (matching `memory-viz-router.ts` convention).
- NFR-5: **Schema validation:** `POST /api/nodes/alias` MUST validate input with Zod before persistence.
- NFR-6: **No auth bypass:** Router MUST be mounted behind the existing auth middleware (`createAuthMiddleware`).

---

## 7. Acceptance Criteria

### AC-1: Node Retrieval

```
Given a node exists with ID "01ABC..." and type "cap-store.message"
When I GET /api/nodes/01ABC...
Then I receive status 200
And the response body contains id, type, data (parsed object), version, state, createdAt, updatedAt
And data contains role, text, blockCount (from MessageData schema)
```

### AC-2: Node Listing with Filters

```
Given 10 nodes exist: 5 of type "cap-store.message", 3 of type "cap-store.memory", 2 of type "cap-store.acu"
When I GET /api/nodes?type=cap-store.message&limit=10
Then I receive status 200
And the response contains exactly 5 nodes
And all nodes have type "cap-store.message"
```

### AC-3: Fork Chain (Children)

```
Given node A (user message) exists
And node B (assistant response) has parentId = A.id with edge type "responds_to"
When I GET /api/nodes/{A.id}/children
Then I receive status 200
And the response contains node B
And B has edge metadata { type: "responds_to", targetId: A.id }
```

### AC-4: Lineage Traversal

```
Given node C → node B → node A (parent chain)
When I GET /api/nodes/{C.id}/lineage
Then I receive status 200
And the response contains [C, B, A] in order from leaf to root
```

### AC-5: Version History

```
Given a node was created at version 1 and updated twice (now at version 3)
When I GET /api/nodes/{id}/versions
Then I receive status 200
And the response contains 3 NodeVersion entries
And entries are ordered by version ascending
```

### AC-6: Alias Resolution

```
Given alias "contact:john@example.com" maps to canonical node "01XYZ..."
When I GET /api/nodes/alias/contact:john@example.com
Then I receive status 200
And the response contains { canonicalId: "01XYZ...", confidence: 1.0 }
```

### AC-7: Raw Source Retrieval

```
Given a node with rawSource = "Hello, how are you?"
When I GET /api/nodes/{id}/raw
Then I receive status 200
And the response body is { raw: "Hello, how are you?" }
```

### AC-8: 404 Handling

```
Given no node exists with ID "nonexistent"
When I GET /api/nodes/nonexistent
Then I receive status 404
And the response body contains { error: "Node not found", code: "NOT_FOUND" }
```

### AC-9: Graph Rebuild

```
When I POST /api/nodes/rebuild-graph
Then I receive status 200
And the response contains { edgesRebuilt: <number> }
```

---

## 8. Out of Scope

- **Node creation/update via API** — writes are handled by engines (`captureAsNode`, `recordMemory`). This feature is read-only (plus alias registration and graph rebuild).
- **GraphQL** — REST only. GraphQL can be a future layer.
- **Real-time subscriptions** — WebSocket push for node changes is out of scope. Clients poll or use existing WS conversation stream.
- **Embedding/vector search** — Semantic search over nodes uses the existing `SemanticSearchEngine`. This feature provides the structural graph layer.
- **Node deletion** — Nodes are immutable (version chain). Deletion is via `state: 'archived'`, not DELETE.
- **Bulk import** — Node creation from external sources is handled by import adapters, not this API.
