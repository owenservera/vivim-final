// tests/unit/engines/canvas-layer-mounter.test.ts
// CanvasLayerMounter — canvas layer lifecycle events.
import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { CanvasLayerMounter, type LayerDefinition } from '../../../src/engines/canvas-layer-mounter.js'
import type { CapabilityEventBus, EngineEvent } from '../../../src/engines/capability-event-bus.js'

function makeEventBus() {
  const events: EngineEvent[] = []
  return {
    events,
    emit: mock((e: EngineEvent) => { events.push(e) }),
    on: mock(() => () => {}),
    off: mock(() => {}),
    subscribe: mock(() => {}),
    unsubscribe: mock(() => {}),
  } as unknown as CapabilityEventBus & { events: EngineEvent[] }
}

function makeDef(overrides?: Partial<LayerDefinition>): LayerDefinition {
  return {
    id: 'layer-1',
    slug: 'test-layer',
    category: 'test',
    layout: { x: 0, y: 0, z: 1, w: 400, h: 300 },
    ...overrides,
  }
}

describe('CanvasLayerMounter', () => {
  let bus: ReturnType<typeof makeEventBus>
  let mounter: CanvasLayerMounter

  beforeEach(() => {
    bus = makeEventBus()
    mounter = new CanvasLayerMounter(bus)
  })

  it('spawn creates a layer and emits canvas:layer:spawned', async () => {
    const def = makeDef()
    const layer = await mounter.spawn(def)
    expect(layer.instanceId).toContain('test-layer')
    expect(layer.definitionId).toBe('layer-1')
    expect(layer.slug).toBe('test-layer')
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'canvas:layer:spawned' }),
    )
  })

  it('spawn generates unique instanceIds', async () => {
    const l1 = await mounter.spawn(makeDef({ id: 'a', slug: 'a' }))
    const l2 = await mounter.spawn(makeDef({ id: 'b', slug: 'b' }))
    expect(l1.instanceId).not.toBe(l2.instanceId)
  })

  it('dismiss removes layer and emits canvas:layer:dismissed', async () => {
    const layer = await mounter.spawn(makeDef())
    const result = await mounter.dismiss(layer.instanceId)
    expect(result).toBe(true)
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'canvas:layer:dismissed', instanceId: layer.instanceId }),
    )
  })

  it('dismiss returns false for unknown instanceId', async () => {
    const result = await mounter.dismiss('inst:unknown:999')
    expect(result).toBe(false)
  })

  it('listMounted returns all mounted layers', async () => {
    await mounter.spawn(makeDef({ id: 'a', slug: 'a' }))
    await mounter.spawn(makeDef({ id: 'b', slug: 'b' }))
    const list = mounter.listMounted()
    expect(list).toHaveLength(2)
  })

  it('listMounted is empty after all dismissed', async () => {
    const layer = await mounter.spawn(makeDef())
    await mounter.dismiss(layer.instanceId)
    expect(mounter.listMounted()).toHaveLength(0)
  })
})
