// src/reprogrammability/registry.ts
// Phase 1 of ROADMAP-REPROGRAMMABLE-CANVAS.md
//
// The `SurfaceRegistry` is the single source of truth for all
// reprogrammable surfaces in the app. It aggregates surfaces from three
// origins:
//   1. Frontend class-based registrations (UniversalComponentRegistry).
//   2. Backend descriptor-based registrations (Prisma, Phase 8).
//   3. Plugin-provided factories (Phase 9).
//
// In Phase 1 the registry is an in-memory Map. Phase 8 adds Prisma backing
// with versioning.
//
// CONTRACT_VERSION: 1

import type { ReprogrammableSurface, SurfaceKind } from './contract.js'
import type { SurfaceVariant } from './variant-schema.js'

/**
const log = getLogger('reprogrammability:registry')
 * Error thrown when a surface is not found in the registry.
 */
export class SurfaceNotFoundError extends Error {
  readonly surfaceId: string
  constructor(surfaceId: string) {
    super(`Surface not found: ${surfaceId}`)
    this.name = 'SurfaceNotFoundError'
    this.surfaceId = surfaceId
  }
}

/**
 * Error thrown when a duplicate surface id is registered.
 */
export class DuplicateSurfaceError extends Error {
  readonly surfaceId: string
  constructor(surfaceId: string) {
    super(`Surface already registered: ${surfaceId}`)
    this.name = 'DuplicateSurfaceError'
    this.surfaceId = surfaceId
  }
}

/**
 * Listener invoked when the registry changes. Used by the frontend to
 * trigger re-renders via `useSyncExternalStore`.
 */
export type SurfaceRegistryListener = (
  event:
    | { kind: 'register'; surface: ReprogrammableSurface }
    | { kind: 'unregister'; surfaceId: string }
    | { kind: 'clear' },
) => void

/**
 * The registry. A singleton instance is exported at the bottom of this file
 * (`surfaceRegistry`). Tests can construct their own instances for
 * isolation.
 */
export class SurfaceRegistry {
  private readonly surfaces = new Map<string, ReprogrammableSurface>()
  private readonly variants = new Map<string, SurfaceVariant[]>()
  private readonly listeners = new Set<SurfaceRegistryListener>()

  /**
   * Register a surface. Idempotent — re-registering with the same id
   * replaces the previous surface (hot-swap semantics, matching
   * UniversalComponentRegistry).
   */
  register(surface: ReprogrammableSurface): void {
    this.surfaces.set(surface.id, surface)
    this.emit({ kind: 'register', surface })
  }

  /**
   * Unregister a surface by id. No-op if not registered.
   */
  unregister(surfaceId: string): void {
    if (this.surfaces.delete(surfaceId)) {
      this.emit({ kind: 'unregister', surfaceId })
    }
  }

  /** Get a surface by id, or throw. */
  get(surfaceId: string): ReprogrammableSurface {
    const surface = this.surfaces.get(surfaceId)
    if (!surface) throw new SurfaceNotFoundError(surfaceId)
    return surface
  }

  /** Get a surface by id, or undefined. */
  getOrNull(surfaceId: string): ReprogrammableSurface | undefined {
    return this.surfaces.get(surfaceId)
  }

  /** Check if a surface is registered. */
  has(surfaceId: string): boolean {
    return this.surfaces.has(surfaceId)
  }

  /** List all registered surfaces. */
  list(): ReprogrammableSurface[] {
    return Array.from(this.surfaces.values())
  }

  /** List surfaces filtered by kind. */
  listByKind(kind: SurfaceKind): ReprogrammableSurface[] {
    return this.list().filter((s) => s.kind === kind)
  }

  /** List surfaces filtered by slot. */
  listBySlot(slot: string): ReprogrammableSurface[] {
    return this.list().filter((s) => s.slot === slot)
  }

  /** List surfaces filtered by capability id. */
  listByCapability(capabilityId: string): ReprogrammableSurface[] {
    return this.list().filter((s) => s.capabilities?.includes(capabilityId))
  }

  /**
   * Save a variant for a surface. The surface need not be registered yet
   * (variants can exist for surfaces that are mounted lazily).
   */
  saveVariant(surfaceId: string, variant: SurfaceVariant): void {
    const existing = this.variants.get(surfaceId) ?? []
    const idx = existing.findIndex((v) => v.id === variant.id)
    if (idx >= 0) {
      existing[idx] = variant
    } else {
      existing.push(variant)
    }
    this.variants.set(surfaceId, existing)
  }

  /**
   * List variants for a surface.
   */
  listVariants(surfaceId: string): SurfaceVariant[] {
    return [...(this.variants.get(surfaceId) ?? [])]
  }

  /**
   * Get the active variant for a surface, if any.
   */
  getActiveVariant(surfaceId: string): SurfaceVariant | undefined {
    return this.variants.get(surfaceId)?.find((v) => v.isActive)
  }

  /**
   * Set the active variant for a surface. Deactivates all other variants.
   */
  setActiveVariant(surfaceId: string, variantId: string): void {
    const list = this.variants.get(surfaceId) ?? []
    for (const v of list) {
      v.isActive = v.id === variantId
    }
    this.variants.set(surfaceId, list)
  }

  /**
   * Delete a variant. Throws if the variant is locked.
   */
  deleteVariant(surfaceId: string, variantId: string): void {
    const list = this.variants.get(surfaceId) ?? []
    const variant = list.find((v) => v.id === variantId)
    if (!variant) return
    if (variant.isLocked) {
      throw new Error(`Cannot delete locked variant: ${variantId}`)
    }
    this.variants.set(
      surfaceId,
      list.filter((v) => v.id !== variantId),
    )
  }

  /**
   * Subscribe to registry changes. Returns an unsubscribe function.
   */
  subscribe(listener: SurfaceRegistryListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Clear all surfaces and variants. Mainly for tests.
   */
  clear(): void {
    this.surfaces.clear()
    this.variants.clear()
    this.emit({ kind: 'clear' })
  }

  /** Snapshot for debugging / Phase 8 backup. */
  snapshot(): {
    surfaces: Array<{ id: string; kind: SurfaceKind; label: string }>
    variantCount: number
  } {
    return {
      surfaces: this.list().map((s) => ({
        id: s.id,
        kind: s.kind,
        label: s.label,
      })),
      variantCount: Array.from(this.variants.values()).reduce((acc, v) => acc + v.length, 0),
    }
  }

  private emit(
    event:
      | { kind: 'register'; surface: ReprogrammableSurface }
      | { kind: 'unregister'; surfaceId: string }
      | { kind: 'clear' },
  ): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        // Listener errors must not break the registry.
        log.error('[SurfaceRegistry] listener error:', err)
      }
    }
  }
}

/**
 * Singleton instance. The frontend can subscribe to this via
 * `useSyncExternalStore`; the backend uses it directly.
 */
export const surfaceRegistry = new SurfaceRegistry()
