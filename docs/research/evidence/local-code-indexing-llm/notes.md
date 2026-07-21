# Local Code Indexing for LLM / Vibe Coding — Evidence Notes

## Raw observations (unprocessed)

- The category is called "codebase indexing for AI coding agents" / "code
  context engine" / "vibe coding RAG". Recurring tagline: "stop grepping and
  reading whole files".
- Semble (MinishLab, python) is the token-efficiency leader: 98% fewer tokens
  than grep+read, ~250ms index, ~1.5ms query, NDCG@10 0.854. Uses
  potion-code-16M (static Model2Vec, 16M params, 256-dim). No transformer
  forward pass at query time → millisecond CPU latency.
- potion-code-16M-v2: distilled from CodeRankEmbed, trained on CornStack
  (6 langs: Python, Java, JS, Go, PHP, Ruby), max seq 1M tokens.
- codemogger: Bun/TypeScript, tree-sitter WASM (13 grammars), all-MiniLM-L6-v2
  (q8, 384-dim) local, Turso embedded SQLite w/ FTS + vector. Single .db.
  Benchmark: 39k-file TS repo → 242ms semantic / 4ms keyword vs 1500ms rg.
- codebase-index (python): SQLite FTS5 + tree-sitter + graph + opt embeddings,
  token-budgeted packets, MCP, PyPI. backend="noop" default (no embeddings).
- codegraph (Go): single binary, 29 MCP tools, FTS5+vector (Ollama), callers/
  callees/impact/dead-code, framework detection 20+.
- codescope-mcp (TS): watch-first symbol graph, 21 langs, trigram FTS5, kind-
  aware resolution; ~0.5ms refresh; beats codegraph on caller F1 in its bench.
- Engram (py/ts): DuckDB + Kuzu + LanceDB multi-store; risk heuristics;
  Windows-tested; C/C++ needs compile_commands.json.
- code-context (infino): Parquet+vector, SQL `bm25_search`/`hybrid_search` table
  fns, keyword-commits-first then vector backfill, GROUP BY aggregation win.
- agentic-rag: rationale for AST chunk > text split; BM25+vector+RRF; cross-
  encoder rerank (BGE).
- CodeRAG (TS): tree-sitter + NL enrichment (Ollama) + hybrid + graph + token
  budget; LanceDB/Qdrant; 2037 tests.
- codebase-indexer (TS): tree-sitter + LanceDB, OpenAI-compatible embeddings.
- Neverdecel/CodeRAG (py): local fastembed ONNX bge-small default, no key.
- codebase-rag (py): ChromaDB + tree-sitter + RRF (k=60).
- CodeStory: knowledge graph, −43% tokens / −45% wall / −87% tool calls (18 OSS).
- vibe-index (Rust): exact positional phrase search, 100-1000x faster than
  embeddings, complements semantic; hybrid BM25+Vibe.
- VibeRAG (npm, TS): LanceDB, sub-agent delegation = 8x fewer tokens.
- vibe-hnindex (npm): FTS5 + Qdrant + Ollama, 6 search modes, code_agent.
- dotvibe (Deno): SurrealDB + tree-sitter + Gemini embeddings.
- vibe-graph (Rust): living source graph, BGE-Small via fastembed, MCP.
- vexp blog: 60-70% of vibe input tokens = exploration; context engine ~58%
  cost cut; compact between tasks 40-50%; batch 50-60%.
- Show HN Semble: 94% recall at 2k-token budget vs grep+read 100k for 85%.

## Cross-cutting claims (to verify before impl)
- RRF k=60 is the standard fusion constant (codebase-rag, agentic-rag).
- Bun.sqlite supports FTS5 (need to confirm at impl time — Bun documents FTS5).
- Sub-agents cannot call MCP directly in Claude Code/Codex (Semble README) →
  CLI surface is mandatory.
