// src/reprogrammability/__tests__/contract.test.ts
// Phase 1 of ROADMAP-REPROGRAMMABLE-CANVAS.md
//
// Verifies the contract types compile, the registry works, and a toy
// surface implementing the contract can be registered, retrieved, and
// mutated. This is the smoke test for Phase 1 — it must pass before
// Phase 2 begins.

import { beforeEach, describe, expect, it } from 'bun:test'
import type { ReprogrammableSurface } from '../contract.js'
import {
  CONTRACT_VERSION,
  SurfaceNotFoundError,
  SurfaceRegistry,
  UnsupportedMutationError,
} from '../index.js'
import type { SurfaceMutation } from '../mutation-schema.js'
import type { SurfaceSpec } from '../schema/spec.js'
import type { PanelSpec } from '../schema/spec.js'

/** A minimal toy surface that implements the contract. */
class ToyPanelSurface implements ReprogrammableSurface {
  readonly id = 'panel:toy'
  readonly kind = 'panel' as const
  readonly label = 'Toy Panel'
  readonly slot = 'left'
  readonly capabilities = [] as const
  readonly tags = ['toy', 'test'] as const
  readonly supportedOps = ['replace', 'set_property', 'restyle'] as const

  private spec: PanelSpec = {
    kind: 'panel',
    variant: 'toy',
    title: 'Toy Panel',
    dock: 'left',
    visible: true,
    collapsed: false,
  }

  getSpec(): SurfaceSpec {
    // Return a deep clone.
    return structuredClone(this.spec)
  }

  async mutate(mutation: SurfaceMutation): Promise<SurfaceSpec> {
    if (!this.supportedOps.includes(mutation.op as (typeof this.supportedOps)[number])) {
      throw new UnsupportedMutationError(this.id, mutation.op)
    }

    // We've already filtered to supportedOps above; narrow per-op.
    if (mutation.op === 'replace') {
      const payload = mutation.payload as PanelSpec
      this.spec = payload
      return this.getSpec()
    }

    if (mutation.op === 'set_property') {
      const next = structuredClone(this.spec) as PanelSpec
      const { path, value } = mutation.payload
      if (path === 'title') {
        next.title = value as string
      } else if (path === 'dock') {
        next.dock = value as PanelSpec['dock']
      } else {
        throw new Error(`Toy panel does not support path: ${path}`)
      }
      this.spec = next
      return this.getSpec()
    }

    if (mutation.op === 'restyle') {
      const next = structuredClone(this.spec) as PanelSpec
      next.style = { ...(next.style ?? {}), ...mutation.payload }
      this.spec = next
      return this.getSpec()
    }

    // We've covered all supportedOps for this toy (replace, set_property, restyle).
    // Any other op would have been rejected above as unsupported.
    throw new UnsupportedMutationError(this.id, mutation.op)
  }
}

describe('Phase 1 — Reprogrammability Contract', () => {
  let registry: SurfaceRegistry

  beforeEach(() => {
    registry = new SurfaceRegistry()
  })

  it('exposes a stable CONTRACT_VERSION', () => {
    expect(CONTRACT_VERSION).toBe(1)
  })

  it('a toy surface implements ReprogrammableSurface', () => {
    const surface = new ToyPanelSurface()
    expect(surface.id).toBe('panel:toy')
    expect(surface.kind).toBe('panel')
    expect(surface.getSpec().kind).toBe('panel')
    expect(surface.supportedOps).not.toContain('insert')
  })

  it('registers, retrieves, and lists a surface', () => {
    const surface = new ToyPanelSurface()
    registry.register(surface)

    expect(registry.has('panel:toy')).toBe(true)
    expect(registry.get('panel:toy')).toBe(surface)
    expect(registry.list()).toHaveLength(1)
    expect(registry.listByKind('panel')).toHaveLength(1)
    expect(registry.listByKind('card')).toHaveLength(0)
    expect(registry.listBySlot('left')).toHaveLength(1)
  })

  it('throws SurfaceNotFoundError for unknown ids', () => {
    expect(() => registry.get('nope')).toThrow(SurfaceNotFoundError)
  })

  it('returns undefined from getOrNull for unknown ids', () => {
    expect(registry.getOrNull('nope')).toBeUndefined()
  })

  it('emits registry events on register / unregister', () => {
    const events: Array<{ kind: string; surfaceId?: string }> = []
    registry.subscribe((event) => {
      if (event.kind === 'register') {
        events.push({ kind: 'register', surfaceId: event.surface.id })
      } else if (event.kind === 'unregister') {
        events.push({ kind: 'unregister', surfaceId: event.surfaceId })
      }
    })

    const surface = new ToyPanelSurface()
    registry.register(surface)
    registry.unregister('panel:toy')

    expect(events).toEqual([
      { kind: 'register', surfaceId: 'panel:toy' },
      { kind: 'unregister', surfaceId: 'panel:toy' },
    ])
  })

  it('applies a set_property mutation to a surface', async () => {
    const surface = new ToyPanelSurface()
    registry.register(surface)

    const mutation: SurfaceMutation = {
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'Renamed Toy' },
      provenance: 'manual',
    }

    const newSpec = await surface.mutate(mutation)
    expect(newSpec.kind).toBe('panel')
    expect((newSpec as PanelSpec).title).toBe('Renamed Toy')
  })

  it('throws UnsupportedMutationError for unsupported ops', async () => {
    const surface = new ToyPanelSurface()
    const mutation: SurfaceMutation = {
      op: 'insert',
      target: 'panel:toy',
      payload: {},
      provenance: 'manual',
    }
    await expect(surface.mutate(mutation)).rejects.toBeInstanceOf(UnsupportedMutationError)
  })

  it('validates spec via the Zod schema', () => {
    // This is a smoke test that the schema is importable and parses a
    // valid spec. Phase 3 will add full mutation parsing.
    const validSpec = {
      kind: 'panel',
      variant: 'toy',
      title: 'Toy',
      dock: 'left',
      visible: true,
      collapsed: false,
    }
    // Re-import to avoid circular import issues in the test.
    const { PanelSpecSchema } = require('../schema/spec.js')
    const parsed = PanelSpecSchema.safeParse(validSpec)
    expect(parsed.success).toBe(true)
  })

  it('validates a mutation via the Zod schema', () => {
    const validMutation = {
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'Hi' },
      provenance: 'manual',
    }
    const { SurfaceMutationSchema } = require('../mutation-schema.js')
    const parsed = SurfaceMutationSchema.safeParse(validMutation)
    expect(parsed.success).toBe(true)
  })

  it('rejects an invalid mutation op', () => {
    const invalidMutation = {
      op: 'teleport', // not one of the 8 ops
      target: 'panel:toy',
      payload: {},
      provenance: 'manual',
    }
    const { SurfaceMutationSchema } = require('../mutation-schema.js')
    const parsed = SurfaceMutationSchema.safeParse(invalidMutation)
    expect(parsed.success).toBe(false)
  })

  it('rejects an invalid provenance tag', () => {
    const invalidMutation = {
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'Hi' },
      provenance: 'alien', // not a valid tag
    }
    const { SurfaceMutationSchema } = require('../mutation-schema.js')
    const parsed = SurfaceMutationSchema.safeParse(invalidMutation)
    expect(parsed.success).toBe(false)
  })

  it('produces a registry snapshot', () => {
    const surface = new ToyPanelSurface()
    registry.register(surface)

    const snap = registry.snapshot()
    expect(snap.surfaces).toHaveLength(1)
    expect(snap.surfaces[0]?.id).toBe('panel:toy')
    expect(snap.variantCount).toBe(0)
  })
})
