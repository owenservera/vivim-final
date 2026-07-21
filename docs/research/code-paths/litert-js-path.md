# LiteRT.js — Confirmed Code Path & vivim Leverage Plan

**Convergence:** CONFIRMED (API usage) | PROBABLE (vivim integration shape)
**Iterations:** 3 | **Confidence:** High | **Date:** 2026-07-20

> Companion: [report](../reports/litert-js-sota-2026.md) · [brief](../briefs/litert-js-brief.md)
> Primary sources: [Google get-started](https://developers.google.cn/edge/litert/web/get_started),
> [core README](https://github.com/google-ai-edge/LiteRT/blob/main/litert/js/packages/core/README.md),
> [DeepWiki JS API](https://deepwiki.com/google-ai-edge/LiteRT/4.6-javascript-and-webassembly-api).

## Recommended Approach

Use LiteRT.js as a **browser-only ML capability slot** inside `web/ui` (the React/Next.js
canvas). It is **not** a backend engine (it requires Wasm+WebGPU which Bun server-side
does not provide for the WebGPU path). Wrap it behind a capability-global component so
it hot-swaps per environment, with a guaranteed WASM-CPU fallback.

## Working Code Example (confirmed from primary sources)

```ts
// web/ui/src/ml/litert-runtime.ts
// Confirmed API shape from @litertjs/core (v0.2.1) core README + get-started docs.
import {
  loadLiteRt,
  loadAndCompile,
  Tensor,
  getWebGpuDevice,
} from '@litertjs/core';

let runtimeReady: Promise<unknown> | null = null;

/** Initialize once; JSPI enables per-op GPU/WASM partitioning + WebNN. */
export async function initLiteRt(wasmPath = '/wasm/litert/') {
  if (runtimeReady) return runtimeReady;
  runtimeReady = loadLiteRt(wasmPath, { jspi: true });
  return runtimeReady;
}

export interface CompiledModel {
  model: Awaited<ReturnType<typeof loadAndCompile>>;
}

export async function loadModel(
  url: string,
  accelerator: 'webgpu' | 'wasm' = 'webgpu',
): Promise<CompiledModel> {
  await initLiteRt();
  const model = await loadAndCompile(url, { accelerator });
  return { model };
}

/** Run inference with manual tensor lifecycle (delete required). */
export async function infer(
  compiled: CompiledModel,
  float32: Float32Array,
  shape: number[],
) {
  const input = new Tensor(float32, shape);
  try {
    const results = await compiled.model.run(input);
    const out = results[0];
    const data = await out.data();
    out.delete();
    return data;
  } finally {
    input.delete();
  }
}
```

WebGPU device sharing with TensorFlow.js (if pre/post-processing needs TFJS):

```ts
import { getWebGpuDevice } from '@litertjs/core';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgpu';
import { WebGPUBackend } from '@tensorflow/tfjs-backend-webgpu';

await tf.setBackend('webgpu');
await loadLiteRt('/wasm/litert/');
const device = await getWebGpuDevice();
tf.removeBackend('webgpu');
tf.registerBackend('webgpu', () => new WebGPUBackend(device, device.adapterInfo));
await tf.setBackend('webgpu');
// now runWithTfjsTensors(model, tfInput) from @litertjs/tfjs-interop
```

## Why This Works

1. `loadLiteRt` + `loadAndCompile` + `Tensor` + `moveTo`/`delete` are the documented
   public API across Google docs and the GitHub core README (Sources 2,4,18) — **High**.
2. Manual `delete()` is required (LiteRT.js uses manual memory management) — confirmed
   in README limitations (Source 4) — **High**.
3. `jspi: true` unlocks per-op WebGPU/WASM partitioning + WebNN — confirmed in
   get-started + kiadev dispatch rules (Sources 3,13) — **High**.

## vivim Integration Shape (PROBABLE — fits project conventions)

Leverage the existing **capability-global slot** mechanism (`UIComponentRegistry`) so
LiteRT.js is a first-class, hot-swappable canvas surface:

```
web/ui/src/
  ml/
    litert-runtime.ts        # init + loadModel + infer (above)
    embedding-search.ts      # EmbeddingGemma .tflite -> semantic search over Nodes
    nl-prerouter.ts          # small text-classification .tflite -> local command routing
    media-understand.ts      # MobileNetV2/YOLO .tflite -> local image/audio caption
  components/canvas/
    MLSurface.tsx             # capability-global slot; lazy-loads wasm+model; WASM fallback
```

Registration as a `UnifiedCapability` (`surfaces: ['ui']`) keeps it inside the
existing `/api/interpret` → capability contract (thin-client convention from AGENTS.md).
State (which models cached, capability enabled) persists in Prisma; runtime inference is
browser-only (Store Contracts invariant preserved).

### Ranked leverage (deep reasoning)

| # | Leverage | Why it fits vivim | Effort | Risk |
|---|----------|-------------------|--------|------|
| 1 | **In-browser embeddings over knowledge graph** | Node-layer v2 stores every message/concept as `Node`; EmbeddingGemma gives private, server-free semantic search + "related node" hints in the canvas | Med | Low |
| 2 | **Local NL pre-router** | `CommandPalette`/`CapabilityBar` get instant local suggestions before `/api/interpret` → remote provider; cuts latency + cost | Med | Low |
| 3 | **Client-side media understanding** | `SandboxedNode` media paste → local caption/detect before/instead of remote model | Med | Med (browser variance) |
| 4 | **Local LLM (LiteRT-LM.js / Gemma 4)** | Only if offline/air-gapped mode scoped; heavier (E2B/E4B weights, WebGPU only) | High | Med |

## Prerequisites

- `@litertjs/core` (pin 0.2.1) installed in `web/ui`; Wasm served statically from
  `/wasm/litert/` (copy `node_modules/@litertjs/core/wasm/`).
- A `.tflite` model (EmbeddingGemma from HF `litert-community`, or YOLO/MobileNetV2).
- Browser with WebGPU (Chrome/Edge/Firefox) for GPU path; WASM-CPU fallback for others.
- Lazy-load (code-split) so canvas initial bundle stays lean.

## Known Gotchas

- **2 GB Wasm CPU cap** → large models fail on CPU; use WebGPU + quantize. Mitigation:
  model-tester to validate GPU delegation.
- **WebGPU op gaps** → non-JSPI browsers fall back whole-model to WASM (warning).
  Mitigation: `jspi: true` for per-op partitioning.
- **Manual tensor memory** → forgetting `.delete()` leaks. Mitigation: try/finally
  wrapper (shown above) + React effect cleanup.
- **WebNN experimental** → don't ship NPU path to prod yet.
- **Early release (0.2.1)** → API may break on bump. Mitigation: pin + re-verify.
- **Browser matrix** → assert fallback paths in tests (QA surface: qatechtools Source 14).

## Alternatives Considered

| Approach | Why Rejected / Deferred | Source |
|----------|------------------------|--------|
| TensorFlow.js GraphModel | Slower JS kernels; LiteRT.js is the Google-recommended evolution for `.tflite` | Sources 1,11 |
| ONNX Runtime Web | Works, but LiteRT.js reports 2×+ for YOLO-class models + unifies with mobile stack | Source 17 |
| Backend (Bun) inference | LiteRT.js WebGPU path needs browser; not a server runtime | Sources 2,4 |
| Remote embeddings API | Defeats the privacy/zero-cost win; LiteRT.js does it locally | Sources 1,15 |

## Verification Steps

1. `npm i @litertjs/core` in `web/ui`; copy `wasm/` to static serve path.
2. Load EmbeddingGemma `.tflite`; run `infer()` on a sample canvas node text.
3. Use `@litertjs/model-tester` to confirm GPU delegation % + numerical parity vs CPU.
4. Disable WebGPU (flag) → confirm WASM-CPU fallback still returns correct results.
5. Add a canvas test asserting fallback path + no tensor leaks (effect cleanup).

## Risk Assessment

- **Technical risk:** Low (API confirmed, primary sources).
- **Integration risk:** Medium (browser matrix, bundle size, React lifecycle).
- **Maintenance risk:** Medium (early-release 0.2.1 API drift; pin + re-verify on bump).

## Convergence Trace (summary)

- **Iter 1** — Hypothesis: wrap `@litertjs/core` behind a canvas slot. Searched install +
  API. Confidence: High on API, Med on integration shape.
- **Iter 2** — Validated `loadLiteRt`/`loadAndCompile`/`Tensor`/`delete` + JSPI partitioning
  via core README + DeepWiki. Confidence: High.
- **Iter 3** — Mapped to vivim `web/ui` canvas + capability-global convention; ranked
  leverage (embeddings > NL prerouter > media > local LLM). Decision: CONFIRMED API,
  PROBABLE integration shape → exit loop.
