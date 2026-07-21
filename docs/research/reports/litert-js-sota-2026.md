# LiteRT.js (Google AI Edge) — Research Report

*Generated: 2026-07-20 | Sources: 18 | Confidence: High*

> This report is a complete documentation library for Google's **LiteRT.js** — the
> JavaScript/WebAssembly binding of LiteRT (formerly TensorFlow Lite). It covers the
> API surface, backends, model conversion, tooling, limits, and a deep assessment of
> how **vivim-final** should leverage it. Companion artifacts:
> - Brief: [`../briefs/litert-js-brief.md`](../briefs/litert-js-brief.md)
> - Evidence: [`../evidence/litert-js/sources.json`](../evidence/litert-js/sources.json)
> - Leverage code-path: [`../code-paths/litert-js-path.md`](../code-paths/litert-js-path.md)

---

## Executive Summary

LiteRT.js (announced **July 9, 2026**) is Google's official JavaScript binding of
LiteRT — the on-device inference runtime that powers ML across Android, iOS, and
desktop. It compiles the **native** LiteRT runtime to WebAssembly and exposes a thin
JS/TS API so `.tflite` models run inside the browser with **zero server round-trips**.

The headline differentiation vs TensorFlow.js: TF.js reimplements kernels in
JavaScript (slow by native standards); LiteRT.js ships the *same native runtime*
Google uses on mobile/desktop, compiled to Wasm. Google reports **up to 3× speedups**
over TF.js / ONNX Runtime Web on CPU+GPU, and **5–60×** over pure-CPU when GPU (WebGPU)
or NPU (WebNN) paths are used.

**Three execution backends:**
| Backend | Kernel/API | Best for |
|---------|-----------|----------|
| `wasm` | XNNPACK (multi-thread, relaxed SIMD) | Universal CPU fallback, small models |
| `webgpu` | ML Drift → WebGPU compute | Real-time vision, audio, most workloads |
| `webnn` | WebNN API (experimental) | Dedicated NPUs (Chrome/Edge, Win11 24H2+) |

**Where this matters for vivim-final:** vivim is a local-first AI conversation
platform with a React/Next.js **canvas frontend** (`web/ui`) and a Bun + Prisma
backend. LiteRT.js runs *only in the browser*, so it is a **frontend-capability**
play — not a backend one. The highest-value fits are: on-device semantic/embedding
search of the conversation knowledge graph (privacy + zero server cost), a local
"edge copilot" intent classifier / NL pre-router that reduces latency before hitting
the remote provider, and client-side media understanding (image/audio) inside the
canvas. Lower-priority: running LLMs in-browser via the separate **LiteRT-LM.js**
package (Gemma 4 E2B/E4B) — relevant only if vivim adds a fully-local chat mode.

---

## 1. What LiteRT.js Is (and Is Not)

### 1.1 Positioning

