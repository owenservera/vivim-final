// tests/unit/server/autonomous-bootstrap.test.ts
// Unit coverage for Unit 1.2 — wire AutonomousExecutionEngine into server bootstrap.
//
// NOTE: The spec's "live server POST /api/autonomous/execute -> 200" requires a full
// createServerWithEngines() boot, which needs a real ChromeGovernor (browser) + DB + LLM.
// That belongs to the integration tier. Here we verify the two contract facts that are
// unit-testable: (a) the real engine is constructed with a REAL UnifiedCapabilityRegistry
// (no `{} as never` escape hatch), and (b) the autonomous router returns 200 from its
// three read/write endpoints when given a wired engine.

import { describe, expect, it, mock } from 'bun:test'
import { AutonomousExecutionEngine } from '../../../src/engines/autonomous-execution.js'
import { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import { createAutonomousRouter } from '../../../src/server/autonomous-router.js'

function makeReq(path: string, method = 'GET', body?: unknown) {
  const init: RequestInit = { method }
  if (body) init.body = JSON.stringify(body)
  return new Request(`http://localhost:9420${path}`, init)
}

function call(
  router: (req: Request, url: URL) => Promise<Response | null>,
  path: string,
  method = 'GET',
  body?: unknown,
) {
  const req = makeReq(path, method, body)
  return router(req, new URL(req.url))
}

const stubEventBus = { emit: mock(() => {}), on: mock(() => {}) } as any
const stubGovernor = {} as any
const stubStore = { createTask: mock(() => Promise.resolve()) } as any

describe('Unit 1.2 — AutonomousExecutionEngine registry wiring', () => {
  it('constructs with a real UnifiedCapabilityRegistry (not {} as never)', () => {
    const registry = new UnifiedCapabilityRegistry()
    const engine = new AutonomousExecutionEngine(
      stubStore,
      registry,
      {} as any,
      stubGovernor,
      stubEventBus,
    )
    expect(engine).toBeDefined()
    expect((engine as any).registry).toBeInstanceOf(UnifiedCapabilityRegistry)
    expect((engine as any).registry).toBe(registry)
  })
})

describe('Unit 1.2 — Autonomous router endpoints', () => {
  const stubEngine = {
    execute: mock(() => Promise.resolve({ id: 't1', status: 'planning' })),
    listTasks: mock(() => Promise.resolve([])),
    getPendingGates: mock(() => Promise.resolve([])),
  } as any

  const router = createAutonomousRouter({
    autonomousEngine: stubEngine,
    policyEngine: {} as any,
  })

  it('POST /api/autonomous/execute returns 200 with taskId+status', async () => {
    const res = await call(router, '/api/autonomous/execute', 'POST', {
      goal: { description: 'do a thing' },
    })
    expect(res).not.toBeNull()
    expect(res!.status).toBe(200)
    const body = (await res!.json()) as { taskId: string; status: string }
    expect(body.taskId).toBe('t1')
    expect(body.status).toBe('planning')
  })

  it('POST /api/autonomous/execute returns 400 when goal.description missing', async () => {
    const res = await call(router, '/api/autonomous/execute', 'POST', {})
    expect(res!.status).toBe(400)
  })

  it('GET /api/autonomous/tasks returns 200', async () => {
    const res = await call(router, '/api/autonomous/tasks')
    expect(res!.status).toBe(200)
    const body = (await res!.json()) as { tasks: unknown[] }
    expect(Array.isArray(body.tasks)).toBe(true)
  })

  it('GET /api/autonomous/gates returns 200', async () => {
    const res = await call(router, '/api/autonomous/gates')
    expect(res!.status).toBe(200)
    const body = (await res!.json()) as { gates: unknown[] }
    expect(Array.isArray(body.gates)).toBe(true)
  })
})
