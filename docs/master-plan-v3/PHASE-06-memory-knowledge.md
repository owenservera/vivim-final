# Phase 6: Memory & Knowledge Graph

**Status:** PROPOSED
**Units:** 10
**Depends on:** Phase 2
**Produces:** A semantic knowledge graph that the agent queries in flight, with cross-conversation synthesis and automatic entity extraction.

---

## Goal

The current memory system has episodic/semantic/procedural stores and a `MemoryEngine` that records + recalls, plus `ContextAssembly` that pulls context once per send. Phase 6 closes the gaps: (a) semantic search is default-on with real embeddings (not the current all-zeros stub), (b) cross-conversation synthesis actually works, (c) entity/decision/pattern extraction runs continuously, (d) the agent can query memory mid-loop via `memory:query` actions, (e) memory is exportable/importable per Phase 9.

---

## Units

### 6.1 Real embedding provider (local-first)
**Source:** v3 Overview §1.10
**Depends on:** 5.1
**Produces:** `OllamaEmbeddingProvider` implementing `EmbeddingProvider`.

Uses Ollama's `/api/embeddings` endpoint (`nomic-embed-text` model by default). Falls back to a TS-impl of MiniLM if no Ollama (slower but works offline). Replaces the noop embedding in `createServerWithEngines`.

### 6.2 Continuous indexing pipeline
**Source:** v3 Overview §1.5
**Depends on:** 6.1
**Produces:** Every conversation message + every asserted fact gets indexed automatically.

`MemoryEngine.recordEpisode` and `assertFact` trigger `SemanticSearchEngine.index` (async, queued, debounced). Existing `memory_embedding` table stores the vectors. Reindex on content hash change.

### 6.3 Knowledge extractor continuous mode
**Source:** v3 Overview §1.5
**Depends on:** 1.8
**Produces:** `KnowledgeExtractor` runs on every assistant message in the background.

Subscribe to `conversation:complete` events. For each completed assistant message, run `extractFromMessage`. Use the agent's reflection signal (from Phase 2 `AgenticConversationLoop`) to weight confidence — extracted facts from successful turns get +0.2 confidence boost.

### 6.4 Cross-conversation synthesis v2
**Source:** v3 Overview §1.5
**Depends:** 6.1, 6.2
**Produces:** `CrossConversationSynthesizer.synthesize` produces real answers grounded in actual embeddings + entities + decisions.

Current impl returns "LLM not configured". Phase 6 wires it to a local model (Ollama) by default, with cloud-LLM option. Synthesis includes source attribution + confidence + gap detection. Surfaces via `/api/knowledge/synthesize` and the capability `synthesize_across_conversations`.

### 6.5 Memory graph visualization data API
**Source:** v3 Overview §3 (MemoryBrowserSurface depends on this)
**Depends:** —
**Produces:** `MemoryGraphApi.{subgraph, neighbors, timeline, clusters}` endpoints.

Enables rendering the memory as a force-directed graph (entities as nodes, predicates as edges, confidence as edge weight). Returns JSON suitable for D3/cytoscape.

### 6.6 In-flight memory queries (agent action)
**Source:** v3 Overview §1.4 (AgenticConversationLoop.adapt depends on this)
**Depends:** 6.1
**Produces:** Capabilities `memory_query`, `memory_assert`, `memory_remember`, `memory_forget` registered in `UnifiedCapabilityRegistry`.

Agent can mid-loop say "what did I learn about this user's codebase last week?" via `memory_query`. Assertions during a loop (`memory_assert`) feed the graph immediately. Critical for adaptive behavior.

### 6.7 Memory curation surface wiring
**Source:** v3 Overview §3
**Depends:** 4.7, 6.5
**Produces:** `memory_curated` + `memory_feedback` tables actually populated by UI actions.

User can mark a fact as "verified" (pin), "wrong" (with correction), or "outdated" (with replacement). The correction becomes a new fact with higher confidence; the old fact is deprecated (not deleted).

### 6.8 Memory consolidation improvements
**Source:** v3 Overview §1.5
**Depends:** 6.3
**Produces:** `MemoryEngine.consolidate` runs continuously with smarter heuristics.

Existing consolidation runs every 5min and prunes low-confidence rules. Phase 6 adds: (a) merge duplicate entities (fuzzy match), (b) extract new patterns from episodic clusters, (c) promote high-confidence procedural rules into composite capabilities (hand-off to `CapabilityComposer`), (d) expire time-bound facts past `expiresAt`.

### 6.9 Memory import/export
**Source:** v3 Overview §1.10 (sovereign data)
**Depends:** Phase 9 encryption
**Produces:** Memory is part of the `ExportEngine` scope.

Export to JSON (with optional encryption). Import merges (with dedup via content hash). Critical for multi-device sync.

### 6.10 Memory browser surface (full)
**Source:** v3 Overview §3
**Depends:** 6.5, 6.7
**Produces:** The MemoryBrowserSurface from 4.7 fully populated with live data.

Three tabs: Episodes (timeline with filters), Facts (graph view + table view toggle), Rules (with success-rate sparklines). Curation actions wired to backend.

---

## Acceptance

- After 100 conversation turns, the memory graph has ≥50 entities and ≥100 facts with mean confidence ≥0.6.
- `memory_query("what did we decide about the database schema?")` returns relevant facts within 200ms.
- The agent in an agentic loop asserts a fact mid-loop; the next loop iteration sees it via recall.
- Memory export is a valid JSON file under 10MB for a typical 6-month usage pattern.
- MemoryBrowserSurface renders the graph in under 500ms with 500 nodes.
