# Contracts: LiteRT.js In-Browser ML Substrate

**Feature**: 031-litert-js-integration

## 1. ML Runtime Contract (`web/ui/src/ml/embed-runtime.ts`)

```ts
export interface EmbedRuntime {
  backend: 'webgpu' | 'wasm';
  embed(text: string): Promise<number[]>;   // L2-normalized vector
  dispose(): void;
}

export function createEmbedRuntime(opts?: {
  modelUrl?: string;                          // default '/ml/embeddinggemma.tflite'
  signal?: AbortSignal;                       // 5s timeout enforced by caller
}): Promise<EmbedRuntime>;

export function cosine(a: number[], b: number[]): number;  // [-1,1]
```

**Invariants**:
- `createEmbedRuntime` is reached ONLY via `dynamic(() => import('@litertjs/core'), { ssr:false })`.
- `embed` throws `MlNotReadyError` if runtime not ready; `MlBackendError` if both backends fail.

## 2. CapabilityBus Surface Contract (`web/ui/src/sdk/canvas/capability-bus.ts`)

Sandboxes consume ML through the existing bus. New allow-listed actions:

```ts
type MlCapabilityAction =
  | { type: 'ml:embed'; payload: { text: string } }
  | { type: 'ml:rerank'; payload: { query: string; candidates: { id: string; text: string }[] } }
  | { type: 'ml:preroute'; payload: { phrase: string } }
  | { type: 'ml:caption'; payload: { imageDataUrl: string } };

// Response shape (host → sandbox):
//   ml:embed   -> { vector: number[] }
//   ml:rerank  -> { ranked: { id: string; score: number }[] }
//   ml:preroute-> { route: 'local' | 'remote'; action?: string; confidence: number }
//   ml:caption -> { labels: { name: string; score: number }[] }
```

Sandboxes MUST NOT import `@litertjs/core`; all ML goes through `cap:ml:*`.

## 3. Slot Contract (`web/ui/src/sdk/canvas/register-slot.ts`)

```ts
registerSlot('canvas.related', {
  component: RelatedNodes,
  title: 'Related',
  position: 'sidebar',         // matches CATEGORY_POSITIONS convention
});
```

## 4. RelatedNodes Data Contract (server → local)

```ts
// Input (from backend-client.searchKnowledge — UNCHANGED server API):
interface KnowledgeSearchResult { id: string; title: string; snippet: string; score: number }

// Output (local re-rank):
interface RankedRelated { id: string; title: string; score: number; source: 'local' | 'server' }
```

## 5. Pre-router Contract (`web/ui/src/ml/prerouter.ts`)

```ts
export interface PrerouteResult {
  route: 'local' | 'remote';
  action?: string;            // e.g. 'select_model', 'open_canvas'
  confidence: number;         // [0,1]; < 0.5 -> remote
}
export function classify(phrase: string): PrerouteResult;  // v1 heuristic
```

## 6. Media Contract (`web/ui/src/ml/media-runtime.ts`)

```ts
export function label(imageDataUrl: string): Promise<{ name: string; score: number }[]>;
// consumed by MediaCard; badges as 'local caption'
```
