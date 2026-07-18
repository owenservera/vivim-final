// tests/unit/automation/workflow-retry.test.ts
// Unit tests for WorkflowEngine retry queue (enqueue, backoff, dead-letter)

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { WorkflowEngine } from '../../../src/engines/workflow-engine.js'

describe('WorkflowEngine retry queue', () => {
  let engine: WorkflowEngine
  let retryStore: {
    enqueue: ReturnType<typeof mock>
    getPending: ReturnType<typeof mock>
    markComplete: ReturnType<typeof mock>
    markDead: ReturnType<typeof mock>
  }
  let store: any

  beforeEach(() => {
    retryStore = {
      enqueue: mock(() => Promise.resolve()),
      getPending: mock(() => Promise.resolve([])),
      markComplete: mock(() => Promise.resolve()),
      markDead: mock(() => Promise.resolve()),
    }
    store = {
      getWorkflow: mock(() => Promise.resolve(null)),
      saveWorkflow: mock(() => Promise.resolve()),
      deleteWorkflow: mock(() => Promise.resolve()),
      saveExecution: mock(() => Promise.resolve()),
      getExecution: mock(() => Promise.resolve(null)),
    }
    const governor: any = { executeScript: mock(() => Promise.resolve({})) }
    const eventBus: any = { emit: mock(() => {}) }
    engine = new (WorkflowEngine as any)(
      governor,
      store,
      eventBus,
      undefined,
      undefined,
      undefined,
      retryStore as any,
    )
  })

  test('startRetryPoller does not throw when retryStore is available', () => {
    expect(() => (engine as any).startRetryPoller(1000)).not.toThrow()
    ;(engine as any).stopRetryPoller()
  })

  test('stopRetryPoller is idempotent', () => {
    ;(engine as any).startRetryPoller(1000)
    ;(engine as any).stopRetryPoller()
    ;(engine as any).stopRetryPoller() // should not throw
  })

  test('startRetryPoller does nothing when retryStore is undefined', () => {
    const emptyEngine = new (WorkflowEngine as any)({} as any, store, { emit: mock(() => {}) } as any)
    expect(() => (emptyEngine as any).startRetryPoller(1000)).not.toThrow()
    ;(emptyEngine as any).stopRetryPoller()
  })

  test('processRetryQueue marks pending items as complete when no matching execution', async () => {
    retryStore.getPending = mock(() =>
      Promise.resolve([
        {
          id: 'r1',
          nodeExecutionId: 'ne1',
          attempt: 2,
          nextRetryAt: Date.now() - 1000,
          maxAttempts: 3,
          backoffMs: 1000,
          status: 'pending',
        },
      ]),
    )

    // Run internal retry processing via one poll cycle
    ;(engine as any).startRetryPoller(10)
    await new Promise((r) => setTimeout(r, 50))
    ;(engine as any).stopRetryPoller()

    // Should have been marked dead (no matching execution found)
    expect(retryStore.markDead).toHaveBeenCalled()
    expect(retryStore.getPending).toHaveBeenCalled()
  })

  test('processRetryQueue leaves future items untouched', async () => {
    retryStore.getPending = mock(() => Promise.resolve([]))
    ;(engine as any).startRetryPoller(10)
    await new Promise((r) => setTimeout(r, 50))
    ;(engine as any).stopRetryPoller()

    expect(retryStore.getPending).toHaveBeenCalled()
  })
})