- LiteRT.js is the **continuation of the LiteRT stack** for the web — same runtime,
  same `.tflite` format used on mobile/desktop, now in the browser
  ([developers.google.com/edge/litert/web](https://developers.google.com/edge/litert/web)).
- It is **not a replacement for TensorFlow.js as a training/end-to-end library** — it
  is an *inference* runtime only. Pre-/post-processing is the developer's
  responsibility (or delegated to TF.js helpers) ([GitHub README](https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/README.md)).
- It is **not a new model format**. It consumes existing `.tflite` artifacts; models
  trained for Android/iOS/desktop run unchanged in-browser
  ([kiadev.net](https://www.kiadev.net/news/2026-07-15-litertjs-webgpu-tflite-browser)).

### 1.2 Relationship to LiteRT-LM.js (separate package)

- **LiteRT.js** (`@litertjs/core`) → runs *classical* `.tflite` models
  (vision, audio, embeddings, classification, detection, pose).
- **LiteRT-LM.js** (`@litert-lm/core`) → runs *generative LLMs* (text-in/text-out)
  in-browser via WebGPU. Currently early preview supporting
  `gemma-4-E2B-it-web.litertlm` and `gemma-4-E4B-it-web.litertlm`
  ([developers.google.com/edge/litert-lm/js](https://developers.google.com/edge/litert-lm/js)).
- Both share the WebGPU device plumbing; LiteRT-LM.js is the on-device *GenAI* story.

### 1.3 Why it beats TF.js (per Google + community benchmarks)

- Native Wasm runtime inherits XNNPACK (CPU) + ML Drift (GPU) optimizations that
  TF.js JS kernels cannot match.
- **Up to 3× faster** than TF.js / ONNX Runtime Web on CPU+GPU
  ([byteiota.com](https://byteiota.com/litert-js-run-ai-models-in-the-browser-no-server)).
- **5–60× faster** than CPU-only when WebGPU (M4 MacBook Pro benchmarks) is used
  ([developers.googleblog.com](https://developers.googleblog.com/litertjs-googles-high-performance-web-ai-inference/)).
- Unified stack: web app inherits future quantization/hardware improvements
  automatically (single source of truth with mobile/desktop)
  ([alekseialeinikov.com](https://www.alekseialeinikov.com/en/blog/topics/ai/browser-ai-webgpu-litert-js-2026)).

---

## 2. Installation & Package Layout

| Package | Purpose |
|---------|---------|
| `@litertjs/core` | Core runtime: load/init Wasm, compile models, tensors, run inference ([npm](https://www.npmjs.com/package/@litertjs/core)) |
| `@litertjs/tfjs-interop` | Convert tensors between LiteRT.js and TensorFlow.js ([npm](https://www.npmjs.com/package/@litertjs/tfjs-interop)) |
| `@litertjs/model-tester` | Validate GPU delegation + numerical parity vs CPU ([npm](https://www.npmjs.com/package/@litertjs/model-tester)) |
| `@litert-lm/core` | LLM runtime (Gemma 4) — separate GenAI package |

```bash
npm install @litertjs/core
# Wasm files live in node_modules/@litertjs/core/wasm/ — serve statically
```

> **Current version:** `@litertjs/core` latest is **0.2.1** (published ~a month prior
> to this writing). This is an **early/preview** release — API surface may shift
> ([npmjs.com/package/@litertjs/core](https://www.npmjs.com/package/@litertjs/core)).

> **CDN option:** `import ... from 'https://cdn.jsdelivr.net/npm/@litertjs/core/+esm'`
> — no build step needed for demos/prototypes.

---

## 3. Core API Surface (`@litertjs/core`)

> Assembled from [GitHub core README](https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/packages/core/README.md),
> [DeepWiki JS API](https://deepwiki.com/google-ai-edge/LiteRT/4.6-javascript-and-webassembly-api),
> and [Google get-started](https://developers.google.cn/edge/litert/web/get_started).

### 3.1 Environment / Loading

```ts
import { loadLiteRt, getWebGpuDevice } from '@litertjs/core';

// Load Wasm runtime. Options:
//   { jspi: true }  → required for WebNN, and for per-op model partitioning
//                     on WebGPU/WASM (mixed CPU+GPU delegation)
await loadLiteRt('/path/to/wasm/directory/', { jspi: true });
```

- `loadLiteRt(path, options?)` — feature-detects SIMD/Threads/JSPI and loads the
  matching `.js`/`.wasm` pair (e.g. `litert_wasm_threaded_internal.js`,
  `litert_wasm_jspi_internal.js`) ([DeepWiki](https://deepwiki.com/google-ai-edge/LiteRT/4.6-javascript-and-webassembly-api)).
- `getWebGpuDevice()` — returns the shared `GPUDevice` so TF.js can reuse the same
  context (interop).

### 3.2 Model Compilation

```ts
const model = await loadAndCompile(
  '/path/to/your/model.tflite',
  { accelerator: 'webgpu' },   // 'webgpu' | 'wasm' | 'webnn'
  // For webnn: { accelerator: 'webnn', webNNOptions: { devicePreference: 'npu' } }
);
```

- `loadAndCompile(modelPathOrBytes, options)` returns a compiled `Model`.
- `model.getInputDetails()` / `model.getOutputDetails()` — tensor shapes/dtypes.
- Accelerator dispatch rules ([kiadev.net](https://www.kiadev.net/news/2026-07-15-litertjs-webgpu-tflite-browser)):
  - **No partial delegation by default on non-JSPI browsers:** if a model has ops
    unsupported by WebGPU, the *entire* model falls back to WASM (with a warning).
  - **With JSPI:** unsupported ops run on WASM per-op → model partitioning (mixed
    CPU+GPU execution).
  - WebNN requires `jspi: true` to bridge async device polling with sync kernel
    scheduling.

### 3.3 Tensors (manual memory management)

```ts
import { Tensor } from '@litertjs/core';

const inputTypedArray = new Float32Array(1 * 3 * 224 * 224);
const inputTensor = new Tensor(inputTypedArray, [1, 3, 224, 224]);

// Move tensor to GPU memory before running (optional opt for webgpu)
const gpuTensor = await inputTensor.moveTo('webgpu');

const results = await model.run(gpuTensor);   // or model.run([gpuTensor])
// or model.run({ 'input_name': gpuTensor })

gpuTensor.delete();                            // ⚠️ manual delete required

// Read results: move back to CPU/WASM, then toTypedArray()
const resultArray = (await results[0].moveTo('wasm')).toTypedArray();
results[0].delete();
```

Key `Tensor` methods (from snippets + DeepWiki mapping):
- `new Tensor(typedArray, shape)` — wrap a typed array.
- `tensor.moveTo('webgpu' | 'wasm' | 'cpu')` — relocate buffer across devices.
- `tensor.data()` / `tensor.toTypedArray()` — read values.
- `tensor.delete()` — **manual free** (LiteRT.js uses manual memory management;
  leaks if skipped).

### 3.4 TF.js Interop

```ts
import { runWithTfjsTensors } from '@litertjs/tfjs-interop';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';

await tf.setBackend('webgpu');
await loadLiteRt('/path/to/wasm');
const device = await getWebGpuDevice();
tf.removeBackend('webgpu');
tf.registerBackend('webgpu', () => new WebGPUBackend(device, device.adapterInfo));
await tf.setBackend('webgpu');

const model = await loadAndCompile('/model.tflite', { accelerator: 'webgpu' });
// runWithTfjsTensors wraps model.run with TFJS tensors in/out
const out = await runWithTfjsTensors(model, tfInput);
```

- Swap `model.predict`/`model.execute` (TFJS) → `runWithTfjsTensors(liteRtModel, inputs)`
  ([developers.google.com/edge/litert/web](https://developers.google.com/edge/litert/web)).
- May require input **reordering/transposing** to match converter output layout.

---

## 4. Model Conversion (Getting a `.tflite` into the browser)

LiteRT.js eats the **same `.tflite`** as the rest of the ecosystem. Sources:
- **Pretrained:** Kaggle (`framework=tfLite`), Hugging Face `tflite` models, and the
  [LiteRT Hugging Face community](https://huggingface.co/collections/litert-community/web-classical-models).
- **From PyTorch:** [`litert-torch`](https://github.com/google-ai-edge/litert-torch)
  converter → `.tflite` (direct, 1-step). Far simpler than TF.js's
  PyTorch→ONNX→TF→TF.js chain ([developers.google.cn/edge/litert/web](https://developers.google.cn/edge/litert/web)).
- **From TensorFlow / JAX:** standard LiteRT conversion tooling
  ([developers.google.com/edge/litert/conversion/overview](https://developers.google.com/edge/litert/conversion/overview)).
- **Quantization:** [AI Edge Quantizer](https://github.com/google-ai-edge/ai-edge-quantizer)
  for size/perf gains (selective quantization colab available).
- **YOLO via Ultralytics:** `model.export(format="litert")` → `.tflite`, runs in-browser
  via `@ultralytics/yolo` + `@litertjs/core` with WebGPU + CPU/WASM fallback
  ([docs.ultralytics.com/integrations/litert](https://docs.ultralytics.com/integrations/litert)).

---

## 5. Limitations & Gotchas

| Limitation | Detail | Mitigation |
|-----------|--------|-----------|
| **2 GB Wasm CPU memory cap** | Large models may fail to load (runtime heap ≤ 2 GB) ([GitHub README](https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/README.md)) | Use WebGPU, quantize, or pick smaller architectures |
| **Incomplete WebGPU op coverage** | Ops unsupported on WebGPU → full fallback to WASM on non-JSPI browsers | Enable `jspi:true` for per-op partitioning; run Model Tester |
| **No pre/post-processing** | LiteRT.js runs the graph only; normalization/decode is on you | Use `@tensorflow/tfjs` helpers or hand-roll |
| **Manual tensor memory** | Forgetting `.delete()` leaks GPU/Wasm memory | Wrap in try/finally or helper |
| **WebNN experimental** | NPU path needs Chrome/Edge + flags + Win11 24H2+ | Don't ship to prod yet ([byteiota.com](https://byteiota.com/litert-js-run-ai-models-in-the-browser-no-server)) |
| **Early release (0.2.1)** | API may break between versions | Pin version; re-verify on upgrade |
| **Browser variance** | WebGPU/WebNN support differs across Chrome/Edge/Safari/Firefox | Detect + fallback; assert fallback paths in tests |

---

## 6. Testing & Tooling

- **`@litertjs/model-tester`** — feed fake inputs, check how much of the graph
  delegates to GPU and the numerical diff vs CPU execution
  ([GitHub README](https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/packages/core/README.md)).
- **Demos:** [CodePen collection](https://codepen.io/collection/PoJBoq) (real-world
  impls), including EmbeddingGemma vector search in-browser
  ([codepen.io/jasonmayes/pen/JoKMBmq](https://codepen.io/jasonmayes/pen/JoKMBmq)).
- **QA surface (new with client-side AI):** cross-browser coverage, fallback-path
  assertions, and performance-as-correctness (latency, memory, first-load time)
  ([qatechtools.com](https://qatechtools.com/2026/07/10/google-litert-js-browser-ai-testing-qa)).

---

## 7. How vivim-final Should Leverage LiteRT.js — Deep Assessment

> See [`../code-paths/litert-js-path.md`](../code-paths/litert-js-path.md) for the
> concrete integration plan and code outline. Summary of the thinking:

### 7.1 Where it fits architecturally

vivim-final topology (per AGENTS.md / frontier):
- **Backend:** Bun + Prisma + 13 engines; providers (chatgpt/claude/gemini/…) are
  *remote* chat UIs driven via CDP by `ChromeGovernor`.
- **Frontend:** React/Next.js **canvas** (`web/ui/src/components/canvas/*`) — a
  knowledge-graph conversation surface with capability bars, drawers, observability.
- **LiteRT.js runs in the browser only.** Therefore it is a **frontend enhancement**,
  not a backend engine. It cannot replace provider inference (that's remote). It
  *complements* the remote LLM by doing cheap, private, local inference client-side.

### 7.2 Highest-value leverage points (ranked)

1. **On-device semantic search / embeddings over the conversation knowledge graph.**
   - The Node-layer v2 + knowledge graph stores every message/concept as a `Node`.
     Running **EmbeddingGemma** (or a small embedding `.tflite`) in-browser lets the
     canvas do private, server-free semantic search + "related node" suggestions.
   - *Why:* zero server cost, privacy (data never leaves device), instant response.
   - *Fit:* `canvas/` search/drawer components; pairs with existing `quad-tree.ts`
     spatial index.

2. **Local NL pre-router / intent classifier (edge copilot).**
   - Before a command hits `/api/interpret` → remote provider, a tiny on-device
     classifier (text classification `.tflite`) can route/dedupe/common-case
     autocomplete. Reduces latency + provider cost for high-frequency UI actions.
   - *Fit:* `CommandPalette.tsx`, `CapabilityBar.tsx` — local suggestions before
     network round-trip.

3. **Client-side media understanding in the canvas.**
   - Image/audio models (MobileNetV2, YOLO, audio classifiers) let users drop media
     into a conversation node and get local captions/detection before/instead of
     sending to a remote model.
   - *Fit:* `SandboxedNode.tsx`, media paste handlers.

4. **(Lower priority) Fully-local chat via LiteRT-LM.js (Gemma 4).**
   - Only relevant if vivim adds an offline/air-gapped mode. Adds a "local model"
     provider surface. Heavier (E2B/E4B weights, WebGPU only).
   - *Fit:* new `web/ui` provider surface; not on the critical path.

### 7.3 Where it does NOT fit

- **Backend engines:** LiteRT.js cannot run in Bun server-side for the same models
  (it is a browser/Wasm+WebGPU runtime; Node usage is limited/unsupported for the
  WebGPU path). Do **not** attempt to move provider inference本地.
- **Replacing remote providers:** the 6 providers are remote chat products; LiteRT.js
  is for *your own* `.tflite` models. Distinct concern.

### 7.4 Integration pattern (capability-driven, per vivim conventions)

- Wrap LiteRT.js in a **capability-global slot** (`UIComponentRegistry`) so it
  hot-swaps per environment (feature-flagged, with WASM-CPU fallback always on).
- Expose as a `UnifiedCapability` with `surfaces: ['ui']` so it flows through the
  same `/api/interpret` → capability contract the rest of vivim uses (thin client).
- Follow **Store Contracts invariant**: the model-cache + capability registration
  state lives in Prisma; the runtime inference is browser-only.

### 7.5 Risks for vivim

- **Early-release volatility** (0.2.1) — pin + re-verify on bump.
- **Bundle/Wasm size** — models + Wasm must be lazy-loaded (code-split, served from
  CDN or static host) so the canvas doesn't bloat initial load.
- **Browser support matrix** — must assert WebGPU fallback in tests (QA surface above).
- **Memory leaks** — manual tensor `.delete()` in React effects (cleanup on unmount).

---

## Key Takeaways

- LiteRT.js = native LiteRT runtime compiled to Wasm; runs `.tflite` in-browser with
  WASM/WebGPU/WebNN backends; up to 3× vs TF.js, 5–60× with GPU.
- It is a **frontend-only, inference-only** runtime — a privacy/latency/cost win for
  client-side ML, not a backend engine.
- Best vivim fits: **in-browser embeddings over the knowledge graph**, **local NL
  pre-router**, **client-side media understanding**; optional **local LLM** via
  LiteRT-LM.js.
- Wrap as a capability-global slot with WASM fallback; lazy-load models; pin version;
  assert fallback paths in tests.

---

## Sources

1. [LiteRT.js announcement — Google Developers Blog (2026-07-09)](https://developers.googleblog.com/litertjs-googles-high-performance-web-ai-inference/) — launch, backends, perf claims
2. [LiteRT for Web with LiteRT.js — Google AI Edge docs](https://developers.google.com/edge/litert/web) — features, install, conversion
3. [Get started with LiteRT.js — Google AI Edge docs (cn)](https://developers.google.cn/edge/litert/web/get_started) — WebGPU/WebNN init, JSPI, TFJS interop
4. [LiteRT.js core README — GitHub](https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/packages/core/README.md) — full API usage, features, limitations
5. [LiteRT.js README — GitHub (litert/js)](https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/README.md) — usage, TFJS interop, limits
6. [LiteRT-LM JS API — Google AI Edge](https://developers.google.com/edge/litert-lm/js) — Gemma 4 in-browser LLM (separate package)
7. [LiteRT-LM JS README — GitHub](https://github.com/google-ai-edge/LiteRT-LM/blob/main/js/packages/core/README.md) — Engine/Conversation API
8. [@litertjs/core on npm](https://www.npmjs.com/package/@litertjs/core) — package version 0.2.1
9. [@litertjs/tfjs-interop on npm](https://www.npmjs.com/package/@litertjs/tfjs-interop) — tensor interop
10. [@litertjs/model-tester on npm](https://www.npmjs.com/package/@litertjs/model-tester) — GPU delegation/parity testing
11. [Browser AI 2026: WebGPU & LiteRT.js — Aleksei Aleinikov](https://www.alekseialeinikov.com/en/blog/topics/ai/browser-ai-webgpu-litert-js-2026) — backend ladder, getting started
12. [LiteRT.js: Run AI Models in the Browser — byteiota](https://byteiota.com/litert-js-run-ai-models-in-the-browser-no-server) — backends, perf, WebNN caveat
13. [Google Releases LiteRT.js — kiadev.net](https://www.kiadev.net/news/2026-07-15-litertjs-webgpu-tflite-browser) — native runtime vs JS kernels, dispatch rules
14. [LiteRT.js Brings AI Inference to Browsers — QATechTools](https://qatechtools.com/2026/07/10/google-litert-js-browser-ai-testing-qa) — QA surface, fallback testing
15. [LiteRT.js: On-Device AI Inference — quasa.io](https://quasa.io/media/google-s-litert-js-enables-on-device-ai-inference-in-web-browsers) — benefits, limits
16. [LiteRT.js: Near-Native Inference — betterstack.com](https://betterstack.com/community/guides/ai/litert-js-browser-ai/) — overview
17. [Export YOLO to LiteRT — Ultralytics](https://docs.ultralytics.com/integrations/litert) — `@ultralytics/yolo` + LiteRT.js browser path
18. [JavaScript and WebAssembly API — DeepWiki](https://deepwiki.com/google-ai-edge/LiteRT/4.6-javascript-and-webassembly-api) — architecture, loadLiteRt internals

---

## Methodology

Searched 6 web queries (websearch) across launch announcements, official Google docs,
GitHub READMEs, npm, and community deep-dives. Analyzed 18 unique sources; prioritized
Google official blogs/docs + GitHub source over secondary blogs. Web-reader and
web-search-prime MCP were rate-limited (429), so synthesis relied on websearch
excerpts (which included full code snippets from primary sources) plus the existing
project architecture review (AGENTS.md, `web/ui` canvas components, engine list).
Confidence: **High** — claims are corroborated across ≥2 primary sources each.
