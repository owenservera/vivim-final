# Local Source-Code Indexing for LLM / Vibe Coding — Research Report

*Generated: 2026-07-20 | Sources: 22 | Confidence: High*

> Companion artifacts:
> - Brief: [`../briefs/local-code-indexing-llm-brief.md`](../briefs/local-code-indexing-llm-brief.md)
> - Evidence: [`../evidence/local-code-indexing-llm/sources.json`](../evidence/local-code-indexing-llm/sources.json)
> - Code path: [`../code-paths/local-code-indexing-llm-path.md`](../code-paths/local-code-indexing-llm-path.md)
>
> **Why this report exists:** the devops system (`devops/`) needs a first-class,
> local, offline indexing command so that the devops loop and its sub-agents
> stop grepping/reading whole files and instead retrieve ranked `path:line`
> packets. This is the "context engine" that eliminates the 60–70% exploration
> token tax of vibe coding.

---

## Executive Summary

In 2026 a mature, convergent category of **local-first code retrieval engines for
AI coding agents** exists. The consensus architecture is now stable and
well-evidenced across ~12 independent implementations: **Tree-sitter AST
chunking at definition boundaries → hybrid retrieval (lexical FTS5/BM25 +
optional local embeddings fused with Reciprocal Rank Fusion) → token-budgeted
`path:line` retrieval packets, served over an MCP server, stored in a single
local SQLite/Binary file, fully offline, no API keys.**

