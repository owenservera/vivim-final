// frontend/src/ml/ml-store.ts
// Zustand store for the host-canvas ML runtime lifecycle.
//
// The ML runtime is lazily initialized on first use with a 5s
// AbortController timeout. All embedding state is client-only; no
// Prisma / server writes. The store is consumed by RelatedNodes, Composer
// (pre-router) and MediaCard (caption) — all host-canvas components.

'use client';

import { create } from 'zustand';

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

const INIT_TIMEOUT_MS = 5_000;

interface MlState {
  status: 'idle' | 'initializing' | 'ready' | 'error';
  backend: MlBackend | 'unavailable';
  error?: string;
  lastInitMs?: number;
  localActionHits: number;
  runtime: EmbedRuntime | null;
  init: () => Promise<EmbedRuntime | null>;
  embed: (text: string) => Promise<number[] | null>;
  recordLocalAction: () => void;
  reset: () => void;
}

let inflight: Promise<EmbedRuntime | null> | null = null;

async function createEmbedRuntimeStub(_opts?: {
  modelUrl?: string;
  wasmUrl?: string;
  signal?: AbortSignal;
}): Promise<EmbedRuntime> {
  // Stub: real implementation requires @litertjs/core (browser-only Wasm + WebGPU).
  // To enable real ML, install @litertjs/core and port from web/ui/src/ml/embed-runtime.ts.
  throw new MlBackendError('ML runtime not available (stub)');
}

export const useMlStore = create<MlState>((set, get) => ({
  status: 'idle',
  backend: 'unavailable',
  localActionHits: 0,
  runtime: null,

  init: async () => {
    const existing = get().runtime;
    if (existing) return existing;
    if (inflight) return inflight;

    set({ status: 'initializing' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INIT_TIMEOUT_MS);
    const started = performance.now();

    inflight = (async () => {
      try {
        const rt = await createEmbedRuntimeStub({ signal: controller.signal });
        clearTimeout(timer);
        set({ status: 'ready', backend: rt.backend, runtime: rt, lastInitMs: performance.now() - started });
        return rt;
      } catch (err) {
        clearTimeout(timer);
        const message = err instanceof MlBackendError ? err.message : 'ML init failed';
        set({ status: 'error', backend: 'unavailable', error: message });
        return null;
      } finally {
        inflight = null;
      }
    })();

    return inflight;
  },

  embed: async (text: string) => {
    const rt = (await get().init()) ?? null;
    if (!rt) return null;
    return rt.embed(text);
  },

  recordLocalAction: () => set((s) => ({ localActionHits: s.localActionHits + 1 })),

  reset: () => {
    get().runtime?.dispose();
    set({ status: 'idle', backend: 'unavailable', runtime: null, error: undefined });
  },
}));
