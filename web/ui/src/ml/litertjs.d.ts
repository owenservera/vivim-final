// web/ui/src/ml/litertjs.d.ts
// Ambient type declarations for @litertjs/core (LiteRT.js / Google AI Edge).
// Loaded via tsconfig "typeRoots" or triple-slash reference.
// R10: dynamic import() typed so build never hard-depends on the preview package.

declare module '@litertjs/core' {
  export type Accelerator = 'webgpu' | 'wasm';

  export interface CompiledModel {
    /** Run inference; returns output tensors. */
    run(input: Tensor): Promise<Tensor[]>;
    /** Release GPU/Wasm resources. */
    delete(): void;
  }

  export class Tensor {
    constructor(data: Float32Array | Uint8Array, shape: number[]);
    /** Move tensor data to the specified backend ('wasm' or 'webgpu'). */
    moveTo(target: string): Promise<{ toTypedArray(): Float32Array }>;
    /** Release underlying buffer. */
    delete(): void;
  }

  /** Load the LiteRT.js Wasm runtime from the given base URL. */
  export function loadLiteRt(wasmBaseUrl: string): Promise<void>;

  /** Compile a .tflite model with the given accelerator preference. */
  export function loadAndCompile(
    modelUrl: string,
    opts?: { accelerator?: Accelerator },
  ): Promise<CompiledModel>;

  /** Return a WebGPU device if available, else null. */
  export function getWebGpuDevice(): GPUDevice | null;

  /** True if WebGPU is supported in the current browser context. */
  export function isWebGPUSupported(): boolean;
}

// WebGPU global type (browser-only, not in standard TS lib as of 5.4).
// Extend navigator.gpu so getWebGpuDevice() types cleanly.
interface Navigator {
  gpu?: {
    requestAdapter(): Promise<unknown>;
    requestDevice(): Promise<unknown>;
  };
}
