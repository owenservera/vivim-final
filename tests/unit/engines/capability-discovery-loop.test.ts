// tests/unit/engines/capability-discovery-loop.test.ts
// CapabilityDiscoveryLoop — scan, dedupe, report, lifecycle.

import { describe, expect, it } from 'bun:test'
import { CapabilityDiscoveryLoop } from '../../../src/engines/capability-discovery-loop.js'

function makeRegistry(caps: any[]): any {
  return { list: () => caps }
}
function makeEventBus() {
  const emitted: any[] = []
  return { emitted, bus: { emit: (e: any) => emitted.push(e) } as any }
}

describe('CapabilityDiscoveryLoop', () => {
  it('discovers new capabilities on scan and emits events', async () => {
    const { emitted, bus } = makeEventBus()
    const caps = [
      {
        id: 'cap:a',
        slug: 'a',
        name: 'A',
        description: 'd',
        category: 'cat',
        surfaces: ['cli', 'ui'],
      },
    ]
    const loop = new CapabilityDiscoveryLoop(bus, makeRegistry(caps))
    const discovered = await loop.scan()
    expect(discovered.length).toBe(1)
    expect(discovered[0]?.id).toBe('cap:a')
    expect(
      emitted.some((e) => e.type === 'capability:discovered' && e.capabilityId === 'cap:a'),
    ).toBe(true)
  })

  it('does not re-discover already known capabilities', async () => {
    const { bus } = makeEventBus()
    const caps = [
      { id: 'cap:a', slug: 'a', name: 'A', description: 'd', category: 'cat', surfaces: [] },
    ]
    const loop = new CapabilityDiscoveryLoop(bus, makeRegistry(caps))
    await loop.scan()
    const second = await loop.scan()
    expect(second.length).toBe(0)
    expect(loop.listDiscovered().length).toBe(1)
  })

  it('aggregates a report by category and surface', async () => {
    const { bus } = makeEventBus()
    const caps = [
      {
        id: 'cap:a',
        slug: 'a',
        name: 'A',
        description: 'd',
        category: 'comm',
        surfaces: ['cli', 'ui'],
      },
      {
        id: 'cap:b',
        slug: 'b',
        name: 'B',
        description: 'd',
        category: 'comm',
        surfaces: ['ui', 'api'],
      },
    ]
    const loop = new CapabilityDiscoveryLoop(bus, makeRegistry(caps))
    await loop.scan()
    const report = loop.report()
    expect(report.total).toBe(2)
    expect(report.byCategory.comm).toBe(2)
    expect(report.bySurface.cli).toBe(1)
    expect(report.bySurface.ui).toBe(2)
  })

  it('start/stop emit lifecycle events', () => {
    const { emitted, bus } = makeEventBus()
    const loop = new CapabilityDiscoveryLoop(bus, makeRegistry([]))
    loop.start()
    expect(emitted.some((e) => e.type === 'discovery:started')).toBe(true)
    loop.stop()
    expect(emitted.some((e) => e.type === 'discovery:stopped')).toBe(true)
  })

  it('clear empties discovered state', async () => {
    const { bus } = makeEventBus()
    const caps = [
      { id: 'cap:a', slug: 'a', name: 'A', description: 'd', category: 'c', surfaces: [] },
    ]
    const loop = new CapabilityDiscoveryLoop(bus, makeRegistry(caps))
    await loop.scan()
    loop.clear()
    expect(loop.listDiscovered().length).toBe(0)
  })
})
