# Feature Spec: LiteRT.js In-Browser ML Substrate

**Spec ID**: 031-litert-js-integration
**Date**: 2026-07-20
**Source Analysis**: `docs/research/reports/litert-js-integration-analysis-2026.md`

## 1. Problem

vivim-final routes every operation to remote LLM providers (chatgpt, claude, gemini, etc.). This incurs latency, cost, and privacy exposure for tasks that do not need a frontier model:

- Re-ranking knowledge-graph search results for "related node" hints
- Classifying a natural-language phrase as a local action vs. a remote provider call
- Captioning/understanding a media attachment before upload

Google's **LiteRT.js** (`@litertjs/core`) brings the native LiteRT runtime to the browser via Wasm/WebGPU/WebNN. It runs `.tflite` models with no server round-trip. This feature adds a **host-canvas ML substrate** that performs these tasks locally, falling through to the remote path when the model is unavailable or below confidence.

## 2. Hard Constraint (from code review)

LiteRT.js **MUST NOT** run inside `SandboxedNode`'s iframe. That sandbox uses `sandbox="allow-scripts"` (opaque origin → separate WebGPU device), a CSP `<meta>`, and a `budgetMs` watchdog that deterministically leaks manually-managed tensors. LiteRT.js runs in the **host canvas** and is exposed to sandboxes only through the existing `CapabilityBus` (same as every other capability).

## 3. Goals

1. **G1** — Host-canvas ML runtime that loads `.tflite` models (EmbeddingGemma for embeddings) with Wasm/WebGPU backends, dynamic-imported `ssr:false`.
2. **G2** — Local knowledge-graph re-ranking: take server `searchKnowledge` results and re-rank by cosine similarity of local embeddings; surface as a `canvas.related` slot (RelatedNodes).
3. **G3** — Local NL pre-router in `Composer`: a tiny classification model suggests local actions and falls through to `useInterpret()`/`sendMessage` for remote handling.
4. **G4** — Client-side media understanding in `MediaCard`: local caption/label for image attachments.
5. **G5** — All ML capabilities registered as `UnifiedCapability` with `surfaces:['ui']`, exposed to sandboxes via `CapabilityBus` under `cap:ml:*`.

## 4. Non-Goals

- No server-side inference (LiteRT.js is browser-only; cannot run in Bun).
- No replacement of remote providers — ML is a pre/post step only.
- No local LLM generation in this feature (LiteRT-LM.js deferred to a later phase).

## 5. Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| R1 | `createEmbedRuntime()` initializes LiteRT.js with `getWebGpuDevice()` (WebGPU) falling back to Wasm | P0 |
| R2 | Embedding model loaded from `public/ml/embeddinggemma.tflite` via `loadModel` | P0 |
| R3 | `embed(text): number[]` returns a normalized vector; `cosine(a,b)` util provided | P0 |
| R4 | RelatedNodes slot reads current node + server `searchKnowledge`, re-ranks, renders top-K | P0 |
| R5 | Runtime lazily initialized on first use; `AbortController` + 5s timeout; errors fall back to server order | P0 |
| R6 | NL pre-router model classifies phrase; low-confidence → remote path | P1 |
| R7 | MediaCard runs local caption model on user-selected image; UI shows "local caption" badge | P1 |
| R8 | All ML ops wrapped as `cap:ml:*` capabilities (`surfaces:['ui']`) so sandboxes consume via `CapabilityBus` | P1 |
| R9 | Runtime state in Zustand store; model fetch/exec wrapped in React Query for caching | P1 |
| R10 | `dynamic(() => import('@litertjs/core'), { ssr:false })` — never imported on server | P0 |

## 6. Constraints

- **Governor Canon** — N/A (frontend-only; no CDP).
- **Store Contracts** — N/A (no Prisma writes; ML state is client-only).
- **One Entry Point** — ML ops are `UnifiedCapability`s with `surfaces:['ui']`; sandboxes reach them only through `CapabilityBus` (mirrors existing `cap:*` consumption).
- **Slot IDs** — new slot must use namespaced ID `canvas.related` (per `web/ui/src/ui/slots.ts` convention).
- **No server import** — `@litertjs/core` is browser-only; guard with `ssr:false` dynamic import.
- **Privacy** — embeddings computed locally; raw text never leaves browser for re-ranking.

## 7. Success Metrics

- RelatedNodes loads and re-ranks within 1s of node focus on a WebGPU-capable browser.
- NL pre-router reduces remote `interpret` calls for recognized local actions by >30% (measured via dev counter).
- Zero server round-trips for re-ranking / captioning.
- Build passes; no `tsc`/`lint` regressions in `web/ui`.

## 8. Open Questions (resolved in research.md)

- Q1: Which embedding model size (EmbeddingGemma 101M vs. smaller)? → 101M, INT4, WebGPU.
- Q2: Pre-router model source — train tiny TF class model or use keyword heuristic + small `.tflite`? → ship heuristic v1, model slot reserved.
- Q3: Media caption model — YOLO v11n vs. MobileNetV2 + caption head? → MobileNetV2 labels v1, caption deferred.
- Q4: How to ship `.tflite` weights (repo vs. CDN)? → `public/ml/`, git-lfs or postinstall fetch.
- Q5: WebGPU op-coverage risk for embedding model? → verified EmbeddingGemma runs on WebGPU delegate in `@litertjs/core` 0.2.1.
