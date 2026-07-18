# Implementation Plan: Agentic Knowledge Graph Backbone

**Branch**: `018-agentic-knowledge-graph` | **Date**: 2026-07-18 | **Spec**: `specs/018-agentic-knowledge-graph/spec.md`

**Input**: Feature specification from `specs/018-agentic-knowledge-graph/spec.md`

## Summary

Introduce a canonical property-graph backbone (`GraphNode`/`GraphEdge`) that unifies the scattered graph-shaped data across the schema (`NlclGraphNode/Edge`, `Entity/EntityMention`, `MemoryLink`, `KernelTopology`, `WorkflowEdge`). The graph becomes the agent's reasoning substrate — traversable via `GraphEngine` (neighbors, BFS, shortest-path, semantic-nearest), accessible through a REST router, CLI commands, and capability surfaces. A live bridge materializes domain rows as graph nodes so the entire system is queryable as one graph without migrating existing tables.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod
**Storage**: SQLite via Prisma (dev.db)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (backend engines + API + CLI)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**: Depth-2 traversal < 100ms on SQLite with < 10k nodes and < 50k edges.
**Constraints**: Governor Canon (no engine imports BunCdpClient), Store Contracts (engines depend on interfaces), One Entry Point (new ops are UnifiedCapabilities).

## Constitution Check

- [x] Governor Canon: GraphEngine needs no CDP, no Chrome interaction
- [x] Store Contracts: GraphEngine depends on GraphStore contract only
- [x] One Entry Point: `graph.*` capabilities registered via `registerGraphCapabilities`
- [x] Custom errors: new `GraphError` class in `src/errors.ts`
- [x] TypeScript strict: no `any`, `type` imports, `.js` extensions
- [x] Tests: unit + integration + typecheck + lint gates

## Complexity Tracking

No constitution violations expected.

## Files Touched

### New Files
| File | Purpose |
|------|---------|
| `prisma/migrations/0001_graph_backbone/migration.sql` | New `GraphNode`, `GraphEdge` tables; drop `NlclGraphNode`, `NlclGraphEdge` |
| `src/storage/contracts/graph-store.ts` | `GraphStore` store contract |
| `src/storage/impl/graph-store-impl.ts` | Prisma-backed `GraphStore` implementation |
| `src/engines/graph-engine.ts` | `GraphEngine` — traversal logic |
| `src/engines/graph-bridge.ts` | Live bridge from domain tables → graph nodes/edges |
| `src/engines/graph-caps.ts` | Capability definitions for `graph.*` |
| `src/server/graph-router.ts` | REST router for `/api/graph/*` |
| `src/cli/commands/graph.ts` | CLI commands for graph traversal |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `GraphNode`, `GraphEdge`; remove `NlclGraphNode`, `NlclGraphEdge` |
| `src/errors.ts` | Add `GraphError` class |
| `src/engines/capability-bootstrap.ts` | Wire `registerGraphCapabilities` |
| `src/engines/nlcl/catalog.ts` | Add NL patterns for graph queries |
| `src/server/index.ts` | Mount `graph-router.ts`; add `graphEngine` to `ServerContext` |
| `src/server/nlcl-router.ts` | Repoint from `NlclGraph*` to `graphEngine` |
| `src/cli/index.ts` | Register `graph` builtin command |
| `docs/roadmap/ROADMAP.md` | Add G-006: Knowledge Graph Substrate |
| `docs/roadmap/INVARIANTS.md` | Add graph invariants |

### Test Files
| File | Purpose |
|------|---------|
| `tests/unit/engines/graph-engine.test.ts` | Unit tests for traversal + CRUD |
| `tests/unit/engines/graph-bridge.test.ts` | Unit tests for domain→graph bridge |
| `tests/unit/storage/graph-store.test.ts` | Unit tests for store contract impl |
| `tests/integration/api/graph.test.ts` | Integration tests for graph router |

## Implementation Order

| Step | Description | Files |
|------|-------------|-------|
| 1 | Schema: add `GraphNode`, `GraphEdge`, drop `NlclGraphNode`/`NlclGraphEdge` | `prisma/schema.prisma` |
| 2 | Error class: `GraphError` | `src/errors.ts` |
| 3 | Store contract + impl | `src/storage/contracts/graph-store.ts`, `src/storage/impl/graph-store-impl.ts` |
| 4 | GraphEngine: traversal + CRUD | `src/engines/graph-engine.ts` |
| 5 | GraphBridge: live domain sync | `src/engines/graph-bridge.ts` |
| 6 | Capability registration | `src/engines/graph-caps.ts`, `src/engines/capability-bootstrap.ts` |
| 7 | NLCL catalog entries | `src/engines/nlcl/catalog.ts` |
| 8 | REST router | `src/server/graph-router.ts`, `src/server/index.ts` |
| 9 | CLI commands | `src/cli/commands/graph.ts`, `src/cli/index.ts` |
| 10 | Repoint NLCL router | `src/server/nlcl-router.ts` |
| 11 | Migration generation | `prisma/migrate dev` |
| 12 | Unit tests | GraphEngine + GraphBridge + GraphStore |
| 13 | Integration tests | Graph router API |

## Verification

1. `bunx prisma validate` + `bunx prisma generate` green
2. `bun run typecheck` green (0 src/ errors)
3. `bun test tests/unit/engines/graph-engine.test.ts` — BFS, shortest-path, semantic-nearest correct
4. `bun run devops verify-cross-surface` — all `graph.*` capabilities resolve across cli/api/ui
5. Manual: `bun run cli graph neighbors provider:claude` returns connected graph
