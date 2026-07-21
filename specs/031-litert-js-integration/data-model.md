# Data Model: LiteRT.js In-Browser ML Substrate

**Feature**: 031-litert-js-integration
**Scope**: Client-only. No Prisma schema change, no DB migration. ML state lives in Zustand + React Query cache.

## 1. ML Runtime State (Zustand — `ml-store.ts`)

```ts
type MlBackend = 'webgpu' | 'wasm' | 'unavailable';

interface EmbedRuntimeState {
  status: 'idle' | 'initializing' | 'ready' | 'error';
  backend: MlBackend;
  modelUrl: string;          // '/ml/embeddinggemma.tflite'
  error?: string;
  lastInitMs?: number;
}

interface MediaRuntimeState {
  status: 'idle' | 'ready' | 'error';
  labels: string[];          // ImageNet label set loaded once
}

interface PrerouterState {
  strategy: 'heuristic' | 'model';  // v1 = heuristic
  localActionHits: number;          // dev counter for success metric
}
```

**Validation rules**:
- `modelUrl` must start with `/ml/` (same-origin only — privacy).
- `embed()` throws `MlNotReadyError` if `status !== 'ready'`.
- `cosine()` requires equal-length vectors; throws otherwise.

## 2. Capability Registration (UnifiedCapability — `surfaces:['ui']`)

| capId | slug | surfaces | description |
|-------|------|----------|-------------|
| `cap:ml:embed` | `ml_embed` | `['ui']` | Embed a string → vector |
| `cap:ml:rerank` | `ml_rerank` | `['ui']` | Re-rank candidates by query embedding |
| `cap:ml:preroute` | `ml_preroute` | `['ui']` | Classify NL phrase as local/remote |
| `cap:ml:caption` | `ml_caption` | `['ui']` | Local image labels/caption |

These are consumed by sandboxes via `CapabilityBus` under `cap:ml:*` — sandboxes never import `@litertjs/core`.

## 3. Slot Registration

| slotId | mount | owner | notes |
|--------|-------|-------|-------|
| `canvas.related` | canvas sidebar | RelatedNodes.tsx | re-ranked knowledge hints |

## 4. State Transitions

```
EmbedRuntime:
  idle --createEmbedRuntime()--> initializing
  initializing --WebGPU ok--> ready(backend=webgpu)
  initializing --WebGPU fail, Wasm ok--> ready(backend=wasm)
  initializing --both fail / timeout(5s)--> error(backend=unavailable)
  error --retry()--> initializing

RelatedNodes:
  serverOrder --local rerank--> rerankedOrder
  rerankedOrder --runtime error--> serverOrder (silent fallback)
```

## 5. Relationships

- `RelatedNodes` → reads `searchKnowledge` (server) + `embed()` (local)
- `Composer` → calls `prerouter.classify()` before `useInterpret()`
- `MediaCard` → calls `media-runtime.label()` on image select
- All → `ml-store` (shared runtime lifecycle)
