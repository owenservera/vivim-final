// Type declarations for third-party modules without bundled types.
// These are resolved by TypeScript at compile time.

declare module 'ulid' {
  export function ulid(): string
}

declare module 'y-protocols/awareness' {
  export class Awareness {
    constructor(doc: unknown)
    getLocalState(): Uint8Array | null
    setLocalState(state: Record<string, unknown>): void
    setLocalStateField(field: string, value: unknown): void
    destroy(): void
  }
}

declare module 'y-websocket' {
  export class WebsocketProvider {
    constructor(url: string, roomname: string, doc: unknown, options?: Record<string, unknown>)
    connect(): void
    disconnect(): void
    destroy(): void
  }
}

declare module 'jspdf' {
  export class jsPDF {
    internal: {
      pageSize: { width: number; getHeight(): number; getWidth(): number }
    }
    constructor(options?: Record<string, unknown>)
    addImage(imageData: string | HTMLCanvasElement | HTMLImageElement, format: string, x: number, y: number, w: number, h: number): jsPDF
    save(filename?: string): jsPDF
    output(type: 'blob'): Blob
    output(type: string): string | ArrayBuffer
    setFontSize(size: number): jsPDF
    text(text: string, x: number, y: number, options?: Record<string, unknown>): jsPDF
    getPageHeight(): number
    getPageWidth(): number
    addPage(): jsPDF
  }
}

declare module 'html-to-image' {
  export function toPng(node: HTMLElement, options?: Record<string, unknown>): Promise<string>
  export function toJpeg(node: HTMLElement, options?: Record<string, unknown>): Promise<string>
  export function toBlob(node: HTMLElement, options?: Record<string, unknown>): Promise<Blob | null>
  export function toSvg(node: HTMLElement, options?: Record<string, unknown>): Promise<string>
}

declare module '@tauri-apps/api/core' {
  export function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>
}

declare module '@tanstack/react-virtual' {
  export interface VirtualItem {
    index: number
    start: number
    size: number
    key: string
  }
  export interface UseVirtualizerOptions {
    count: number
    getScrollElement: () => HTMLElement | null
    estimateSize: (index: number) => number
    overscan?: number
  }
  export function useVirtualizer(options: UseVirtualizerOptions): {
    getVirtualItems(): VirtualItem[]
    getTotalSize(): number
    scrollToIndex(index: number, options?: Record<string, unknown>): void
    measure(): void
  }
}

declare module 'dompurify' {
  interface DOMPurifyI {
    sanitize(source: string, config?: Record<string, unknown>): string
    addHook(entryPoint: string, hook: (...args: unknown[]) => unknown): void
    removeHook(entryPoint: string): void
    removeAllHooks(): void
    isSupported: boolean
  }
  const DOMPurify: DOMPurifyI
  export default DOMPurify
}
