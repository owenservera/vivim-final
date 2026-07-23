// @types/litertjs/core stub — real types available when @litertjs/core is installed
declare module '@litertjs/core' {
  export function loadLiteRt(wasmUrl: string): Promise<void>;
  export function loadAndCompile(modelUrl: string, opts: { accelerator: Accelerator }): Promise<CompiledModel>;
  export function getWebGpuDevice(): GPUDevice | null;
  export function isWebGPUSupported(): boolean;

  export type Accelerator = 'webgpu' | 'wasm';

  export class Tensor {
    constructor(data: Float32Array, shape: number[]);
    moveTo(target: string): Promise<{ toTypedArray(): Float32Array }>;
    delete(): void;
  }

  export interface CompiledModel {
    run(input: Tensor): Promise<Tensor[]>;
    delete(): void;
  }
}
