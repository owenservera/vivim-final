import { describe, expect, it } from 'bun:test'
import { AutonomousExecutionEngine } from '../../../src/engines/autonomous-execution.js'
import type { AutonomousStep } from '../../../src/engines/autonomous-execution.js'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import type { AutonomousExecutionStore } from '../../../src/storage/contracts/autonomous-store.js'

function makeStep(): AutonomousStep {
  return {
    id: 'step-1',
    taskId: 'task-1',
    stepIndex: 0,
    description: 'Clarify the target',
    action: 'cap.ask',
    actionInput: {},
    classification: 'read',
    status: 'pending',
    result: null,
    error: null,
    startedAt: null,
    completedAt: null,
    requiresHumanApproval: false,
    parentStepId: null,
    isCompositeRoot: false,
  }
}

function makeStore(resolveResponse: string): AutonomousExecutionStore {
  let storedGateId = ''
  return {
    async createTask() {},
    async createStep() {},
    async updateStep() {},
    async getTask() {
      return null
    },
    async getStatus() {
      return null
    },
    async listTasks() {
      return []
    },
    async createHitlGate(input: Record<string, unknown>) {
      storedGateId = String(input.id)
    },
    async updateHitlGate() {},
    async getGate(id: string) {
      if (id !== storedGateId) return null
      return {
        id,
        taskId: 'task-1',
        stepId: 'step-1',
        gateType: 'option',
        prompt: 'pick',
        optionsJson: JSON.stringify(['a', 'b']),
        defaultValue: null,
        status: 'approved',
        resolvedBy: 'tester',
        resolvedAt: Date.now(),
        response: resolveResponse,
        createdAt: Date.now(),
        expiresAt: null,
      }
    },
    async getPendingGates() {
      return []
    },
  } as unknown as AutonomousExecutionStore
}

describe('AutonomousExecutionEngine.clarify (Unit 34.2)', () => {
  it('emits agent:clarify and resolves with the human response', async () => {
    const emitted: unknown[] = []
    const bus = {
      emit: (e: unknown) => {
        emitted.push(e)
      },
      on: () => {},
    } as unknown as CapabilityEventBus

    const engine = new AutonomousExecutionEngine(
      makeStore('b'),
      {} as never,
      {} as never,
      {} as never,
      bus,
    )

    const response = await engine.clarify(makeStep(), 'pick one', 'option', {
      options: ['a', 'b'],
    })

    expect(response).toBe('b')
    const clarifyEvents = emitted.filter((e) => (e as { type?: string }).type === 'agent:clarify')
    expect(clarifyEvents).toHaveLength(1)
    expect((clarifyEvents[0] as { gateType: string }).gateType).toBe('option')
    expect((clarifyEvents[0] as { options: string[] }).options).toEqual(['a', 'b'])
  })

  it('returns null when the gate is not resolved in time', async () => {
    const store = makeStore('b')
    // override getGate to keep it pending (never resolved)
    ;(store as { getGate?: unknown }).getGate = () => Promise.resolve(null)
    const engine = new AutonomousExecutionEngine(
      store,
      {} as never,
      {} as never,
      {} as never,
      { emit: () => {}, on: () => {} } as unknown as CapabilityEventBus,
    )
    const response = await engine.clarify(makeStep(), 'url?', 'url', { timeoutMs: 10 })
    expect(response).toBeNull()
  })
})
