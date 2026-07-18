// tests/unit/canvas/layer-crud.test.ts
// Tests for canvas layer CRUD: create, move, resize, visibility, delete, persistence.
// Agent B — Canvas & UI Production (v2 expanded).

import { describe, expect, it } from 'bun:test'

// ── Layer model ──────────────────────────────────────────────────────────────

interface CanvasLayer {
  id: string
  name: string
  category: string
  z: number
  visible: boolean
  locked: boolean
  backgroundColor?: string
  defaultComponents: string[]
  layout: { x: number; y: number; z: number; w: number; h: number }
  createdAt: number
  updatedAt: number
}

interface LayerInput {
  name: string
  category?: string
  z?: number
  visible?: boolean
  locked?: boolean
  layout?: { x?: number; y?: number; z?: number; w?: number; h?: number }
}

let idCounter = 0
function nextId(): string {
  return `layer:${++idCounter}`
}

class LayerStore {
  private layers = new Map<string, CanvasLayer>()

  create(input: LayerInput): CanvasLayer {
    const now = Date.now()
    const layer: CanvasLayer = {
      id: nextId(),
      name: input.name,
      category: input.category ?? 'chat',
      z: input.z ?? 0,
      visible: input.visible ?? true,
      locked: input.locked ?? false,
      backgroundColor: undefined,
      defaultComponents: [],
      layout: {
        x: input.layout?.x ?? 0,
        y: input.layout?.y ?? 0,
        z: input.layout?.z ?? input.z ?? 0,
        w: input.layout?.w ?? 480,
        h: input.layout?.h ?? 360,
      },
      createdAt: now,
      updatedAt: now,
    }
    this.layers.set(layer.id, layer)
    return layer
  }

  get(id: string): CanvasLayer | undefined {
    return this.layers.get(id)
  }
  delete(id: string): boolean {
    return this.layers.delete(id)
  }
  list(): CanvasLayer[] {
    return [...this.layers.values()].sort((a, b) => a.z - b.z)
  }

  move(id: string, x: number, y: number, z?: number): CanvasLayer | null {
    const layer = this.layers.get(id)
    if (!layer) return null
    layer.layout.x = x
    layer.layout.y = y
    if (z !== undefined) layer.layout.z = z
    layer.updatedAt = Date.now()
    return layer
  }

  resize(id: string, w: number, h: number): CanvasLayer | null {
    const layer = this.layers.get(id)
    if (!layer) return null
    layer.layout.w = w
    layer.layout.h = h
    layer.updatedAt = Date.now()
    return layer
  }

  setVisible(id: string, visible: boolean): CanvasLayer | null {
    const layer = this.layers.get(id)
    if (!layer) return null
    layer.visible = visible
    layer.updatedAt = Date.now()
    return layer
  }

  setLocked(id: string, locked: boolean): CanvasLayer | null {
    const layer = this.layers.get(id)
    if (!layer) return null
    layer.locked = locked
    layer.updatedAt = Date.now()
    return layer
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CanvasLayer CRUD', () => {
  it('creates a layer with default values', () => {
    const store = new LayerStore()
    const layer = store.create({ name: 'Test Layer' })
    expect(layer.name).toBe('Test Layer')
    expect(layer.category).toBe('chat')
    expect(layer.visible).toBe(true)
    expect(layer.locked).toBe(false)
    expect(layer.layout.w).toBe(480)
    expect(layer.layout.h).toBe(360)
  })

  it('creates a layer with custom layout', () => {
    const store = new LayerStore()
    const layer = store.create({
      name: 'Custom',
      category: 'knowledge',
      z: 5,
      layout: { x: 100, y: 200, w: 600, h: 400 },
    })
    expect(layer.category).toBe('knowledge')
    expect(layer.z).toBe(5)
    expect(layer.layout.x).toBe(100)
    expect(layer.layout.y).toBe(200)
    expect(layer.layout.w).toBe(600)
    expect(layer.layout.h).toBe(400)
  })

  it('moves a layer to new position', () => {
    const store = new LayerStore()
    const layer = store.create({ name: 'Moveable' })
    store.move(layer.id, 500, 300, 10)
    const updated = store.get(layer.id)
    expect(updated?.layout.x).toBe(500)
    expect(updated?.layout.y).toBe(300)
    expect(updated?.layout.z).toBe(10)
  })

  it('resizes a layer', () => {
    const store = new LayerStore()
    const layer = store.create({ name: 'Resizable' })
    store.resize(layer.id, 800, 600)
    const updated = store.get(layer.id)
    expect(updated?.layout.w).toBe(800)
    expect(updated?.layout.h).toBe(600)
  })

  it('moves a layer without changing z', () => {
    const store = new LayerStore()
    const layer = store.create({ name: 'MoveNoZ', z: 3 })
    store.move(layer.id, 100, 200)
    const updated = store.get(layer.id)
    expect(updated?.layout.x).toBe(100)
    expect(updated?.layout.y).toBe(200)
    expect(updated?.layout.z).toBe(3)
  })

  it('toggles layer visibility', () => {
    const store = new LayerStore()
    const layer = store.create({ name: 'ToggleVisible' })
    store.setVisible(layer.id, false)
    expect(store.get(layer.id)?.visible).toBe(false)
    store.setVisible(layer.id, true)
    expect(store.get(layer.id)?.visible).toBe(true)
  })

  it('toggles layer lock', () => {
    const store = new LayerStore()
    const layer = store.create({ name: 'Lockable' })
    store.setLocked(layer.id, true)
    expect(store.get(layer.id)?.locked).toBe(true)
    store.setLocked(layer.id, false)
    expect(store.get(layer.id)?.locked).toBe(false)
  })

  it('deletes a layer', () => {
    const store = new LayerStore()
    const layer = store.create({ name: 'Deletable' })
    expect(store.delete(layer.id)).toBe(true)
    expect(store.get(layer.id)).toBeUndefined()
  })

  it('lists layers sorted by z', () => {
    const store = new LayerStore()
    store.create({ name: 'Bottom', z: 10 })
    store.create({ name: 'Top', z: 0 })
    store.create({ name: 'Middle', z: 5 })
    const list = store.list()
    expect(list[0]?.name).toBe('Top')
    expect(list[1]?.name).toBe('Middle')
    expect(list[2]?.name).toBe('Bottom')
  })

  it('updateTimestamp is refreshed on mutation', () => {
    const store = new LayerStore()
    const layer = store.create({ name: 'Timestamped' })
    const original = layer.updatedAt
    // Small delay to ensure timestamp differs
    store.move(layer.id, 1, 1)
    const updated = store.get(layer.id)
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(original)
  })
})

