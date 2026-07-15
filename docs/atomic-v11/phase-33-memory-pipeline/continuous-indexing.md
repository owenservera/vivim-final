# Unit 33.1 — Continuous Indexing Pipeline

**Fork ID:** 7.2 (v3: 6.2) | **Status:** `[x]` | **Class:** C

> **Audit (2026-07-13):** No `memory-indexer` / continuous indexing worker. `KnowledgeExtractor` runs batch-only (via synthesis). No event-driven embedding pipeline. Confirmed `[ ]`.
> **Implementation (2026-07-13):** Added `src/engines/memory-indexer.ts` (`MemoryIndexer`) — subscribes to `conversation:complete` on `CapabilityEventBus`, debounces (default 50ms), batches embeddings via `EmbeddingProvider`, idempotent upsert into `memory_embedding` (`SemanticSearchStore`), resumable cursor (`IndexCursorStore`), concurrency cap. 3 unit tests pass (index → 3 nodes; restart no-duplicates; concurrency cap).
**Source spec:** `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.2-continuous-indexing.md`
**Depends on:** Phase 7 embeddings (7.1 `[~]`), memory graph API (7.5 `[~]`)

## Context
Memory is indexed on-demand. A continuous pipeline keeps the knowledge graph fresh as conversations land, without a manual re-index.

## Current State
- `src/engines/knowledge-extractor.ts` exists (used by synthesis 7.4).
- Embedding provider interface present (7.1).
- No background worker / queue that triggers indexing on conversation write.

## Requirements
New `src/engines/memory-indexer.ts` (or extend `KnowledgeExtractor`):
- Subscribe to conversation/message write events (via `CapabilityEventBus`).
- Debounced batch embedding of new content → upsert into `memory_node` / `memory_edge`.
- Resumable cursor (last-indexed message id) so restarts don't re-index.
- Backpressure + concurrency cap; idempotent upserts.

## Acceptance Criteria
1. New message → within a bounded delay, its embeddings appear in the memory graph.
2. Restart resumes from last cursor (no full re-index).
3. Duplicate content yields idempotent nodes (no fan-out).
4. `bun run devops gate` passes.

## Tests
`tests/unit/engines/memory-indexer.test.ts` — emit 3 messages → graph gets 3 nodes; restart → no duplicates; concurrency cap respected.

## DevOps
```powershell
bun run devops gate
```
