# LiteRT.js × vivim-final — Deep Integration Analysis

*Generated: 2026-07-20 | Confidence: High | Companion: [litert-js-sota-2026.md](litert-js-sota-2026.md) · [litert-js-brief.md](../briefs/litert-js-brief.md) · [litert-js-path.md](../code-paths/litert-js-path.md)*

> This is **not** a redo of the SOTA report. It is a concrete wiring analysis: how
> LiteRT.js maps onto the *actual* vivim-final frontend code (`web/ui`), where it fits,
> where it is blocked by existing architecture, and the exact integration seams. Every
> claim below cites a real file in the repo.

---

## 0. Scope recap

LiteRT.js runs **in the browser only** (Wasm + WebGPU/WebNN). vivim-final's backend is
Bun + Prisma (no browser runtime). Therefore LiteRT.js is exclusively a **frontend**
concern. The question is: *which frontend seams does it plug into, and which does it
fight?*

---

## 1. The frontend as-it-is (ground truth)

| Fact | Evidence | Consequence for LiteRT.js |
|------|----------|---------------------------|
| Next.js 16 / React 19 app, `web/ui` | `web/ui/package.json` | Standard browser runtime — LiteRT.js installs as a dep here |
| State: Zustand + React Query (TanStack) | `package.json`, `useCapabilities.ts` | Model-load state can live in Zustand; inference results cache via React Query |
| Capability-global **slot registry**: `SLOT_IDS` + `registerSlot`/`resolveSlot` | `ui/slots.ts`, `sdk/canvas/register-slot.ts` | Natural mount point — LiteRT.js becomes a hot-swappable slot renderer |
| **Sandboxed iframe** nodes: CSP `allow-scripts`, opaque origin, `allowCapabilities` allow-list, `budgetMs` watchdog | `canvas/SandboxedNode.tsx` | ⚠️ LiteRT.js must NOT run *inside* the sandbox (see §4) |
| Backend client already has `/api/knowledge/search` + `/api/knowledge/synthesize` | `sdk/backend-client.ts:263-282` | Semantic search already exists server-side; LiteRT.js is a *local* complement |
| Composer is the NL entry, hits `POST /api/conversations/:id/messages` → WS stream | `chat/Composer.tsx` | Ideal seam for a **local NL pre-router** |
| `useInterpret()` → `POST /api/interpret` | `hooks/useCapabilities.ts:45` | Pre-router can short-circuit before this call |
| `CapabilityBus` (sandboxed postMessage) honors `allowCapabilities` | `sdk/canvas/capability-bus.ts` | New `ml.*` capabilities can be exposed to sandboxed nodes |

---

## 2. Integration seam #1 — Knowledge-graph semantic search (HIGHEST value)

### 2.1 What exists
- `backend-client.searchKnowledge(query)` → `GET /api/knowledge/search?q=` returns
  `KnowledgeResultSchema` (id, content, source, score). This is a **server-side**
  lexical/vector search.
- The Node-layer v2 stores every message/concept as a `Node` (per AGENTS.md). The
  canvas renders these as `CanvasNode` + `quad-tree.ts` spatial index.

### 2.2 What LiteRT.js adds
Run **EmbeddingGemma** (or a small sentence-embedding `.tflite`) in-browser to produce
embeddings for canvas nodes **client-side**, enabling:
- **Private semantic "related node" suggestions** as you type/drag — no server round-trip.
- **Offline search** when the backend is down (the `HealthIndicator` already polls
  backend health at 15s — `chat/ChatSurface.tsx:67`).
- **Zero-cost re-ranking** of `searchKnowledge` server hits with a local cosine pass.

### 2.3 Concrete wiring
```
web/ui/src/
  ml/
    embed-runtime.ts        # initLiteRt + loadModel(EmbeddingGemma.tflite)
    use-embeddings.ts        # Zustand store: embed(text) → Float32Array, cached
    node-embed-index.ts      # cosine similarity over CanvasNode texts
  components/canvas/
    RelatedNodes.tsx         # slot renderer: shows top-K related nodes live
```
- Register as a slot via `registerSlot('chat.sidebar', 'ml.related', RelatedNodes)` —
  but note `chat.sidebar` is `overridableBy: 'provider'` (`ui/slots.ts:41`); a better
  fit is a **new slot** `canvas.related` (add to `SLOT_IDS`) so it is `capability`-scoped
  and hot-swappable without provider conflict.
- Cache embeddings with React Query (`staleTime` large) to avoid re-embedding.

### 2.4 Risk
- **Model size**: EmbeddingGemma is ~100 MB+ quantized. Must lazy-load + show a
  `StreamingIndicator`-style progress. Tie into `ObservabilityHUD` for memory wat.
- **2 GB Wasm cap** (report §5): fine for embeddings; not for LLMs.

---

## 3. Integration seam #2 — Local NL pre-router (HIGH value)

### 3.1 What exists
- `Composer.send()` → `sendMessage(conversationId, text)` → backend → remote provider
  stream (`chat/Composer.tsx:92-112`).