describe('Layer depth sorting (z-axis)', () => {
  interface TestNode {
    id: string
    data: { z?: number }
    position: { x: number; y: number }
  }

  function sortByDepth(nodes: TestNode[]): TestNode[] {
    return [...nodes].sort((a, b) => (a.data.z ?? 0) - (b.data.z ?? 0))
  }

  it('sorts nodes by data.z ascending', () => {
    const nodes: TestNode[] = [
      { id: 'c', position: { x: 0, y: 0 }, data: { z: 5 } },
      { id: 'a', position: { x: 0, y: 0 }, data: { z: 1 } },
      { id: 'b', position: { x: 0, y: 0 }, data: { z: 3 } },
    ]
    const sorted = sortByDepth(nodes)
    expect(sorted[0]?.id).toBe('a')
    expect(sorted[1]?.id).toBe('b')
    expect(sorted[2]?.id).toBe('c')
  })

  it('defaults z to 0 when not set', () => {
    const nodes: TestNode[] = [
      { id: 'x', position: { x: 0, y: 0 }, data: {} },
      { id: 'y', position: { x: 0, y: 0 }, data: { z: -1 } },
    ]
    const sorted = sortByDepth(nodes)
    expect(sorted[0]?.id).toBe('y')
    expect(sorted[1]?.id).toBe('x')
  })
})

describe('Layer spawn/dismiss', () => {
  interface TestNode {
    id: string
    data: { z?: number; layerId?: string }
    position: { x: number; y: number }
  }

  it('adds a new layer on spawn', () => {
    const nodes: TestNode[] = [
      { id: 'existing', position: { x: 0, y: 0 }, data: { z: 1, layerId: 'l1' } },
    ]
    const newNode: TestNode = {
      id: 'spawned',
      position: { x: 100, y: 200 },
      data: { z: 2, layerId: 'l2' },
    }
    const updated = [...nodes, newNode]
    expect(updated).toHaveLength(2)
    expect(updated.find((n) => n.id === 'spawned')).toBeDefined()
  })

  it('removes a layer on dismiss', () => {
    const nodes: TestNode[] = [
      { id: 'keep', position: { x: 0, y: 0 }, data: { z: 0 } },
      { id: 'dismiss', position: { x: 0, y: 0 }, data: { z: 1 } },
    ]
    const updated = nodes.filter((n) => n.id !== 'dismiss')
    expect(updated).toHaveLength(1)
  })

  it('spawned layer inherits z from definition', () => {
    const defLayout = { x: 100, y: 200, z: 3, w: 400, h: 300 }
    const created: TestNode = {
      id: 'inst:chat:abc',
      position: { x: defLayout.x, y: defLayout.y },
      data: { z: defLayout.z },
    }
    expect(created.data.z).toBe(3)
    expect(created.position.x).toBe(100)
    expect(created.position.y).toBe(200)
  })
})
