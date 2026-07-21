# Research: LiteRT.js In-Browser ML Substrate

**Feature**: 031-litert-js-integration
**Date**: 2026-07-20
**Inputs**: `docs/research/reports/litert-js-sota-2026.md`, `docs/research/reports/litert-js-integration-analysis-2026.md`, `docs/research/code-paths/litert-js-path.md`

This consolidates Phase 0 research. All NEEDS CLARIFICATION from the spec are resolved below.

---

## R1 — Runtime initialization & backend selection

**Decision**: Call `createEmbedRuntime()` (LiteRT.js Embedding API) and prefer the **WebGPU** delegate via `getWebGpuDevice()`, falling back to **Wasm** when `navigator.gpu` is absent or device acquisition fails.

**Rationale**:
- Confirmed in `litert-js-path.md`: `createEmbedRuntime()` + `getWebGpuDevice()` is the v0.2.1 API surface.
- WebGPU offers 10–50× throughput on embedding models vs. Wasm; Wasm guarantees universal fallback.
- `SandboxedNode.tsx` uses opaque-origin iframe → its own WebGPU device; we deliberately run in the **host canvas** so the parent page's WebGPU device is shared and stable.

**Alternatives considered**:
- WebNN delegate — not exposed for embedding in 0.2.1; deferred.
- Running inside sandbox — rejected: opaque origin + `budgetMs` watchdog leaks manually-managed tensors (analysis §2).

---

## R2 — Embedding model & weights delivery

**Decision**: **EmbeddingGemma 101M, INT4 quantized**, loaded from `public/ml/embeddinggemma.tflite` via `loadModel`. Weights delivered through `public/ml/` (git-lfs-tracked); a `postinstall`/fetch script pulls them if missing so the repo stays lean.

**Rationale**:
- 101M is small enough for first-load (< 40MB INT4), runs on WebGPU delegate in 0.2.1.
- `public/` is the only path the browser can fetch at runtime without a bundler import (which would break `ssr:false`).

**Alternatives considered**:
- CDN fetch — rejected for privacy (raw text never leaves browser; model fetch should be same-origin).
- Larger Gemma 2B embed — rejected: too heavy for first paint.

---

## R3 — Embedding API shape & similarity

**Decision**: `embed(text: string): Promise<number[]>` returns an **L2-normalized** vector. Provide `cosine(a: number[], b: number[]): number` util. Re-ranking = cosine(queryEmbed, candidateEmbed) descending.

**Rationale**: Normalized vectors make cosine == dot product; cheap and numerically stable. Matches the standard sentence-embedding scoring used by knowledge-graph "related node" hints.

**Alternatives considered**: Euclidean distance — equivalent for normalized vectors; cosine is the convention.

---

## R4 — RelatedNodes slot

**Decision**: Register slot `canvas.related` via `registerSlot` (namespaced per `web/ui/src/ui/slots.ts`). On node focus, call server `searchKnowledge` (existing `backend-client.ts`), then **re-rank server results locally** by embedding similarity. Render top-K with a "local re-rank" badge. If runtime init fails/times out (5s `AbortController`), fall back to server order silently.

**Rationale**: Zero new backend API; reuses `searchKnowledge`. Local re-rank adds privacy + latency win without changing server contract.

**Alternatives considered**: Compute embeddings server-side — rejected (breaks privacy goal, requires backend LiteRT which can't run in Bun).

---

## R6 — NL pre-router

**Decision**: Ship **v1 as a deterministic heuristic** (keyword/intent map) in `prerouter.ts`; reserve a `loadModel` slot for a tiny `.tflite` classifier to be added later. Low-confidence → remote path (`useInterpret()` / `sendMessage`).

**Rationale**: Avoids shipping/training a model in this feature; still satisfies the seam (G3). The capability surface `cap:ml:preroute` is registered now so the architecture is complete.

**Alternatives considered**: Train a small TF classification `.tflite` now — deferred to keep feature scope tight and avoid model-weight procurement.

---

## R7 — Media understanding

**Decision**: **v1 = MobileNetV2 labels** via `media-runtime.ts` on a user-selected image in `MediaCard`; render a "local caption" badge. Caption-generation head deferred.

**Rationale**: MobileNetV2 is WebGPU-friendly and tiny; labels are a safe, deterministic local pre-step. Full captioning deferred due to WebGPU op-coverage risk for caption decoders.

**Alternatives considered**: YOLO v11n — heavier, object-only; labels are more useful for the related-node hint. Caption head — op-coverage risk in 0.2.1.

---

## R8/R9/R10 — Capability surface, state, SSR guard

**Decision**:
- Register `cap:ml:embed`, `cap:ml:rerank`, `cap:ml:preroute`, `cap:ml:caption` as `UnifiedCapability` with `surfaces:['ui']` (AGENTS.md Unit 24). Sandboxes consume via `CapabilityBus` (`cap:ml:*`) — never import `@litertjs/core` directly.
- Runtime state in a Zustand store (`ml-store.ts`); model fetch + embed wrapped in React Query for caching.
- `@litertjs/core` imported **only** via `dynamic(() => import('@litertjs/core'), { ssr:false })`; `web/ui` `next.config` must not bundle it for the server.

**Rationale**: Mirrors the existing capability/capability-bus architecture; preserves One Entry Point invariant; prevents accidental server import (LiteRT.js is browser-only).

---

## Resolved Open Questions (from spec §8)

| Q | Resolution |
|---|------------|
| Q1 model size | EmbeddingGemma 101M INT4, WebGPU |
| Q2 prerouter source | Heuristic v1, `.tflite` slot reserved |
| Q3 media model | MobileNetV2 labels v1, caption deferred |
| Q4 weight delivery | `public/ml/`, git-lfs + fetch script |
| Q5 WebGPU op coverage | Verified EmbeddingGemma + MobileNetV2 run on WebGPU delegate in 0.2.1 |

All NEEDS CLARIFICATION resolved. Proceed to Phase 1 design.
