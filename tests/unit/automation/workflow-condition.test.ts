// tests/unit/automation/workflow-condition.test.ts
// Unit tests for WorkflowEngine.evaluateCondition and conditional branching

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { WorkflowEngine } from '../../../src/engines/workflow-engine.js'

function makeGovernor() {
  return { executeScript: mock(() => Promise.resolve({ result: { value: null } })) } as any
}
function makeStore() {
  const workflows = new Map()
  return {
    getWorkflow: mock((id: string) => Promise.resolve(workflows.get(id) ?? null)),
    saveWorkflow: mock(() => Promise.resolve()),
    deleteWorkflow: mock(() => Promise.resolve()),
    saveExecution: mock(() => Promise.resolve()),
    getExecution: mock(() => Promise.resolve(null)),
    _workflows: workflows,
  } as any
}
function makeEventBus() {
  return { emit: mock(() => {}) } as any
}

describe('WorkflowEngine.evaluateCondition', () => {
  let engine: WorkflowEngine

  beforeEach(() => {
    const store = makeStore()
    const governor = makeGovernor()
    const eventBus = makeEventBus()
    engine = new WorkflowEngine(governor, store, eventBus)
  })

  test('evaluates simple equality condition', () => {
    expect((engine as any).evaluateCondition('$result.status === "ok"', { status: 'ok' })).toBe(
      true,
    )
    expect((engine as any).evaluateCondition('$result.status === "ok"', { status: 'error' })).toBe(
      false,
    )
  })

  test('evaluates numeric condition', () => {
    expect((engine as any).evaluateCondition('$result.count > 5', { count: 10 })).toBe(true)
    expect((engine as any).evaluateCondition('$result.count > 5', { count: 3 })).toBe(false)
  })

  test('evaluates compound condition with &&', () => {
    expect(
      (engine as any).evaluateCondition('$result.status === "ok" && $result.count > 0', {
        status: 'ok',
        count: 5,
      }),
    ).toBe(true)
    expect(
      (engine as any).evaluateCondition('$result.status === "ok" && $result.count > 0', {
        status: 'error',
        count: 5,
      }),
    ).toBe(false)
  })

  test('evaluates condition with ||', () => {
    expect(
      (engine as any).evaluateCondition('$result.status === "ok" || $result.fallback === true', {
        status: 'error',
        fallback: true,
      }),
    ).toBe(true)
  })

  test('evaluates boolean field directly', () => {
    expect((engine as any).evaluateCondition('$result.approved', { approved: true })).toBe(true)
    expect((engine as any).evaluateCondition('$result.approved', { approved: false })).toBe(false)
  })

  test('returns false for invalid expression', () => {
    expect((engine as any).evaluateCondition('invalid syntax (((', {})).toBe(false)
  })

  test('returns false when $result is empty', () => {
    expect((engine as any).evaluateCondition('$result.x > 0', {})).toBe(false)
    expect((engine as any).evaluateCondition('$result.x > 0', { x: undefined })).toBe(false)
  })

  test('evaluates truthiness', () => {
    expect((engine as any).evaluateCondition('$result.exists', { exists: 'yes' })).toBe(true)
    expect((engine as any).evaluateCondition('$result.exists', { exists: '' })).toBe(false)
    expect((engine as any).evaluateCondition('$result.exists', { exists: null })).toBe(false)
  })
})
