// web/ui/src/ml/media-runtime.ts
// Client-side media understanding (v1: MobileNetV2 image labels).
//
// Runs only on the host canvas (never inside SandboxedNode). Produces a
// "local caption" badge for MediaCard without uploading the image to a
// remote provider. The `.tflite` model is loaded lazily from /ml/.
//
// Uses the real LiteRT.js API:
//   loadLiteRt(wasmUrl) -> loadAndCompile(modelUrl, { accelerator })
//   model.run(inputTensor) -> Tensor[]; out[0].moveTo('wasm').toTypedArray()

'use client';

import { create } from 'zustand';
import { loadLiteRt, loadAndCompile, getWebGpuDevice, isWebGPUSupported, Tensor } from '@litertjs/core';
import type { CompiledModel, Accelerator } from '@litertjs/core';
import { type MlBackend, MlBackendError } from './embed-runtime';

const MOBILENET_MODEL = '/ml/mobilenetv2.tflite';
const IMAGE_NET_LABELS_URL = '/ml/imagenet-labels.json';

// MobileNetV2 (ImageNet) input geometry.
const INPUT_SIZE = 224;
const NUM_CLASSES = 1001;

let labelsCache: string[] | null = null;

async function loadLabels(): Promise<string[]> {
  if (labelsCache) return labelsCache;
  const res = await fetch(IMAGE_NET_LABELS_URL);
  labelsCache = (await res.json()) as string[];
  return labelsCache;
}

interface MediaState {
  status: 'idle' | 'ready' | 'error';
  backend: MlBackend | 'unavailable';
  runtime: CompiledModel | null;
  init: () => Promise<CompiledModel | null>;
  label: (imageDataUrl: string) => Promise<{ name: string; score: number }[]>;
}

let inflight: Promise<CompiledModel | null> | null = null;

/** Decode an image data URL into a normalized [0,1] RGB float32 tensor. */
async function imageToTensor(dataUrl: string): Promise<Tensor> {
  const bitmap = await createImageBitmap(
    await (await fetch(dataUrl)).blob(),
  );
  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new MlBackendError('OffscreenCanvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, INPUT_SIZE, INPUT_SIZE);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const buf = new Float32Array(INPUT_SIZE * INPUT_SIZE * 3);
  // MobileNetV2 expects channels-last RGB floats in [0, 1].
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    buf[i * 3 + 0] = data[i * 4 + 0] / 255;
    buf[i * 3 + 1] = data[i * 4 + 1] / 255;
    buf[i * 3 + 2] = data[i * 4 + 2] / 255;
  }
  return new Tensor(buf, [1, INPUT_SIZE, INPUT_SIZE, 3]);
}

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
        const hasWebGpu = isWebGPUSupported() && getWebGpuDevice() != null;
        const accelerator: Accelerator = hasWebGpu ? 'webgpu' : 'wasm';
        await loadLiteRt('/ml/wasm/');
        const model = await loadAndCompile(MOBILENET_MODEL, { accelerator });
        const backend: MlBackend = accelerator === 'webgpu' ? 'webgpu' : 'wasm';
        set({ status: 'ready', backend, runtime: model });
        return model;
      } catch {
        set({ status: 'error', backend: 'unavailable', runtime: null });
        return null;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  label: async (imageDataUrl: string) => {
    const model = (await get().init()) ?? null;
    if (!model) return [];
    const labels = await loadLabels();
    const input = await imageToTensor(imageDataUrl);
    try {
      const out = await model.run(input);
      const outTensor = out[0];
      const logits = (await outTensor.moveTo('wasm')).toTypedArray() as Float32Array;
      outTensor.delete();
      const scores = softmax(Array.from(logits.slice(0, NUM_CLASSES)));
      return scores
        .map((score, i) => ({ name: labels[i] ?? `class_${i}`, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    } finally {
      input.delete();
    }
  },
}));

/** Numerical-stability-safe softmax. */
function softmax(xs: number[]): number[] {
  const max = Math.max(...xs);
  const exps = xs.map((x) => Math.exp(x - max));
  const sum = exps.reduce((s, e) => s + e, 0) || 1;
  return exps.map((e) => e / sum);
}
