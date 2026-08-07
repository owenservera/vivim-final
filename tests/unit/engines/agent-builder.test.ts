// tests/unit/engines/agent-builder.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import { AgentBuilderEngine } from '../../../src/engines/agent-builder.js'
import type { AgenticStoreContract } from '../../../src/storage/contracts/agentic-store.js'

describe('AgentBuilderEngine', () => {
  let engine: AgentBuilderEngine
  let mockStore: AgenticStoreContract
  let nodesMap: Map<string, any>

  beforeEach(() => {
    nodesMap = new Map()
    mockStore = {
      startBuilderRun: async (
        _intent: Record<string, unknown>,
        _mode: string,
        _initiator: { kind: string; id: string },
      ) => {
        return { id: 'builder-run-1' }
      },
      spawnFromBuilder: async (_builderRunId: string) => {
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
    const res = await engine.startBuilderRun({ goal: 'build agent' }, 'human_led', {
      id: 'user-1',
      kind: 'user',
    })
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
      { id: 'parent-agent-1', kind: 'agent' },
    )

    expect(res.builderRunId).toBe('builder-run-1')
    expect(res.agentId).toBe('agent-1')
    expect(res.runId).toBe('run-1')

    const updatedParent = nodesMap.get('parent-run-1')
    expect(updatedParent.edgesJson).toContain('run-1')
  })
})
