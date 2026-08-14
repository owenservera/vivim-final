// src/engines/embedding-hf.ts
// HfEmbeddingProvider — real neural embeddings via @huggingface/transformers (ONNX WASM).
// Uses Xenova/all-mpnet-base-v2 (768-d, INT8 quantized, ~22 MB).
// Default embedding provider: local, no server, no LLM, no API key.

import type { EmbeddingProvider } from './semantic-search.js'

const MODEL = 'Xenova/all-mpnet-base-v2'
const DEFAULT_DIMENSIONS = 768

/** Structural shape of the transformers feature-extraction pipeline we call. */
type EmbedPipe = (
  inputs: string | string[],
  options?: { pooling?: string; normalize?: boolean },
) => Promise<{ data: ArrayLike<number> }>

// Lazy singleton for the pipeline — created once, reused across embed calls.
let _pipePromise: Promise<EmbedPipe> | null = null

function getPipeline(): Promise<EmbedPipe> {
  if (!_pipePromise) {
    const pipeOptions = {
      quantized: true,
      cache_dir: process.env.VIVIM_MODEL_CACHE ?? 'data/models',
    }
    _pipePromise = import('@huggingface/transformers').then(
      ({ pipeline }) =>
        pipeline('feature-extraction', MODEL, pipeOptions as never) as unknown as EmbedPipe,
    )
  }
  return _pipePromise
}

export class HfEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'hf:mpnet-base-v2'
  readonly dimensions = DEFAULT_DIMENSIONS

  private initPromise: Promise<void> | null = null

  /** Warm up the pipeline (call once at boot). Idempotent. */
  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = getPipeline().then(() => {})
    }
    return this.initPromise
  }

  async embed(text: string): Promise<number[]> {
    const pipe = await getPipeline()
    const out = await pipe(text, { pooling: 'mean', normalize: true })
    return Array.from(out.data as Float32Array)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const pipe = await getPipeline()
    const out = await pipe(texts, { pooling: 'mean', normalize: true })
    const data = out.data as Float32Array
    const dims = this.dimensions

    // Slice the flat [batch * dim] tensor into per-text vectors.
    const results: number[][] = []
    for (let i = 0; i < texts.length; i++) {
      const start = i * dims
      results.push(Array.from(data.subarray(start, start + dims)))
    }
    return results
  }

  /** Null out the pipeline reference (for tests / hot reload). */
  dispose(): void {
    _pipePromise = null
    this.initPromise = null
  }
}
