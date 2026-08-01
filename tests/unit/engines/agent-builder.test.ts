// tests/unit/engines/agent-builder.test.ts
import { describe, expect, it, beforeEach } from 'bun:test'
import { AgentBuilderEngine } from '../../../src/engines/agent-builder.js'
import type { AgenticStoreContract } from '../../../src/storage/contracts/agentic-store.js'

describe('AgentBuilderEngine', () => {
  let engine: AgentBuilderEngine
  let mockStore: AgenticStoreContract
  let nodesMap: Map<string, any>

  beforeEach(() => {
    nodesMap = new Map()
    mockStore = {
      startBuilderRun: async (intent, mode, initiator) => {
        return { id: 'builder-run-1' }
      },
      spawnFromBuilder: async (builderRunId) => {
        return { agentId: 'agent-1', runId: 'run-1' }
      },
      nodes: {
        getNode: async (id: string) => nodesMap.get(id) ?? null,
        updateNode: async (id: string, update: any) => {
          const existing = nodesMap.get(id) ?? {}
          nodesMap.set(id, { ...existing, ...update })
        },
      },
    } as unknown as AgenticStoreContract

    engine = new AgentBuilderEngine(mockStore)
  })

  it('starts a builder run', async () => {
    const res = await engine.startBuilderRun(
      { goal: 'build agent' },
      'human_led',
      { id: 'user-1', type: 'user' },
    )
    expect(res.id).toBe('builder-run-1')
  })

  it('spawns from builder run', async () => {
    const res = await engine.spawnFromBuilder('builder-run-1')
    expect(res.agentId).toBe('agent-1')
    expect(res.runId).toBe('run-1')
  })

  it('spawns a child agent run and links edge to parent', async () => {
    nodesMap.set('parent-run-1', {
      id: 'parent-run-1',
      dataJson: '{}',
      edgesJson: '[]',
    })

    const res = await engine.spawnChild(
      'parent-run-1',
      { goal: 'child task' },
      { id: 'parent-agent-1', type: 'agent' },
    )

    expect(res.builderRunId).toBe('builder-run-1')
    expect(res.agentId).toBe('agent-1')
    expect(res.runId).toBe('run-1')

    const updatedParent = nodesMap.get('parent-run-1')
    expect(updatedParent.edgesJson).toContain('run-1')
  })
})
