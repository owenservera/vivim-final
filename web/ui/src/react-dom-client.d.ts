// Local type shim for react-dom/client (no @types/react-dom in deps).
// Mirrors the public surface used by src/main.tsx.
declare module 'react-dom/client' {
  import type { ReactNode } from 'react'

  export interface Root {
    render(children: ReactNode): void
    unmount(): void
  }

  export function createRoot(container: Element | DocumentFragment | null): Root
  export function hydrateRoot(
    container: Element | DocumentFragment,
    children: ReactNode,
  ): Root
}
