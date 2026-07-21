// web/ui/src/ml/ml-store.ts
// Zustand store for the host-canvas ML runtime lifecycle.
//
// The LiteRT.js runtime is lazily initialized on first use with a 5s
// AbortController timeout (R5). All embedding state is client-only; no
// Prisma / server writes. The store is consumed by RelatedNodes, Composer
// (pre-router) and MediaCard (caption) — all host-canvas components.

'use client';

import { create } from 'zustand';
import {
  createEmbedRuntime,
  type EmbedRuntime,
  type MlBackend,
  MlBackendError,
} from './embed-runtime';

const INIT_TIMEOUT_MS = 5_000;
const DEFAULT_MODEL = '/ml/embeddinggemma.tflite';

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
        const rt = await createEmbedRuntime({ modelUrl: DEFAULT_MODEL, signal: controller.signal });
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
