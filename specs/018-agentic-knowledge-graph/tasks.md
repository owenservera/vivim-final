# Tasks: Agentic Knowledge Graph Backbone

## G.1 — Schema & Model
<!-- bridge:unit=18.1 -->

- [ ] T001 Add `GraphNode` model to `prisma/schema.prisma` (id, kind, label, refId, dataJson, embedding, createdAt, updatedAt; unique on [kind, refId]; index on kind, label)
- [ ] T002 Add `GraphEdge` model to `prisma/schema.prisma` (id, fromId, toId, relation, weight, source, confidence, dataJson, createdAt, expiresAt; indexes on fromId, toId, relation, compound [fromId, relation])
- [ ] T003 Remove `NlclGraphNode` and `NlclGraphEdge` models from schema (superseded by GraphNode/GraphEdge)
- [ ] T004 Generate Prisma migration: `bunx prisma migrate dev --name graph_backbone`
- [ ] T005 Verify: `bunx prisma validate` green, `bunx prisma generate` succeeds

## G.2 — Error Classes
<!-- bridge:unit=18.2 -->

- [ ] T006 Add `GraphError`, `GraphNodeNotFoundError`, `GraphEdgeNotFoundError`, `GraphTraversalLimitError` to `src/errors.ts`

## G.3 — Store Contract
<!-- bridge:unit=18.3 -->

- [ ] T007 Define `GraphStore` interface in `src/storage/contracts/graph-store.ts` (upsertNode, getNode, deleteNode, findByRef, addEdge, getEdge, edgesFrom, edgesTo, retractEdge, setEmbedding, searchNeighbors with depth, shortestPath)
- [ ] T008 Implement `GraphStoreImpl` in `src/storage/impl/graph-store-impl.ts` (Prisma-backed; BFS traversal in SQL; shortest-path via iterative widening)

## G.4 — Graph Engine
<!-- bridge:unit=18.4 -->

- [ ] T009 Create `src/engines/graph-engine.ts` with `GraphEngine` class depending on `GraphStore` + `CapabilityEventBus`
- [ ] T010 Implement `addNode`, `getNode`, `link` — CRUD wrappers with EventBus emission
- [ ] T011 Implement `neighbors(id, {direction, relation?, depth?, limit?})` — BFS returning subgraph with `{nodes, edges}`
- [ ] T012 Implement `shortestPath(from, to, {relation?, maxDepth?})` — iterative-widening BFS
- [ ] T013 Implement `subgraph({kinds?, relations?, refIds?})` — typed slice extraction
- [ ] T014 Implement `semanticNearest(text, k, {kind?})` — text fallback (LIKE on label) with embedding column ready for future wiring

## G.5 — Graph Bridge
<!-- bridge:unit=18.5 -->

- [ ] T015 Create `src/engines/graph-bridge.ts` with `GraphBridge` class
- [ ] T016 Implement `ensureNode(kind, refId)` — lazy node materialization from domain table
- [ ] T017 Implement bridge for `ProviderDefinition` → node(kind=provider)
- [ ] T018 Implement bridge for `Conversation` → node(kind=conversation)
- [ ] T019 Implement bridge for `Entity` → node(kind=entity) + edge(mentions) to conversation
- [ ] T020 Implement bridge for `SemanticMemory` → node(kind=fact) + predicate edges
- [ ] T021 Implement bridge for `Topic`/`Project` → node + edges to conversations
- [ ] T022 Subscribe bridge to EventBus events (`memory:fact_asserted`, `conversation:created`, etc.) for live sync

## G.6 — Capability Registration
<!-- bridge:unit=18.6 -->

- [ ] T023 Create `src/engines/graph-caps.ts` with `registerGraphCapabilities` function
- [ ] T024 Register `graph.neighbors` capability (input: nodeRef, depth; output: {nodes, edges})
- [ ] T025 Register `graph.path` capability (input: from, to; output: {edges})
- [ ] T026 Register `graph.link` capability (input: from, to, relation, weight, source; output: edge)
- [ ] T027 Register `graph.search` capability (input: text, k, kind?; output: nodes[])
- [ ] T028 Register `graph.subgraph` capability (input: kinds?, relations?; output: {nodes, edges})
- [ ] T029 Wire `registerGraphCapabilities` into `registerDefaultCapabilities` in `src/engines/capability-bootstrap.ts`

