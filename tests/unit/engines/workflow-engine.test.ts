import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  type WorkflowDefinition,
  WorkflowEngine,
  type WorkflowStore,
} from '../../../src/engines/workflow-engine.js'

function makeStore() {
  const workflows = new Map<string, WorkflowDefinition>()
  return {
    _workflows: workflows,
    getWorkflow: mock((id: string) => Promise.resolve(workflows.get(id) ?? null)),
    saveWorkflow: mock((def: WorkflowDefinition) => {
      workflows.set(def.id, def)
      return Promise.resolve()
    }),
    deleteWorkflow: mock((id: string) => {
      workflows.delete(id)
      return Promise.resolve()
    }),
    saveExecution: mock(() => Promise.resolve()),
    getExecution: mock(() => Promise.resolve(null)),
  } as unknown as WorkflowStore & { _workflows: Map<string, WorkflowDefinition> }
}

function makeGovernor() {
  return {
    executeScript: mock(() => Promise.resolve({ result: { value: null } })),
  } as any
}

function makeEventBus() {
  return { emit: mock(() => {}) } as any
}

function makeWf(id: string): WorkflowDefinition {
  return {
    id,
    name: `Workflow ${id}`,
    createdAt: 1,
    updatedAt: 1,
    nodes: [{ id: 'n1', type: 'manual', category: 'trigger', config: {} }],
    edges: [],
  }
}

describe('WorkflowEngine', () => {
  let store: ReturnType<typeof makeStore>
  let governor: ReturnType<typeof makeGovernor>
  let eventBus: ReturnType<typeof makeEventBus>
  let engine: WorkflowEngine

  beforeEach(() => {
    store = makeStore()
    governor = makeGovernor()
    eventBus = makeEventBus()
    engine = new WorkflowEngine(governor, store, eventBus)
  })

  test('createWorkflow saves and returns workflow', async () => {
    const wf = makeWf('w1')
    const result = await engine.createWorkflow(wf)
    expect(result.id).toBe('w1')
    expect(store.saveWorkflow).toHaveBeenCalled()
  })

  test('updateWorkflow patches existing', async () => {
    const wf = makeWf('w1')
    store._workflows.set('w1', wf)
    const result = await engine.updateWorkflow('w1', { name: 'Renamed' })
    expect(result.name).toBe('Renamed')
  })

  test('updateWorkflow throws for missing', async () => {
    await expect(engine.updateWorkflow('missing', { name: 'X' })).rejects.toThrow('not found')
  })

  test('deleteWorkflow delegates to store', async () => {
    await engine.deleteWorkflow('w1')
    expect(store.deleteWorkflow).toHaveBeenCalledWith('w1')
  })

  test('getWorkflow delegates to store', async () => {
    store._workflows.set('w1', makeWf('w1'))
    const result = await engine.getWorkflow('w1')
    expect(result?.id).toBe('w1')
  })

  test('cancelExecution throws for unknown execution', async () => {
    await expect(engine.cancelExecution('missing')).rejects.toThrow('not found')
  })
})
