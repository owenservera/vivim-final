// frontend/src/ml/media-runtime.ts
// Client-side media understanding (v1: MobileNetV2 image labels).
//
// Runs only on the host canvas (never inside SandboxedNode). Produces a
// "local caption" badge for MediaCard without uploading the image to a
// remote provider. The `.tflite` model is loaded lazily from /ml/.
//
// Stub implementation — real version requires @litertjs/core.

'use client';

import { create } from 'zustand';

export type MlBackend = 'webgpu' | 'wasm';

export class MlBackendError extends Error {
  constructor(message = 'No ML backend available') {
    super(message);
    this.name = 'MlBackendError';
  }
}

interface MediaState {
  status: 'idle' | 'ready' | 'error';
  backend: MlBackend | 'unavailable';
  runtime: unknown | null;
  init: () => Promise<unknown | null>;
  label: (imageDataUrl: string) => Promise<{ name: string; score: number }[]>;
}

let inflight: Promise<unknown | null> | null = null;

export const useMediaStore = create<MediaState>((set, get) => ({
  status: 'idle',
  backend: 'unavailable',
  runtime: null,

  init: async () => {
    const existing = get().runtime;
    if (existing) return existing;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        // Stub: real implementation requires @litertjs/core (browser-only Wasm + WebGPU).
        // To enable real ML, install @litertjs/core and port from web/ui/src/ml/media-runtime.ts.
        throw new MlBackendError('Media runtime not available (stub)');
      } catch {
        set({ status: 'error', backend: 'unavailable', runtime: null });
        return null;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  label: async (_imageDataUrl: string) => {
    const model = (await get().init()) ?? null;
    if (!model) return [];
    // Stub: real implementation would run MobileNetV2 inference
    return [];
  },
}));
