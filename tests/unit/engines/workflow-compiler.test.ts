import { beforeEach, describe, expect, test } from 'bun:test'
import { WorkflowCompiler } from '../../../src/engines/workflow-compiler.js'
import type { WorkflowDefinition } from '../../../src/engines/workflow-engine.js'

describe('WorkflowCompiler', () => {
  let compiler: WorkflowCompiler

  beforeEach(() => {
    compiler = new WorkflowCompiler()
  })

  test('compiles a simple linear workflow', () => {
    const def: WorkflowDefinition = {
      id: 'wf1',
      name: 'test',
      createdAt: 1,
      updatedAt: 1,
      nodes: [
        { id: 'n1', type: 'manual', category: 'trigger', config: {} },
        { id: 'n2', type: 'navigate', category: 'action', config: { url: 'https://x.com' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    }
    const result = compiler.compile(def)
    expect(result.ok).toBe(true)
    expect(result.compiled!.dag.nodes).toHaveLength(2)
    expect(result.compiled!.dag.nodes[0]!.moduleName).toBe('trigger-manual')
    expect(result.compiled!.dag.nodes[1]!.moduleName).toBe('action-navigate')
  })

  test('detects dangling edge references', () => {
    const def: WorkflowDefinition = {
      id: 'wf2',
      name: 'broken',
      createdAt: 1,
      updatedAt: 1,
      nodes: [{ id: 'n1', type: 'manual', category: 'trigger', config: {} }],
      edges: [{ id: 'e1', source: 'n1', target: 'missing' }],
    }
    const result = compiler.compile(def)
    expect(result.ok).toBe(false)
    expect(result.errors[0]!.message).toContain('not found')
  })

  test('detects cycles', () => {
    const def: WorkflowDefinition = {
      id: 'wf3',
      name: 'cycle',
      createdAt: 1,
      updatedAt: 1,
      nodes: [
        { id: 'a', type: 'manual', category: 'trigger', config: {} },
        { id: 'b', type: 'navigate', category: 'action', config: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
    }
    const result = compiler.compile(def)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.message.includes('Cycle'))).toBe(true)
  })

  test('maps action types correctly', () => {
    const def: WorkflowDefinition = {
      id: 'wf4',
      name: 'actions',
      createdAt: 1,
      updatedAt: 1,
      nodes: [
        { id: 'n1', type: 'click', category: 'action', config: {} },
        { id: 'n2', type: 'type_text', category: 'action', config: {} },
        { id: 'n3', type: 'screenshot', category: 'action', config: {} },
      ],
      edges: [],
    }
    const result = compiler.compile(def)
    expect(result.ok).toBe(true)
    expect(result.compiled!.dag.nodes[0]!.moduleName).toBe('action-click')
    expect(result.compiled!.dag.nodes[1]!.moduleName).toBe('action-type')
    expect(result.compiled!.dag.nodes[2]!.moduleName).toBe('action-screenshot')
  })
})
