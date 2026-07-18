# Feature Specification: Agentic Knowledge Graph Backbone

**Feature Branch**: `018-agentic-knowledge-graph`

**Created**: 2026-07-18

**Status**: Draft

**Input**: Architectural requirement for agentic-native database substrate

## Summary

The vivim-final DB currently has ~80+ relational tables with scattered graph-shaped data (`NlclGraphNode/Edge`, `Entity/EntityMention`, `MemoryLink`, `KernelTopology`, `WorkflowEdge`, `SemanticMemory` triples) but no unified graph substrate. An **agentic-native** system requires the database to *behave* as a single canonical property graph so the agent can reason over and act on all concepts (providers, conversations, topics, entities, memories, workflows, tools, messages) through one uniform traversal primitive.

This feature introduces a canonical `GraphNode`/`GraphEdge` backbone, a `GraphEngine` with BFS/shortest-path/semantic-nearest traversal, a live bridge from domain tables, and full CLI+API+capability surfaces — making the agent's reasoning substrate a first-class citizen of the codebase.

## User Scenarios

### User Story 1 — Agent traverses the knowledge graph (P1)

**As an** AI agent reasoning about user context,
**I want** to traverse from a provider → its conversations → topics → entities → related memories in one API call,
**So that** I can answer "what do I know about X?" without stitching 5 separate queries.

**Why this priority**: This is the core value — unified agentic reasoning over the entire data model.

**Independent Test**: Call `GET /api/graph/neighbors?nodeRef=provider:claude&depth=2` → receives conversations, topics, entities connected. Testable without UI.

**Acceptance Scenarios**:
1. **Given** a node `provider:claude` exists, **When** I query neighbors with depth 2, **Then** I receive conversations → topics → entities in a single response.
2. **Given** no edge exists between two nodes, **When** I query shortest path, **Then** `[]` is returned.
3. **Given** a graph with connected nodes, **When** I query shortest path between A and B, **Then** the minimal edge list is returned.

### User Story 2 — Agent links concepts manually (P1)

**As an** AI agent observing user behavior,
**I want** to assert a new relationship (e.g., "this conversation is about project X"),
**So that** the graph grows richer with every interaction without schema migrations.

**Why this priority**: Dynamic edge creation is what makes it agentic-native vs. static relational.

**Independent Test**: `POST /api/graph/link { from, to, relation, source }` → edge created and persisted.

**Acceptance Scenarios**:
1. **Given** two existing nodes, **When** I link them with relation `belongs_to`, **Then** the edge is stored.
2. **Given** a link call with `source: "extracted"`, **When** I query the edge, **Then** provenance is visible.
3. **Given** a retract call, **When** I query the edge, **Then** it no longer exists.

### User Story 3 — Semantic search over graph (P2)

**As an** agent searching for relevant context,
**I want** to find nodes by semantic similarity (text embedding),
**So that** I find "the conversation about deployment" even when no explicit edge says "deployment".

**Why this priority**: Semantic search over the graph enables fuzzy context retrieval, critical for agent RAG.

**Independent Test**: `GET /api/graph/search?q=deployment%20strategy&k=5` returns top-5 matching nodes by label+embedding.

**Acceptance Scenarios**:
1. **Given** nodes with labels containing "deployment", **When** I search for "deployment strategy", **Then** they appear.
2. **Given** nodes have embedding vectors, **When** I search, **Then** cosine-similarity ordering is used.
3. **Given** no matching nodes, **When** I search, **Then** an empty array is returned.

### User Story 4 — Subgraph extraction (P2)

**As an** agent or CLI user,
**I want** to extract a typed slice of the graph (e.g., "all provider + conversation nodes"),
**So that** I can analyze or visualize specific domains.

**Why this priority**: Subgraph extraction powers UI visualization and targeted agent reasoning.

**Independent Test**: `GET /api/graph/subgraph?kinds=provider,conversation` returns all nodes of those kinds.

**Acceptance Scenarios**:
1. **Given** a populated graph, **When** I filter by kind `provider`, **Then** only provider nodes are returned.
2. **Given** a filter by relations, **When** I query, **Then** only edges of those types are included.

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a canonical `GraphNode`/`GraphEdge` model in Prisma schema.
- **FR-002**: `GraphNode` MUST support fields: `id`, `kind`, `label`, `refId`, `dataJson`, `embedding` (optional Float32 array), `createdAt`, `updatedAt`.
- **FR-003**: `GraphEdge` MUST support fields: `id`, `fromId`, `toId`, `relation`, `weight`, `source`, `confidence`, `dataJson`, `createdAt`, `expiresAt`.
- **FR-004**: System MUST provide a `GraphStore` contract with CRUD + traversal queries.
- **FR-005**: System MUST provide a `GraphEngine` with methods: `neighbors(id, depth)`, `shortestPath(from, to)`, `subgraph(kinds, relations)`, `semanticNearest(text, k)`.
- **FR-006**: System MUST provide a live bridge from domain tables (provider, conversation, topic, entity, semantic memory) to graph nodes/edges.
- **FR-007**: System MUST register `graph.*` capabilities with `surfaces: ['cli', 'ui', 'api']`.
- **FR-008**: System MUST expose a `GET/POST /api/graph/*` REST router.
- **FR-009**: System MUST expose CLI commands: `graph neighbors`, `graph path`, `graph link`, `graph search`, `graph subgraph`.
- **FR-010**: System MUST delete or deprecate redundant `NlclGraphNode`/`NlclGraphEdge` models (superseded by canonical graph).
- **FR-011**: System MUST emit `graph:node_added`, `graph:edge_added`, `graph:edge_retracted` events on the EventBus.
- **FR-012**: All traversal operations MUST respect a max-depth limit (default 5) to prevent runaway queries.

### Key Entities

- **GraphNode**: A typed, addressable vertex in the canonical graph. `kind` identifies the domain (provider, conversation, topic, entity, fact, rule, tool, message, workflow). `refId` links back to the source table row. `embedding` stores a Float32 vector for semantic nearest-neighbor search.
- **GraphEdge**: A typed, weighted, directed, provenance-tracked edge. `relation` is the semantic type (mentions, belongs_to, depends_on, derived_from, next, etc.). `source` indicates how the edge was created (system, extracted, asserted, derived). `confidence` enables probabilistic reasoning. `expiresAt` supports temporal edges.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Agent can retrieve a depth-2 subgraph from any node in < 100ms (SQLite, < 10k nodes).
- **SC-002**: 100% of domain tables (provider, conversation, topic, entity) are represented as graph nodes within 1s of creation.
- **SC-003**: CLI `graph neighbors` and `graph path` commands produce correct output for all test cases.
- **SC-004**: `NlclGraphNode`/`NlclGraphEdge` are fully removed with no regressions in NLCL engine.

## Assumptions

- Embedding generation for semantic search uses an external provider; v1 ships with text-only fallback (label contains / LIKE) and an optional embedding column for future wiring.
- Graph size is < 100k nodes for v1; traversal depth and indexing will be reevaluated at scale.
- The existing domain tables remain the source of truth; the graph is a cached/traversal-aware materialization (eventually consistent via bridge).
