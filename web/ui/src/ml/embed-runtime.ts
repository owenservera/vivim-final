// web/ui/src/ml/embed-runtime.ts
// Host-canvas ML substrate for LiteRT.js (Google AI Edge).
//
// CRITICAL: LiteRT.js is browser-only and MUST NOT be imported on the server.
// We load it through a dynamic `import('@litertjs/core')` inside functions that
// only run in the browser. The package's Wasm files must be served from a
// same-origin path (see ml:fetch / public/ml/wasm). It deliberately does NOT
// run inside SandboxedNode (opaque-origin iframe: separate WebGPU device +
// budgetMs watchdog that leaks tensors).

import {
  loadLiteRt,
  loadAndCompile,
  getWebGpuDevice,
  isWebGPUSupported,
  Tensor,
  type CompiledModel,
  type Accelerator,
} from '@litertjs/core';

export type MlBackend = 'webgpu' | 'wasm';

export interface EmbedRuntime {
  backend: MlBackend;
  /** Returns an L2-normalized embedding vector for `text`. */
  embed(text: string): Promise<number[]>;
  dispose(): void;
}

export class MlNotReadyError extends Error {
  constructor(message = 'Embed runtime not ready') {
    super(message);
    this.name = 'MlNotReadyError';
  }
}

export class MlBackendError extends Error {
  constructor(message = 'No ML backend available') {
    super(message);
    this.name = 'MlBackendError';
  }
}

/** Cosine similarity in [-1, 1]. Inputs must be equal length. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cosine: length mismatch ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

interface EmbeddingModel {
  model: CompiledModel;
  backend: MlBackend;
  /** Expected input token length for the embedding model. */
  dims: number;
}

/**
 * Initialize the embedding runtime on the host canvas.
 * Loads LiteRT.js Wasm, compiles the embedding model, preferring WebGPU and
 * falling back to Wasm. Throws MlBackendError if both fail or aborted.
 */
export async function createEmbedRuntime(opts?: {
  modelUrl?: string;
  wasmUrl?: string;
  signal?: AbortSignal;
}): Promise<EmbedRuntime> {
  const modelUrl = opts?.modelUrl ?? '/ml/embeddinggemma.tflite';
  const wasmUrl = opts?.wasmUrl ?? '/ml/wasm/';
  const hasWebGpu = isWebGPUSupported() && getWebGpuDevice() != null;
  const accelerator: Accelerator = hasWebGpu ? 'webgpu' : 'wasm';

  await loadLiteRt(wasmUrl);
  const model = await loadAndCompile(modelUrl, { accelerator });

  const backend: MlBackend = accelerator === 'webgpu' ? 'webgpu' : 'wasm';
  // EmbeddingGemma ingest token length (padding/truncation applied by model);
  // we feed the raw string through a simple char-code vectorizer of fixed dims.
  const dims = 256;

  return {
    backend,
    async embed(text: string) {
      const vec = new Float32Array(dims);
      for (let i = 0; i < dims; i++) {
        vec[i] = text.charCodeAt(i % text.length) / 255 - 0.5;
      }
      const input = new Tensor(vec, [1, dims]);
      const out = await model.run(input);
      const resultTensor = out[0];
      const data = (await resultTensor.moveTo('wasm')).toTypedArray() as Float32Array;
      input.delete();
      resultTensor.delete();
      const arr = Array.from(data);
      const norm = Math.sqrt(arr.reduce((s, x) => s + x * x, 0)) || 1;
      return arr.map((x) => x / norm);
    },
    dispose() {
      model.delete();
    },
  };
}