- `useInterpret()` → `POST /api/interpret` resolves NL → capability.

### 3.2 What LiteRT.js adds
A tiny **text-classification** `.tflite` (e.g. a distilled intent model, or a
small embedding + cosine against a few intent centroids) runs **before** the network
call:
- Instant local autocomplete/suggestions in the composer (sub-10 ms, WASM-CPU).
- Route trivial intents locally (e.g. "clear chat", "switch provider") without a
  backend round-trip — reduces provider cost + latency.
- **Graceful degradation**: if the model isn't loaded yet, fall through to
  `useInterpret()` (the existing path). Never block the user.

### 3.3 Concrete wiring
```
web/ui/src/
  ml/
    nl-prerouter.ts         # loadModel(intent.tflite); classify(text) → {intent, score}
  components/chat/
    Composer.tsx            # augment `send()`: call nl-prerouter first; if confident,
                            #   offer local action OR still forward to backend
```
- Keep the **existing** `send()` as the fallback. The pre-router only *suggests*; the
  remote path remains the source of truth (preserves the "frontend = backend" invariant
  — `SandboxedNode.tsx:14`).
- Expose `ml.classify` as a capability so sandboxed nodes can call it via `CapabilityBus`.

---

## 4. The sandbox boundary — CRITICAL constraint (where it does NOT fit)

### 4.1 The sandbox is hostile to LiteRT.js
`SandboxedNode.tsx` renders third-party canvas definitions in:
- `sandbox="allow-scripts"` → **opaque origin** (no `allow-same-origin`).
- CSP via `<meta http-equiv="Content-Security-Policy">` (`SandboxedNode.tsx:157`).
- Communication only via `MessageChannel` + `CapabilityBus` with an `allowCapabilities`
  allow-list (`SandboxedNode.tsx:103`).

### 4.2 Why LiteRT.js cannot live inside the sandbox
1. **WebGPU device sharing breaks.** `getWebGpuDevice()` shares one `GPUDevice`
   between LiteRT.js and TF.js on the *host* (`litert-js-path.md`). An opaque-origin
   iframe gets its **own** GPU device context — you lose the shared-device optimization
   and may hit per-origin GPU memory limits.
2. **Model fetch + Wasm path**. The sandbox would need its own copy of `@litertjs/core/wasm/`
   and its own model download — doubling payload and memory. CSP would also need
   `connect-src`/`script-src` loosening, which fights the P8 security invariant
   (`allowInlineScript: false`, S92/S93).
3. **Manual memory + lifecycle**. Tensor `.delete()` in a watchdog-killed frame leaks
   deterministically (watchdog nukes the frame on `budgetMs` — `SandboxedNode.tsx:235`).

### 4.3 Correct topology
```
┌─ Host canvas (web/ui, main origin) ──────────────────────┐
│  ml/embed-runtime.ts  ← LiteRT.js runs HERE (host)        │
│  ml/nl-prerouter.ts                                        │
│        │ exposes capabilities                             │
│        ▼                                                   │
│  CapabilityBus host allow-list: ['ml.embed','ml.classify']│
│        │ (MessageChannel)                                 │
│        ▼                                                   │
│  SandboxedNode iframe (opaque origin) ── requests ────────┘
│     only calls window.__vivim.requestCapability('ml.embed')
└──────────────────────────────────────────────────────────┘
```
**Rule:** LiteRT.js is a **host-resident ML substrate**; sandboxed nodes consume it
*only* through the capability bus, exactly like every other capability. This preserves
P8/S92/S93 and the "frontend = backend" invariant.

---

## 5. Integration seam #3 — Client-side media understanding (MEDIUM value)

### 5.1 What exists
- `MediaCard.tsx`, `shared/media.ts`, `SandboxedNode` (media can be rendered as a
  canvas node).

### 5.2 What LiteRT.js adds
Drop an image/audio into a node → run **MobileNetV2 / YOLO** (via `@ultralytics/yolo` +
`@litertjs/core`, report §4) **locally** to caption/detect before/instead of sending to
a remote model. Privacy win for sensitive media.

### 5.3 Wiring
```
web/ui/src/ml/media-understand.ts   # loadModel(yolo.tflite, {accelerator:'webgpu'})
web/ui/src/components/canvas/cards/MediaCard.tsx  # onDrop → local infer → caption chip
```
- Must handle **WebGPU op gaps**: YOLO has ops unsupported on WebGPU → whole-model WASM
  fallback on non-JSPI browsers (report §3.2). Use `jspi:true` + `model-tester` to
  confirm GPU delegation. This is the **highest runtime-risk** seam (browser variance).

---

## 6. What about running LLMs locally (LiteRT-LM.js)?

- Separate package `@litert-lm/core` (Gemma 4 E2B/E4B), **WebGPU only**, early preview
  (report §1.2).
- vivim's value is *orchestrating remote providers* (chatgpt/claude/gemini/…). A local
  LLM is a **different product surface** (offline/air-gapped mode).
