// src/canvas/primitives.ts
// Core primitive registry — the *closed* vocabulary layers compose (P6).
//
// Primitives are the nouns of the canvas. The set is closed: workspace,
// projects, knowledge, agents, providers, conversations. New capability comes
// from new *compositions* of these, never from new *frameworks*. Each
// primitive is a read surface the oracle and layers draw from.

import type {
  PrimitiveKind,
  PrimitiveReader,
} from './types.js'
import { PRIMITIVE_KINDS } from './types.js'

export type { PrimitiveKind } from './types.js'

export interface PrimitiveProvider {
  readonly kind: PrimitiveKind
  read(query: Record<string, unknown>): Promise<unknown>
}

export class CorePrimitiveRegistry {
  private providers = new Map<PrimitiveKind, PrimitiveProvider>()

  register(provider: PrimitiveProvider): void {
    if (this.providers.has(provider.kind)) {
      throw new Error(`primitive ${provider.kind} already registered`)
    }
    this.providers.set(provider.kind, provider)
  }

  unregister(kind: PrimitiveKind): void {
    this.providers.delete(kind)
  }

  has(kind: PrimitiveKind): boolean {
    return this.providers.has(kind)
  }

  kinds(): readonly PrimitiveKind[] {
    return PRIMITIVE_KINDS
  }

  /** A `PrimitiveReader` bound to this registry — what layers/canvas consume. */
  reader(): PrimitiveReader {
    return {
      read: async (kind, query) => {
        const provider = this.providers.get(kind)
        if (!provider) {
          throw new Error(`no provider registered for primitive ${kind}`)
        }
        return provider.read(query)
      },
    }
  }

  getProvider(kind: PrimitiveKind): PrimitiveProvider | null {
    return this.providers.get(kind) ?? null
  }
}

/**
 * A primitive provider whose data is supplied by a plain async function. This
 * is the composition seam: wire any store/engine into the closed primitive
 * set without inventing a new framework.
 */
export function fnPrimitive(
  kind: PrimitiveKind,
  fn: (query: Record<string, unknown>) => Promise<unknown>,
): PrimitiveProvider {
  return { kind, read: fn }
}
