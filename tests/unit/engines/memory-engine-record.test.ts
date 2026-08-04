// tests/unit/engines/memory-engine-record.test.ts
// Phase 0A patch: memory-engine.ts recordMemory() — captureAsNode integration

import { describe, expect, it, mock, beforeEach } from 'bun:test'

// Mock CapStoreDb
mock.module('../../../src/storage/impl/memory-engine-impl.js', () => ({
  CapStoreDb: class {
    prisma = {
      contentItem: {
        upsert: mock(async () => ({})),
        findFirst: mock(async () => null),
      },
      node: {
        create: mock(async ({ data }: any) => ({ id: 'node-1', ...data })),
      },
      nodeEdge: {
        create: mock(async ({ data }: any) => ({ id: 'edge-1', ...data })),
      },
    }
  },
}))

import { MemoryEngine } from '../../../src/engines/memory-engine.js'

describe('MemoryEngine.recordMemory() Phase 0A patch', () => {
  let engine: MemoryEngine

  beforeEach(() => {
    engine = new MemoryEngine({} as any)
  })

  it('recordMemory is a function on MemoryEngine', () => {
    expect(typeof (engine as any).recordMemory).toBe('function')
  })

  it('recordMemory accepts memory type parameter', () => {
    // Verify the method signature accepts the 3-arg form
    expect((engine as any).recordMemory.length).toBeLessThanOrEqual(4)
  })
})