## G.7 — NLCL Catalog
<!-- bridge:unit=18.7 -->

- [ ] T030 Add NL patterns to `src/engines/nlcl/catalog.ts`: "show me what's connected to X", "find path between A and B", "what's related to topic Y", "link X to Y", "search graph for Z"

## G.8 — REST Router
<!-- bridge:unit=18.8 -->

- [ ] T031 Create `src/server/graph-router.ts` with `createGraphRouter(graphEngine, graphBridge)`
- [ ] T032 Implement `GET /api/graph/node/:id` — get single node
- [ ] T033 Implement `GET /api/graph/neighbors?nodeRef=&depth=&relation=` — neighbors query
- [ ] T034 Implement `GET /api/graph/path?from=&to=&relation=&maxDepth=` — shortest path
- [ ] T035 Implement `GET /api/graph/search?q=&k=&kind=` — semantic/text search
- [ ] T036 Implement `GET /api/graph/subgraph?kinds=&relations=` — typed slice
- [ ] T037 Implement `POST /api/graph/link` — create edge
- [ ] T038 Implement `POST /api/graph/node` — upsert node
- [ ] T039 Implement `DELETE /api/graph/edge/:id` — retract edge
- [ ] T040 Mount `graph-router.ts` in `src/server/index.ts`; add `graphEngine` to `ServerContext`

## G.9 — CLI Commands
<!-- bridge:unit=18.9 -->

- [ ] T041 Create `src/cli/commands/graph.ts` with command tree
- [ ] T042 Implement `graph neighbors <ref> [--depth N] [--relation R]`
- [ ] T043 Implement `graph path <from> <to> [--maxDepth N]`
- [ ] T044 Implement `graph link <from> <to> --relation R [--weight W] [--source S]`
- [ ] T045 Implement `graph search "<text>" [--kind K] [--k N]`
- [ ] T046 Implement `graph subgraph --kinds provider,conversation`
- [ ] T047 Implement `graph node <id>` — get node details
- [ ] T048 Register `graph` builtin in `src/cli/index.ts` via `registerBuiltinCommands`

## G.10 — NLCL Router Repoint
<!-- bridge:unit=18.10 -->

- [ ] T049 Update `src/server/nlcl-router.ts` to use `graphEngine` instead of direct `NlclGraph*` Prisma access
- [ ] T050 Remove any remaining direct `NlclGraphNode`/`NlclGraphEdge` references

## G.11 — Seed Data
<!-- bridge:unit=18.11 -->

- [ ] T051 Create seed script `seeds/graph-seed.ts` that populates initial graph from existing domain data
- [ ] T052 Wire graph seeding into `seeds/index.ts`

## G.12 — Testing
<!-- bridge:unit=18.12 -->

- [ ] T053 Write unit tests for `GraphStoreImpl` (in-memory mock)
- [ ] T054 Write unit tests for `GraphEngine.neighbors` (depth 0, 1, 2; direction filter; relation filter; limit)
- [ ] T055 Write unit tests for `GraphEngine.shortestPath` (direct, multi-hop, no-path, maxDepth exceeded)
- [ ] T056 Write unit tests for `GraphEngine.semanticNearest` (text match, kind filter, no results)
- [ ] T057 Write unit tests for `GraphBridge` (ensureNode creates from domain, EventBus auto-link)
- [ ] T058 Write integration tests for graph router endpoints
- [ ] T059 Write integration tests for cross-surface verification

## G.13 — Roadmap & Documentation
<!-- bridge:unit=18.13 -->

- [ ] T060 Register G-006: Knowledge Graph Substrate as pending goal in ROADMAP.md
- [ ] T061 Update `docs/roadmap/INVARIANTS.md` with graph-related invariants
- [ ] T062 Update `docs/roadmap/GOALS.md` with G-006 objectives and key results