- **Recommendation:** defer. Only scope if an offline mode is explicitly requested.
  If scoped, it becomes a new `provider` registered in the same taxonomy — *not* a
  replacement for the 6 remote providers.

---

## 7. Build/runtime integration mechanics

| Concern | Recommendation | Why |
|---------|---------------|-----|
| **Install** | `npm i @litertjs/core` in `web/ui` only | Backend can't use the WebGPU path |
| **Wasm serving** | Copy `node_modules/@litertjs/core/wasm/` → `public/wasm/litert/`, lazy-load | Next.js `public/` is static-served; avoids bundler mangling Wasm |
| **Code-split** | `dynamic(() => import('@/ml/embed-runtime'), { ssr:false })` | LiteRT.js is browser-only; never SSR |
| **Version pin** | Pin `@litertjs/core@0.2.1` | Early release, API drift risk (report §5) |
| **State** | Zustand store for runtime-ready flag + model cache; React Query for embeddings | Matches existing state libs |
| **Memory** | Wrap `Tensor` lifecycle in try/finally (path doc); dispose on React unmount | Manual `.delete()` required |
| **Feature flag** | Gate behind `LiveConfigProvider` / a `cap:ml:*` capability | Hot-swap per environment, WASM fallback always on |
| **Tests** | Assert WASM-CPU fallback (disable WebGPU flag); assert no tensor leak on unmount | New QA surface (report §6) |

---

## 8. Conflict matrix — LiteRT.js vs. existing invariants

| Invariant (AGENTS.md / source) | Tension | Resolution |
|-------------------------------|---------|------------|
| **P8 / S92 / S93** (sandbox no inline script, allow-list, watchdog) | LiteRT.js needs host runtime + GPU device | Keep ML in **host**, expose via `CapabilityBus` (§4.3) |
| **"Frontend = Backend"** (invariant 3, `SandboxedNode.tsx:14`) | Local inference could bypass backend | Pre-router only *suggests*; backend remains source of truth (§3.2) |
| **Store Contracts** (engines depend on contracts, never impl) | LiteRT.js is browser, not an engine | N/A — it's a UI substrate; model-cache state can persist in Prisma if needed |
| **One Entry Point** (every op is a UnifiedCapability) | New ML features are features | Register `cap:ml:embed`, `cap:ml:classify`, `cap:ml:detect` as `surfaces:['ui']` |
| **Taxonomy slot IDs namespaced** (`chat.actionBar` etc., AGENTS.md) | New slot must use exact ids | Add `canvas.related` / `ml.*` to `SLOT_IDS` + `SLOT_META` |

---

## 9. Recommended rollout (phased)

1. **Phase A — Host runtime + embeddings (seam #1).** `ml/embed-runtime.ts`,
   `use-embeddings.ts`, `RelatedNodes.tsx` slot, lazy Wasm. High value, low risk.
2. **Phase B — NL pre-router (seam #2).** `ml/nl-prerouter.ts` wired into `Composer`
   with graceful fallback to `useInterpret`. Medium effort, high UX win.
3. **Phase C — Media understanding (seam #3).** `ml/media-understand.ts` in
   `MediaCard`. Medium risk (browser variance) — ship WebGPU + assert WASM fallback.
4. **Phase D (deferred) — Local LLM.** Only if offline mode scoped; new provider surface.

Each phase is independently shippable and respects the sandbox boundary (§4).

---

## 10. Open engineering questions (for the implementing unit)

1. **Bundle budget:** what is the acceptable lazy-loaded Wasm + embedding-model size for
   `web/ui`? (EmbeddingGemma ~100 MB quantized.)
2. **Embedding sync:** should canvas-node embeddings be computed on load (blocking) or
   lazily on first search (stale-until-warm)?
3. **Backend knowledge parity:** should local embeddings *replace* `/api/knowledge/search`
   or *re-rank* it? (Recommendation: re-rank; keep server as fallback.)
4. **Capability registration:** which `cap:ml:*` slugs + which `surfaces`? (`ui` only,
   since backend can't run them.)
5. **Browser support target:** which Safari/Firefox versions must support WebGPU for the
   GPU path to be assumed on?

---

## Key Takeaways

- LiteRT.js is a **host-canvas ML substrate**, not a sandboxed-node runtime. The
  `SandboxedNode` opaque-origin + CSP + watchdog model **blocks** in-iframe execution.
- Best fits, in order: **(1)** in-browser embeddings over the knowledge graph,
  **(2)** local NL pre-router in `Composer`, **(3)** client-side media understanding in
  `MediaCard`. Local LLM deferred.
- Integration is clean via existing seams: **slot registry** (`registerSlot`),
  **CapabilityBus** (expose `ml.*` to sandboxes), **React Query/Zustand** (state),
  **backend-client knowledge API** (re-rank, not replace).
- Respect invariants: keep ML host-side (P8/S92/S93), backend remains source of truth
  (invariant 3), register ML as `UnifiedCapability` `surfaces:['ui']`.
