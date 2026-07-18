# Product Goals

**Status:** PENDING — goals defined, awaiting implementation

## G-001: Consumer Chat MVP
**Status:** ACTIVE
**Primary Phases:** 11, 12, 13
**Description:** "I can talk to multiple AI providers in one app"

## G-002: Agentic Capabilities
**Status:** ACTIVE
**Primary Phases:** 14
**Description:** "AI can browse the web and act on my behalf"

## G-003: Visual Workflows
**Status:** ACTIVE
**Primary Phases:** 15
**Description:** "I can build automations visually"

## G-004: Memory & Learning
**Status:** ACTIVE
**Primary Phases:** 16
**Description:** "The system learns from my interactions"

## G-005: Production Quality
**Status:** ACTIVE
**Primary Phases:** 17, 18, 19, 20
**Description:** "The app is reliable, secure, and performant"

---

## G-006: Knowledge Graph Substrate
**Status:** PLANNED ⏳
**Primary Phase:** 21
**Spec:** `specs/018-agentic-knowledge-graph/spec.md`
**Plan:** `specs/018-agentic-knowledge-graph/plan.md`
**Tasks:** `specs/018-agentic-knowledge-graph/tasks.md`
**Description:** Canonical property-graph backbone for agentic-native reasoning

### Objectives

#### OBJ-6.1: Canonical Graph Schema
**Status:** PLANNED
**Description:** Unify scattered graph-shaped data into `GraphNode`/`GraphEdge` backbone

**Key Results:**
| KR | Metric | Target | Current |
|----|--------|--------|---------|
| KR-6.1.1 | GraphNode model defined with all fields | Implemented | — |
| KR-6.1.2 | GraphEdge model defined with provenance | Implemented | — |
| KR-6.1.3 | NlclGraphNode/Edge fully removed | Removed | — |
| KR-6.1.4 | Migration verified green | pass | — |

#### OBJ-6.2: Graph Traversal Engine
**Status:** PLANNED
**Description:** Engine with BFS, shortest-path, semantic-nearest, subgraph extraction

**Key Results:**
| KR | Metric | Target | Current |
|----|--------|--------|---------|
| KR-6.2.1 | neighbors(depth) returns correct subgraph | Depth-2 in < 100ms | — |
| KR-6.2.2 | shortestPath(f,t) returns minimal edge list | All test cases pass | — |
| KR-6.2.3 | semanticNearest(text, k) returns top-k matches | 10 test cases pass | — |
| KR-6.2.4 | subgraph(kinds) filters correctly | 10 test cases pass | — |

#### OBJ-6.3: Live Domain Bridge
**Status:** PLANNED
**Description:** One-way materialization from domain tables to graph nodes/edges

**Key Results:**
| KR | Metric | Target | Current |
|----|--------|--------|---------|
| KR-6.3.1 | Provider → graph node (lazy on read) | Within 1s of create | — |
| KR-6.3.2 | Conversation → graph node | Within 1s of create | — |
| KR-6.3.3 | Entity → graph node + edge | Within 1s of create | — |
| KR-6.3.4 | SemanticMemory → fact node + edge | Within 1s of create | — |

#### OBJ-6.4: Cross-Surface Availability
**Status:** PLANNED
**Description:** Graph capabilities exposed via CLI, API, UI, and capability registry

**Key Results:**
| KR | Metric | Target | Current |
|----|--------|--------|---------|
| KR-6.4.1 | graph.neighbors registered capability | surfaces: [cli, api, ui] | — |
| KR-6.4.2 | graph.path registered capability | surfaces: [cli, api, ui] | — |
| KR-6.4.3 | graph.link registered capability | surfaces: [cli, api, ui] | — |
| KR-6.4.4 | graph.search registered capability | surfaces: [cli, api, ui] | — |
| KR-6.4.5 | graph.subgraph registered capability | surfaces: [cli, api, ui] | — |
| KR-6.4.6 | CLI commands all functional | 7 commands | — |
| KR-6.4.7 | API endpoints all functional | 9 endpoints | — |
| KR-6.4.8 | cross-surface verification passes | All 5 caps | — |
