# Local Source-Code Indexing for LLM / Vibe Coding — Brief

**Source:** [full report](../reports/local-code-indexing-llm-sota-2026.md)
**Confidence:** High | **Sources:** 22 | **Date:** 2026-07-20

## TL;DR

A mature, convergent category of **local-first code retrieval engines for AI
coding agents** exists. The 2026 SOTA is: Tree-sitter AST chunking → hybrid
retrieval (lexical FTS5/BM25 + optional **static** embeddings via RRF) →
token-budgeted `path:line` packets → offline SQLite → MCP server. We will build
this architecture **natively into `devops/code-index.ts`** (Bun `Bun.sqlite`
FTS5, optional tree-sitter WASM) so the devops loop and its sub-agents stop
grepping and read ranked `path:line` packets instead.

## Key Decisions

1. **Build natively, don't vendor.** Our stack is Bun 1.3.14 + TypeScript.
   `Bun.sqlite` ships FTS5 with zero deps; `codemogger` proves the Bun/TS
   pattern works. Avoid adding a Python/Go/runtime dependency to the devops CLI.
2. **Keyword-only by default, embeddings opt-in.** Match
   [codebase-index](https://github.com/denfry/codebase-index) (`backend="noop"`)
   and [code-context](https://github.com/infino-ai/code-context): FTS5/BM25 works
   instantly offline; semantic is a pluggable flag.
3. **Static embeddings are the upgrade path.** Semble's `potion-code-16M`
   removes the query-time transformer → ~1.5 ms/query, ~98% token savings
   ([Semble](https://github.com/MinishLab/semble)). Design a `Embedder`
   interface so `potion-code-16M` / `all-MiniLM` can be plugged later.
4. **Token budget is the product.** Return `path:line` ranges, not whole
   files; honor `--token-budget`. This is the literal fix for the 60–70%
   exploration tax ([vexp](https://vexp.dev/blog/vibe-coding-is-fun-until-the-bill-arrives-token-optimization-guide)).
5. **Ship CLI + MCP.** Sub-agents can't call MCP directly ([Semble](https://github.com/MinishLab/semble)),
   so `devops code-index search` (CLI) is required; add an `mcp` subcommand for
   the top-level agent.

## Evidence Summary

- **Convergent architecture** across ≥12 tools (Semble, codemogger, codebase-index, codegraph, codescope-mcp, Engram, code-context, agentic-rag, CodeRAG, codebase-indexer, Neverdecel/CodeRAG, codebase-rag): AST chunk → hybrid RRF → token-budgeted path:line → offline store → MCP. (confidence: High)
- **Semble**: ~98% fewer tokens than grep+read; ~250 ms index, ~1.5 ms/query, NDCG@10 0.854, no query-time transformer. (confidence: High, primary benchmark)
- **Static embed `potion-code-16M`**: 16M params, 256-dim, distilled from CodeRankEmbed. (confidence: High)
- **codemogger** is Bun/TS-native with tree-sitter WASM + Turso FTS+vector; proves our stack can host this. (confidence: High)
- **Cost analysis**: 60–70% of vibe-coding input tokens are exploration; a context engine cuts this ~5–10×. (confidence: Medium, single-source blog w/ methodology)
- **Incremental by hash + watch** is universal (codemogger, Neverdecel/CodeRAG, semble, codescope-mcp). (confidence: High)

## Open Questions

- Exact embedding provider for the opt-in semantic path: local `potion-code-16M`
  (Python/runtime) vs `all-MiniLM-L6-v2` (ONNX/Transformers.js in Bun) — both
  need a download; defer to a follow-up unit.
- Whether to add graph edges (callers/callees/impact) now or in a v2 — the
  SOTA consensus includes it, but it's separable; v1 ships lexical+semantic+token
  budget, graph is a documented follow-up.

## Used In

- **CREATE unit: `devops/code-index.ts`** — local code indexing command for the devops system (this research is the A5 brief gate).
- `devops/index.ts` — new `code-index` subcommand registration.
- Devops loop / sub-agents — replace grep+read exploration with `devops code-index search`.
- Potential ADR: "Local code indexing as a devops primitive" (recommended).