The decisive 2026 differentiator is **static embeddings**: Semble
(`potion-code-16M`, a 16M-param Model2Vec distilled model) removes the
transformer forward pass entirely, giving ~1.5 ms/query on CPU at 99% of
transformer retrieval quality and **~98% fewer tokens than grep+read**
([Semble](https://github.com/MinishLab/semble), [Show HN](https://bittide.aicompass.dev/article/25439c18-c0f3-46ea-a6d5-03d7e7990372)).
For our **Bun + TypeScript** stack the cleanest native fit is a build of the
same architecture into `devops/code-index.ts` (Bun has built-in `Bun.sqlite`
with FTS5; tree-sitter WASM is optional). This matches `codemogger` (Bun-native
library), `codebase-index` (FTS5 + graph), and `Semble` (static embed + BM25 +
RRF) — and is exactly what the devops loop needs.

---

## 1. The Problem These Tools Solve (and Why "Vibe Coding" Needs Them)

Vibe coding is the freestyle, conversational build style. Its cost driver is
**exploration**: when an agent gets a broad instruction ("add rate limiting to
the signup flow") it must read model, routes, services, config to understand
where things live. **60–70% of input tokens in a typical vibe session are
exploration, not the task** ([vexp blog](https://vexp.dev/blog/vibe-coding-is-fun-until-the-bill-arrives-token-optimization-guide)).
A pre-computed dependency/retrieval graph collapses that exploration tax: one
call returns the 5 relevant symbols instead of 15 file reads.

The agentic pain loop every tool targets (verbatim from
[codegraph](https://github.com/isink17/codegraph) / [codescope-mcp](https://github.com/abdulmunimjemal/codescope-mcp)
/ [Engram](https://github.com/bobaba76/Engram)): `grep` → `read` whole file →
`grep` callers → `read` those files. A local index answers "where is `X`, what
calls it, what's in this file" in a handful of tokens and one tool call.

Measured savings (primary sources):
- **Semble**: ~98% fewer tokens than grep+read; 94% recall at a 2k-token budget vs grep+read needing 100k context for 85% ([Semble benchmarks](https://github.com/MinishLab/semble/tree/main/benchmarks)).
- **CodeStory**: −43% context tokens, −45% wall time, −87% tool calls on 18 OSS tasks ([CodeStory](https://github.com/TheGreenCedar/CodeStory)).
- **codescope-mcp**: ~70–98% fewer tokens than reading a 2,500-file repo; ~0.5 ms refresh per file ([codescope-mcp](https://github.com/abdulmunimjemal/codescope-mcp)).
- **VibeRAG**: sub-agent delegation over the index uses ~8× fewer tokens than direct calls ([VibeRAG](https://registry.npmjs.org/viberag)).

## 2. The Convergent SOTA Architecture

Across all mature tools the pipeline is identical ([agentic-rag](https://github.com/alihashim786/agentic-rag-codebase-assistant), [CodeRAG](https://github.com/maciek-O-digiaidev/CodeRAG), [codebase-indexer](https://github.com/faktenforum/codebase-indexer), [codemogger](https://github.com/glommer/codemogger)):

```
repo files ──▶ scan (.gitignore, size caps) ──▶ chunk (tree-sitter AST @ def boundaries)
        ──▶ [optional] embed locally ──▶ store (SQLite FTS5 + vector)
query ──▶ lexical (BM25/FTS5) + semantic (vector) ──▶ RRF fusion ──▶ rerank ──▶ token-budgeted path:line packets
```

### 2.1 Chunking — AST, not lines
Text/line splitters cut functions mid-body and destroy structure. **Every**
SOTA tool parses with tree-sitter (WASM, no native build) and extracts
functions/classes/methods/structs with `path` + `start_line`/`end_line`
([codemogger](https://github.com/glommer/codemogger), [CodeRAG](https://github.com/maciek-O-digiaidev/CodeRAG), [semble](https://github.com/MinishLab/semble)).
Items >150 lines are split into sub-items ([codemogger](https://github.com/glommer/codemogger)).
Markdown splits at headings; everything else falls back to fixed windows
([code-context](https://github.com/infino-ai/code-context)).

### 2.2 Hybrid retrieval + RRF
Vector search misses exact identifiers (`verify_jwt_token`); BM25 misses
paraphrases. **RRF fusion of lexical + semantic is the standard** ([agentic-rag](https://github.com/alihashim786/agentic-rag-codebase-assistant), [CodeRAG](https://github.com/maciek-O-digiaidev/CodeRAG), [semble](https://github.com/MinishLab/semble), [codebase-rag](https://github.com/di5rupt0r/codebase-rag)).
Code-aware reranking boosts definitions over references, stems identifiers
(`parseConfig` matches `parse config`), down-ranks test/legacy/`.d.ts` noise
([semble](https://github.com/MinishLab/semble)).

### 2.3 The 2026 edge: static embeddings (no transformer at query time)
Semble's `potion-code-16M` / `potion-code-16M-v2` is a **static Model2Vec**
model distilled from CodeRankEmbed: 16M params, 256-dim, **no forward pass at
query time** ([potion-code-16M-v2](https://huggingface.co/minishlab/potion-code-16M-v2)).
Result: ~250 ms index of an average repo, ~1.5 ms/query on CPU, NDCG@10 0.854
— 99% of a 137M transformer at ~200× faster indexing ([Semble](https://github.com/MinishLab/semble)).
This is the state of the art for token-efficiency + speed in 2026.

### 2.4 Local-first, offline, single artifact
No Docker/API keys: SQLite (FTS5) for [codebase-index](https://github.com/denfry/codebase-index)
/ [codemogger](https://github.com/glommer/codemogger), a single Go binary for
[codegraph](https://github.com/isink17/codegraph), Parquet+vector for
[code-context](https://github.com/infino-ai/code-context), a `.db` file for
[Engram](https://github.com/bobaba76/Engram). Secret redaction masks keys/tokens
in snippets ([codebase-index](https://github.com/denfry/codebase-index)).

### 2.5 Incremental + watch
Content-hash (SHA-256) or size+mtime prefilter → only changed files re-chunk
([codemogger](https://github.com/glommer/codemogger), [Neverdecel/CodeRAG](https://github.com/Neverdecel/CodeRAG),
[semble](https://github.com/MinishLab/semble)). A watcher re-indexes per-file on
save ([codescope-mcp](https://github.com/abdulmunimjemal/codescope-mcp),
[codegraph](https://github.com/isink17/codegraph)).

### 2.6 MCP surface
All mature tools ship an **MCP (stdio) server** so agents call `search`/`find_symbol`/`callers`/`impact` as a native tool instead of grep loops
([codebase-index](https://github.com/denfry/codebase-index), [codemogger](https://github.com/glommer/codemogger),
[codegraph](https://github.com/isink17/codegraph), [Semble](https://github.com/MinishLab/semble),
[Engram](https://github.com/bobaba76/Engram)). Sub-agents cannot call MCP
directly in Claude Code/Codex, so a **CLI path is required alongside MCP**
([Semble](https://github.com/MinishLab/semble)).

## 3. Candidate Solutions (evaluated)

| Tool | Stack | Chunking | Retrieval | Semantic | MCP | Fit for us |
|------|-------|----------|-----------|----------|-----|-----------|
| **Semble** | Python | tree-sitter + Chonkie | BM25 + **static embed** + RRF | potion-code-16M (no query-time TF) | ✅ | Best SOTA, but Python/runtime dep |
| **codemogger** | **Bun/TS** | tree-sitter WASM | FTS + vector (Turso) | all-MiniLM-L6-v2 local | ✅ | **Native stack match** |
| **codebase-index** | Python | tree-sitter + graph | FTS5 + graph + opt embed | opt-in | ✅ | Most mature, token-budgeted |
| **codegraph** | Go binary | tree-sitter | FTS5 + vector (Ollama) + 29 tools | Ollama | ✅ | Single binary, graph-rich |
| **codescope-mcp** | TS | tree-sitter | trigram FTS5 + graph | none (graph-only) | ✅ | Fast, accurate callers |
| **Engram** | Py/TS | multi-parser | DuckDB + Kuzu + LanceDB | opt | ✅ | Multi-store, risk heuristics |
| **VibeRAG** / **vibe-hnindex** | TS/npm | tree-sitter | LanceDB/Qdrant + FTS5 | Ollama/Qdrant | ✅ | "vibe coding" branded |
| **vibe-index** (Rust) | Rust | positional phrase | exact-line + BM25 | none (complements) | ✅ | 100–1000× faster exact line |

**Decision (detail in brief):** build the SOTA architecture **natively into
`devops/code-index.ts`** using Bun's built-in `Bun.sqlite` (FTS5) + structural
chunking (tree-sitter WASM optional) + hybrid lexical/semantic + RRF + token
budget + MCP-ready JSON. This is offline, zero-dependency, and matches the
consensus while fitting our Bun/TS stack like `codemogger`.

## 4. Key Takeaways

1. **Architecture is settled** — AST chunk → hybrid lexical+semantic RRF →
   token-budgeted `path:line` → offline SQLite → MCP. Build to this, don't
   invent.
2. **Static embeddings are the 2026 edge** — `potion-code-16M` removes the
   query-time transformer, giving ~1.5 ms/query and ~98% token savings. Treat
   as the semantic upgrade path (pluggable embedder).
3. **Keyword-only must work with zero config** — default to FTS5/BM25 so the
   command is instant and offline; gate embeddings behind an opt-in flag.
4. **Ship CLI + MCP** — sub-agents can't call MCP, so the devops loop and
   sub-agents need a CLI surface (`devops code-index search`).
5. **Incremental + watch** — hash-gated re-index; never rebuild from scratch.
6. **Token budget is the product** — return `path:line` ranges, not files;
   honor a `--token-budget` so the agent reads less.

## 5. Sources

1. [Semble (MinishLab)](https://github.com/MinishLab/semble) — static embed + BM25 + RRF, 98% token savings.
2. [potion-code-16M-v2](https://huggingface.co/minishlab/potion-code-16M-v2) — 16M-param static code embed model.
3. [codemogger](https://github.com/glommer/codemogger) — Bun/TS indexer, tree-sitter + FTS + vector.
4. [codebase-index](https://github.com/denfry/codebase-index) — FTS5 + tree-sitter + graph, token-budgeted.
5. [codegraph](https://github.com/isink17/codegraph) — Go binary symbol graph, 29 MCP tools.
6. [codescope-mcp](https://github.com/abdulmunimjemal/codescope-mcp) — watch-first symbol graph, 21 langs.
7. [Engram](https://github.com/bobaba76/Engram) — DuckDB + Kuzu + LanceDB multi-store.
8. [code-context](https://github.com/infino-ai/code-context) — Parquet+vector, SQL search table-fn.
9. [agentic-rag-codebase-assistant](https://github.com/alihashim786/agentic-rag-codebase-assistant) — BM25+vector+RRF+rerank rationale.
10. [CodeRAG](https://github.com/maciek-O-digiaidev/CodeRAG) — AST chunk + NL enrichment + hybrid + graph.
11. [codebase-indexer](https://github.com/faktenforum/codebase-indexer) — tree-sitter + LanceDB hybrid.
12. [Neverdecel/CodeRAG](https://github.com/Neverdecel/CodeRAG) — local-first zero-key, fastembed.
13. [codebase-rag](https://github.com/di5rupt0r/codebase-rag) — ChromaDB + tree-sitter + RRF.
14. [CodeStory](https://github.com/TheGreenCedar/CodeStory) — knowledge graph, −43% tokens.
15. [vibe-index (Rust)](https://github.com/mladenpop-oss/vibe-index) — exact positional phrase search.
16. [VibeRAG](https://registry.npmjs.org/viberag) — LanceDB MCP, sub-agent token savings.
17. [vibe-hnindex](https://github.com/AndyAnh174/vibe-hnindex) — FTS5 + Qdrant + Ollama.
18. [dotvibe](https://github.com/soverant/dotvibe) — SurrealDB pattern memory for agents.
19. [vibe-graph](https://github.com/eturner15/vibe-graph) — living source graph + MCP.
20. [vexp — Vibe Coding Token Optimization](https://vexp.dev/blog/vibe-coding-is-fun-until-the-bill-arrives-token-optimization-guide) — 60–70% exploration tax.
21. [Show HN: Semble](https://bittide.aicompass.dev/article/25439c18-c0f3-46ea-a6d5-03d7e7990372) — benchmark methodology.
22. [Semble MCP (mcp.so)](https://mcp.so/servers/semble) — MCP server config.

## Methodology

Searched ~12 keyword/semantic queries across web + HN + PyPI/npm + HuggingFace
(2026-07-20). Analyzed 22 distinct sources; prioritized official repos,
benchmarks, and the vexp cost analysis. Cross-referenced the architecture across
≥12 independent implementations to establish the convergent SOTA. Confidence:
High (architecture consensus is strong; token-savings are benchmark-backed by
primary sources).
