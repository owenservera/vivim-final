# LiteRT.js — Brief

**Source:** [full report](../reports/litert-js-sota-2026.md)
**Confidence:** High | **Sources:** 18 | **Date:** 2026-07-20

## TL;DR

LiteRT.js (Google, **2026-07-09**) is the native LiteRT on-device inference runtime
compiled to WebAssembly, running `.tflite` models in the browser with WASM/WebGPU/WebNN
backends — up to **3× faster** than TF.js and **5–60×** with GPU. It is a
**frontend-only, inference-only** runtime. For vivim-final the best fits are
**in-browser embeddings over the conversation knowledge graph**, a **local NL
pre-router**, and **client-side media understanding** — all privacy/latency/cost wins
that complement (not replace) the remote providers.

## Key Decisions

1. **Treat LiteRT.js as a frontend capability-global slot**, not a backend engine.
   It runs in-browser only; it cannot run provider inference server-side.
2. **Prioritize embeddings + NL pre-router first** (small models, clear privacy win).
   Defer fully-local LLM (LiteRT-LM.js / Gemma 4) unless an offline mode is scoped.
3. **Always ship WASM-CPU fallback** + assert fallback paths in tests (WebGPU/WebNN
   support varies by browser).
4. **Pin `@litertjs/core` (0.2.1, early release)** and lazy-load Wasm + models so the
   canvas bundle stays lean.
5. **Wrap as a `UnifiedCapability` (`surfaces: ['ui']`)** so it flows through the
   existing `/api/interpret` → capability contract (thin-client convention).

## Evidence Summary

- Google launch blog: native runtime, 3 backends, up to 3× vs web runtimes ([Source 1](https://developers.googleblog.com/litertjs-googles-high-performance-web-ai-inference/)) — confidence **High**
- GitHub core README: API (`loadLiteRt`, `loadAndCompile`, `Tensor`, `moveTo`, `delete`), 2 GB Wasm cap, per-op partitioning w/ JSPI ([Source 4](https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/packages/core/README.md)) — confidence **High**
- Community benchmark: 5–60× over CPU with WebGPU; WebNN experimental, don't ship prod ([Source 12](https://byteiota.com/litert-js-run-ai-models-in-the-browser-no-server)) — confidence **High**
- npm: `@litertjs/core` latest **0.2.1**, early/preview ([Source 8](https://www.npmjs.com/package/@litertjs/core)) — confidence **High**
- DeepWiki: `loadLiteRt` feature-detects SIMD/Threads/JSPI, loads matching Wasm pair ([Source 18](https://deepwiki.com/google-ai-edge/LiteRT/4.6-javascript-and-webassembly-api)) — confidence **High**
- LiteRT-LM.js is a *separate* package (`@litert-lm/core`) for Gemma 4 in-browser LLM ([Source 6](https://developers.google.com/edge/litert-lm/js)) — confidence **High**

## Open Questions

- Exact bundle-size budget for lazy-loaded Wasm + a small embedding model in `web/ui`.
- Whether vivim wants an offline/air-gapped mode (gates LiteRT-LM.js investment).
- Browser support matrix target (which Safari/Firefox versions to support for WebGPU).

## Used In

- (proposed) **ADR: In-browser ML via LiteRT.js** — frontend capability slot
- (proposed) **Unit: knowledge-graph semantic search (embeddings)** — canvas search
- (proposed) **Unit: local NL pre-router** — `CommandPalette`/`CapabilityBar`
- Frontend architecture review (`web/ui/src/components/canvas/*`)
