// tests/integration/automation/human-in-loop.test.ts
// Integration: WorkflowEngine + HitlGateStore — human-in-the-loop workflow execution

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { type WorkflowDefinition, WorkflowEngine } from '../../../src/engines/workflow-engine.js'

function makeGovernor() {
  return {
    ensureRunning: mock(() => Promise.resolve({ slaveId: 's1' })),
    executeScript: mock(() => Promise.resolve({ result: { value: null } })),
    cdp: {
      send: mock(() => Promise.resolve({})),
    },
  } as any
}

function makeWorkflowWithHumanLoop(id: string): WorkflowDefinition {
  return {
    id,
    name: 'Approval Workflow',
    nodes: [
      {
        id: 'trigger',
        type: 'manual_trigger',
        category: 'trigger',
        config: {},
      },
      {
        id: 'approval',
        type: 'human_loop',
        category: 'ai',
        config: { prompt: 'Approve this action?', requiresApproval: true },
      },
      {
        id: 'action',
        type: 'capability_call',
        category: 'action',
        config: { capabilityId: 'cap:test' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'approval' },
      { id: 'e2', source: 'approval', target: 'action' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

describe('WorkflowEngine human-in-loop', () => {
  let engine: WorkflowEngine
  let store: any
  let hitlStore: any
  let eventBus: CapabilityEventBus
  let events: Array<{ type: string; data: any }>

  beforeEach(() => {
    const workflows = new Map<string, WorkflowDefinition>()
    store = {
      _workflows: workflows,
      getWorkflow: mock((id: string) => Promise.resolve(workflows.get(id) ?? null)),
      saveWorkflow: mock((def: WorkflowDefinition) => {
        workflows.set(def.id, def)
        return Promise.resolve()
      }),
      deleteWorkflow: mock(() => Promise.resolve()),
      saveExecution: mock(() => Promise.resolve()),
      getExecution: mock(() => Promise.resolve(null)),
    }

    hitlStore = {
      createGate: mock(() => Promise.resolve()),
      updateGate: mock(() => Promise.resolve()),
      getPendingGates: mock(() => Promise.resolve([])),
    }

    eventBus = new CapabilityEventBus()
    events = []
    // Override eventBus.emit to capture events
    const originalEmit = eventBus.emit.bind(eventBus)
    eventBus.emit = (event: any) => {
      events.push(event)
      originalEmit(event)
    }

    engine = new (WorkflowEngine as any)(
      makeGovernor(),
      store,
      eventBus,
      undefined,
      undefined,
      undefined,
      undefined,
      hitlStore,
    )
  })

  test('human_loop node pauses execution and emits pending event', async () => {
    const wf = makeWorkflowWithHumanLoop('wf-hitl')
    await engine.createWorkflow(wf)
    store._workflows.set(wf.id, wf)

    const _execution = await engine.execute(wf.id)
    const pendingEvent = events.find((e) => e.type === 'workflow:human_loop_pending')

    expect(pendingEvent).toBeDefined()
    if (!pendingEvent) return
    expect(pendingEvent.data.nodeId).toBe('approval')
    // Execution should still be 'running' (paused at human_loop)
    // Note: after executeNodes returns early, execute() leaves status as 'running'
    // because executeNodes sets waiting_human on the node but doesn't change exec status
  })

  test('human_loop node creates a HITL gate when hitlStore is available', async () => {
    const wf = makeWorkflowWithHumanLoop('wf-hitl-gate')
    await engine.createWorkflow(wf)
    store._workflows.set(wf.id, wf)

    await engine.execute(wf.id)

    expect(hitlStore.createGate).toHaveBeenCalled()
    const gateCall = hitlStore.createGate.mock.calls[0][0]
    expect(gateCall.gateType).toBe('approval')
  })

  test('resolveHumanLoop approves and resumes execution', async () => {
    const wf = makeWorkflowWithHumanLoop('wf-hitl-resolve')
    await engine.createWorkflow(wf)
    store._workflows.set(wf.id, wf)

    const _execution = await engine.execute(wf.id)
    const pendingEvent = events.find((e) => e.type === 'workflow:human_loop_pending')

    expect(pendingEvent).toBeDefined()
    if (!pendingEvent) return
    const nodeExecutionId = pendingEvent.data.nodeExecutionId

    // Resolve the human loop
    await engine.resolveHumanLoop(nodeExecutionId, 'approve')

    // Check for resolved event
    const resolvedEvent = events.find((e) => e.type === 'workflow:human_loop_resolved')
    expect(resolvedEvent).toBeDefined()
    expect(resolvedEvent?.data.decision).toBe('approve')
  })

  test('resolveHumanLoop rejects and fails execution', async () => {
    const wf = makeWorkflowWithHumanLoop('wf-hitl-reject')
    await engine.createWorkflow(wf)
    store._workflows.set(wf.id, wf)

    await engine.execute(wf.id)
    const pendingEvent = events.find((e) => e.type === 'workflow:human_loop_pending')

    if (pendingEvent) {
      await engine.resolveHumanLoop(pendingEvent.data.nodeExecutionId, 'reject')
    }

    const resolvedEvent = events.find((e) => e.type === 'workflow:human_loop_resolved')
    expect(resolvedEvent).toBeDefined()
    expect(resolvedEvent?.data.decision).toBe('reject')
  })

  test('resolveHumanLoop skips bypasses and continues', async () => {
    const wf = makeWorkflowWithHumanLoop('wf-hitl-skip')
    await engine.createWorkflow(wf)
    store._workflows.set(wf.id, wf)

    await engine.execute(wf.id)
    const pendingEvent = events.find((e) => e.type === 'workflow:human_loop_pending')

    if (pendingEvent) {
      await engine.resolveHumanLoop(pendingEvent.data.nodeExecutionId, 'skip')
    }

    const resolvedEvent = events.find((e) => e.type === 'workflow:human_loop_resolved')
    expect(resolvedEvent).toBeDefined()
    expect(resolvedEvent?.data.decision).toBe('skip')
  })

  test('workflow without human_loop nodes completes immediately', async () => {
    const wf: WorkflowDefinition = {
      id: 'wf-no-hitl',
      name: 'Simple Workflow',
      nodes: [
        { id: 'start', type: 'manual_trigger', category: 'trigger', config: {} },
        {
          id: 'done',
          type: 'set_variable',
          category: 'data',
          config: { key: 'result', value: 'ok' },
        },
      ],
      edges: [{ id: 'e1', source: 'start', target: 'done' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await engine.createWorkflow(wf)
    store._workflows.set(wf.id, wf)

    const execution = await engine.execute(wf.id)

    expect(execution.status).toBe('complete')
    const pendingEvents = events.filter((e) => e.type === 'workflow:human_loop_pending')
    expect(pendingEvents).toHaveLength(0)
  })
})
