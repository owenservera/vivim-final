// src/reprogrammability/dsl/__tests__/executor.test.ts
// Phase 3 of ROADMAP-REPROGRAMMABLE-CANVAS.md

import { beforeEach, describe, expect, it } from 'bun:test'
import { ulid } from 'ulid'
import type { ReprogrammableSurface } from '../../contract.js'
import { SurfaceNotFoundError, SurfaceRegistry, UnsupportedMutationError } from '../../index.js'
import type { SurfaceMutation, SurfaceMutationPlan } from '../../mutation-schema.js'
import type { PanelSpec, SurfaceSpec } from '../../schema/spec.js'
import { MutationExecutor } from '../executor.js'

class ToyPanelSurface implements ReprogrammableSurface {
  readonly id: string
  readonly kind = 'panel' as const
  readonly label = 'Toy Panel'
  readonly slot = 'left'
  readonly supportedOps = ['replace', 'set_property', 'restyle'] as const

  private spec: PanelSpec

  constructor(id: string, title: string) {
    this.id = id
    this.spec = {
      kind: 'panel',
      variant: 'toy',
      title,
      dock: 'left',
      visible: true,
      collapsed: false,
    }
  }

  getSpec(): SurfaceSpec {
    return structuredClone(this.spec)
  }

  async mutate(mutation: SurfaceMutation): Promise<SurfaceSpec> {
    if (!this.supportedOps.includes(mutation.op as (typeof this.supportedOps)[number])) {
      throw new UnsupportedMutationError(this.id, mutation.op)
    }

    if (mutation.op === 'replace') {
      this.spec = mutation.payload as PanelSpec
      return this.getSpec()
    }
    if (mutation.op === 'set_property') {
      const next = structuredClone(this.spec)
      const { path, value } = mutation.payload
      if (path === 'title') next.title = value as string
      else if (path === 'visible') next.visible = value as boolean
      else if (path === 'dock') next.dock = value as PanelSpec['dock']
      else throw new Error(`unsupported path: ${path}`)
      this.spec = next
      return this.getSpec()
    }
    if (mutation.op === 'restyle') {
      const next = structuredClone(this.spec)
      next.style = { ...(next.style ?? {}), ...mutation.payload }
      this.spec = next
      return this.getSpec()
    }
    throw new UnsupportedMutationError(this.id, mutation.op)
  }
}

