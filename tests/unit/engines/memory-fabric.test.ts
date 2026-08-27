// tests/unit/engines/memory-fabric.test.ts
// MemoryFabric — federated per-agent memory provisioning, backend guards, idempotency.
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { MemoryBackend } from '../../../src/engines/memory/memory-backend.js'
import type { MemoryFabricDeps } from '../../../src/engines/memory/memory-fabric.js'
import { MemoryFabric } from '../../../src/engines/memory/memory-fabric.js'
import { MemoryBackendLimitError, MemoryError } from '../../../src/errors.js'

function makeDeps(overrides?: Partial<MemoryFabricDeps>): MemoryFabricDeps {
  return {
    agenticStore: {
      bindCapability: mock(() => Promise.resolve()),
    } as never,
    registry: {
      get: mock(() => undefined),
      register: mock(() => {}),
    } as never,
    nodeStore: {
      putNode: mock(() => Promise.resolve({ id: 'node-1' })),
      getNode: mock(() => Promise.resolve(null)),
      getOutgoingEdges: mock(() => Promise.resolve([])),
      listNodes: mock(() => Promise.resolve([])),
    } as never,
    extractorStore: {} as never,
    semanticStore: {} as never,
    beliefStore: {} as never,
    writeQuota: 0,
    ...overrides,
  }
}

function makeBackend(name = 'external'): MemoryBackend {
  return {
    name,
    isAvailable: () => true,
    initialize: () => {},
    shutdown: () => {},
    systemPromptBlock: () => '',
    prefetch: mock(() => Promise.resolve('')),
    syncTurn: () => {},
    getToolSchemas: () => [],
    handleToolCall: () => '',
  }
}

describe('MemoryFabric', () => {
  let deps: MemoryFabricDeps
  let fabric: MemoryFabric

  beforeEach(() => {
    deps = makeDeps()
    fabric = new MemoryFabric(deps)
  })

  describe('addBackend', () => {
    it('registers an external backend', () => {
      const backend = makeBackend('redis')
      fabric.addBackend(backend)
      expect(fabric.getExternalBackend()).toBe(backend)
    })

    it('throws when registering node backend (built-in)', () => {
      expect(() => fabric.addBackend(makeBackend('node'))).toThrow(MemoryError)
    })

    it('throws when registering a second different backend (one-external-backend guard D3)', () => {
      fabric.addBackend(makeBackend('redis'))
      expect(() => fabric.addBackend(makeBackend('postgres'))).toThrow(MemoryBackendLimitError)
    })

    it('allows re-registering the same backend name', () => {
      const b1 = makeBackend('redis')
      const b2 = makeBackend('redis')
      fabric.addBackend(b1)
      fabric.addBackend(b2)
      expect(fabric.getExternalBackend()).toBe(b2)
    })
  })

  describe('provisionAgentMemory', () => {
    it('creates subsystem node and returns subsystem', async () => {
      const result = await fabric.provisionAgentMemory('agent-1', 'run-1')
      expect(result).not.toBeNull()
      expect(result?.agentId).toBe('agent-1')
      expect(result?.runId).toBe('run-1')
      expect(deps.nodeStore.putNode).toHaveBeenCalled()
    })

    it('returns null when memoryConfig is none', async () => {
      const result = await fabric.provisionAgentMemory('agent-1', 'run-1', undefined, {
        memoryConfig: 'none',
      })
      expect(result).toBeNull()
    })

    it('is idempotent — re-provisioning returns existing subsystem (D12)', async () => {
      const first = await fabric.provisionAgentMemory('agent-1', 'run-1')
      const second = await fabric.provisionAgentMemory('agent-1', 'run-1')
      expect(first).toBe(second)
    })

    it('stores parentAgentId when provided', async () => {
      const result = await fabric.provisionAgentMemory('child-1', 'run-2', 'parent-1')
      expect(result).not.toBeNull()
      expect(result?.parentAgentId).toBe('parent-1')
    })
  })

  describe('getSubsystem', () => {
    it('returns subsystem by agent id', async () => {
      await fabric.provisionAgentMemory('agent-1', 'run-1')
      const sub = fabric.getSubsystem('agent-1')
      expect(sub).not.toBeNull()
      expect(sub?.agentId).toBe('agent-1')
    })

    it('returns undefined for unknown agent', () => {
      expect(fabric.getSubsystem('nonexistent')).toBeUndefined()
    })
  })

  describe('multiple agents', () => {
    it('provisions and retrieves independent subsystems', async () => {
      await fabric.provisionAgentMemory('agent-1', 'run-1')
      await fabric.provisionAgentMemory('agent-2', 'run-2')
      const sub1 = fabric.getSubsystem('agent-1')
      const sub2 = fabric.getSubsystem('agent-2')
      expect(sub1).toBeDefined()
      expect(sub2).toBeDefined()
      expect(sub1?.agentId).toBe('agent-1')
      expect(sub2?.agentId).toBe('agent-2')
    })
  })
})
