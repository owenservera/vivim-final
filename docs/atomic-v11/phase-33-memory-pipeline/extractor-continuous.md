# Unit 33.2 — Knowledge Extractor Continuous Mode

**Fork ID:** 7.3 (v3: 6.3) | **Status:** `[x]` | **Class:** E

> **Audit (2026-07-13):** `KnowledgeExtractor` has no `extractIncremental(chunk)` method; extraction is batch/conversation-scoped only. Confirmed `[ ]`.
> **Implementation (2026-07-13):** Added `KnowledgeExtractor.extractIncremental(chunk)` — reuses the exact `extractFromMessage` logic (no prompt divergence), returns relation edges (entities/decisions/facts) for a single chunk. Wired into 33.1 via `MemoryIndexer` `onIndex` hook. 2 unit tests pass (chunk→edges; incremental matches batch output).
**Source spec:** `docs/atomic-v3-fork-canon/phase-07-memory-knowledge/6.3-extractor-continuous.md`
**Depends on:** 33.1 (indexing pipeline)

## Context
`KnowledgeExtractor` runs in batch (synthesis). Continuous mode extracts entities/relations incrementally as content is indexed, feeding the graph in near-real-time.

## Current State
- `src/engines/knowledge-extractor.ts` — batch extraction present.
- No streaming/incremental extraction path.

## Requirements
Extend `KnowledgeExtractor` with `extractIncremental(chunk)`:
- Operates on a single message/segment rather than a whole conversation.
- Emits relation edges (`memory_edge`) with confidence scores.
- Shares the same LLM/extraction prompt as batch mode (no divergence).

## Acceptance Criteria
1. `extractIncremental` returns edges for a single chunk.
2. Edges match batch-mode quality on the same input.
3. Wired into the 33.1 pipeline.
4. `bun run devops gate` passes.

## Tests
`tests/unit/engines/knowledge-extractor-continuous.test.ts` — chunk → expected edges; matches batch output for same text.

## DevOps
```powershell
bun run devops gate
```