describe('Phase 3 — MutationExecutor', () => {
  let registry: SurfaceRegistry
  let executor: MutationExecutor

  beforeEach(() => {
    registry = new SurfaceRegistry()
    executor = new MutationExecutor(registry)
  })

  it('applies a single mutation and pushes to undo stack', async () => {
    const panel = new ToyPanelSurface('panel:toy', 'Original')
    registry.register(panel)

    const record = await executor.apply({
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'Renamed' },
      provenance: 'manual',
    })

    expect(record.ok).toBe(true)
    expect(record.beforeSpec).toMatchObject({ title: 'Original' })
    expect(record.afterSpec).toMatchObject({ title: 'Renamed' })
    expect(executor.canUndo()).toBe(true)
    expect(executor.history()).toHaveLength(1)
  })

  it('throws SurfaceNotFoundError for unknown surfaces', async () => {
    await expect(
      executor.apply({
        op: 'set_property',
        target: 'panel:nope',
        payload: { path: 'title', value: 'X' },
        provenance: 'manual',
      }),
    ).rejects.toBeInstanceOf(SurfaceNotFoundError)
  })

  it('throws UnsupportedMutationError for unsupported ops', async () => {
    const panel = new ToyPanelSurface('panel:toy', 'X')
    registry.register(panel)

    await expect(
      executor.apply({
        op: 'insert',
        target: 'panel:toy',
        payload: {},
        provenance: 'manual',
      }),
    ).rejects.toBeInstanceOf(UnsupportedMutationError)
  })

  it('undo restores the beforeSpec', async () => {
    const panel = new ToyPanelSurface('panel:toy', 'Original')
    registry.register(panel)

    await executor.apply({
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'Renamed' },
      provenance: 'manual',
    })
    expect(panel.getSpec()).toMatchObject({ title: 'Renamed' })

    const undone = await executor.undo()
    expect(undone).not.toBeNull()
    expect(panel.getSpec()).toMatchObject({ title: 'Original' })
    expect(executor.canRedo()).toBe(true)
  })

  it('redo restores the afterSpec', async () => {
    const panel = new ToyPanelSurface('panel:toy', 'Original')
    registry.register(panel)

    await executor.apply({
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'Renamed' },
      provenance: 'manual',
    })
    await executor.undo()
    expect(panel.getSpec()).toMatchObject({ title: 'Original' })

    const redone = await executor.redo()
    expect(redone).not.toBeNull()
    expect(panel.getSpec()).toMatchObject({ title: 'Renamed' })
  })

  it('undo returns null when stack is empty', async () => {
    expect(await executor.undo()).toBeNull()
  })

  it('redo returns null when stack is empty', async () => {
    expect(await executor.redo()).toBeNull()
  })

  it('applyPlan applies all mutations in order', async () => {
    const panel = new ToyPanelSurface('panel:toy', 'Original')
    registry.register(panel)

    const plan: SurfaceMutationPlan = {
      id: ulid(),
      mutations: [
        {
          op: 'set_property',
          target: 'panel:toy',
          payload: { path: 'title', value: 'Step 1' },
          provenance: 'manual',
        },
        {
          op: 'set_property',
          target: 'panel:toy',
          payload: { path: 'visible', value: false },
          provenance: 'manual',
        },
      ],
      provenance: 'manual',
    }

    const result = await executor.applyPlan(plan)
    expect(result.ok).toBe(true)
    expect(result.records).toHaveLength(2)
    expect(result.rolledBack).toBe(false)
    expect(panel.getSpec()).toMatchObject({ title: 'Step 1', visible: false })
  })

  it('applyPlan rolls back on failure', async () => {
    const panel = new ToyPanelSurface('panel:toy', 'Original')
    registry.register(panel)

    const plan: SurfaceMutationPlan = {
      id: ulid(),
      mutations: [
        {
          op: 'set_property',
          target: 'panel:toy',
          payload: { path: 'title', value: 'Step 1' },
          provenance: 'manual',
        },
        // This one fails — 'color' is not a supported path.
        {
          op: 'set_property',
          target: 'panel:toy',
          payload: { path: 'color', value: 'red' },
          provenance: 'manual',
        },
      ],
      provenance: 'manual',
    }

    const result = await executor.applyPlan(plan)
    expect(result.ok).toBe(false)
    expect(result.rolledBack).toBe(true)
    // The first mutation should have been rolled back.
    expect(panel.getSpec()).toMatchObject({ title: 'Original' })
  })

  it('idempotency: re-applying with same key is a no-op', async () => {
    const panel = new ToyPanelSurface('panel:toy', 'Original')
    registry.register(panel)

    const key = 'idem-1'
    const mut: SurfaceMutation = {
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'First' },
      provenance: 'manual',
      idempotencyKey: key,
    }

    const r1 = await executor.apply(mut)
    expect(r1.ok).toBe(true)
    expect(panel.getSpec()).toMatchObject({ title: 'First' })

    // Manually change the title.
    await executor.apply({
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'Manual' },
      provenance: 'manual',
    })
    expect(panel.getSpec()).toMatchObject({ title: 'Manual' })

    // Re-apply with the same key — should be a no-op.
    const r2 = await executor.apply(mut)
    expect(r2.ok).toBe(true)
    expect(panel.getSpec()).toMatchObject({ title: 'Manual' }) // unchanged
  })

  it('previewPlan returns a diff without modifying state', async () => {
    const panel = new ToyPanelSurface('panel:toy', 'Original')
    registry.register(panel)

    const plan: SurfaceMutationPlan = {
      id: ulid(),
      mutations: [
        {
          op: 'set_property',
          target: 'panel:toy',
          payload: { path: 'title', value: 'Preview' },
          provenance: 'manual',
        },
      ],
      provenance: 'manual',
    }

    const preview = await executor.previewPlan(plan)
    expect(preview).toHaveLength(1)
    expect(preview[0]?.beforeSpec).toMatchObject({ title: 'Original' })

    // State unchanged.
    expect(panel.getSpec()).toMatchObject({ title: 'Original' })
  })

  it('applying a mutation clears the redo stack', async () => {
    const panel = new ToyPanelSurface('panel:toy', 'Original')
    registry.register(panel)

    await executor.apply({
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'A' },
      provenance: 'manual',
    })
    await executor.undo()
    expect(executor.canRedo()).toBe(true)

    // Apply a new mutation.
    await executor.apply({
      op: 'set_property',
      target: 'panel:toy',
      payload: { path: 'title', value: 'B' },
      provenance: 'manual',
    })
    expect(executor.canRedo()).toBe(false)
  })
})
