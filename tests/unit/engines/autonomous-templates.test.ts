import { describe, expect, it, beforeEach } from 'bun:test'
import { AutonomousExecutionEngine } from '../../../src/engines/autonomous-execution.js'
import type {
  AutonomousTask,
} from '../../../src/engines/autonomous-execution.js'
import type { AutonomousExecutionStore } from '../../../src/storage/contracts/autonomous-store.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { ExecutionPolicyEngine } from '../../../src/engines/execution-policy.js'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'

// ── Mocks ────────────────────────────────────────────────────────────────

function mockStore(): AutonomousExecutionStore {
  const tasks = new Map<string, AutonomousTask>()
  const templates = new Map<string, Record<string, unknown>>()
  return {
    createTask: async (t: Record<string, unknown>) => {
      tasks.set(t.id as string, t as unknown as AutonomousTask)
    },
    updateTask: async (id: string, patch: Record<string, unknown>) => {
      const t = tasks.get(id)
      if (t) Object.assign(t, patch)
    },
    getTask: async (id: string) => (tasks.get(id) ?? null) as unknown as Record<string, unknown>,
    createStep: async () => {},
    updateStep: async () => {},
    getSteps: async () => [],
    getStep: async () => null,
    createHitlGate: async () => {},
    updateHitlGate: async () => {},
    getPendingGates: async () => [],
    getGate: async () => null,
    listTasks: async () => [...tasks.values()] as unknown as Array<Record<string, unknown>>,
    // Template methods
    getTaskTemplate: async (id: string) => templates.get(id) ?? null,
    insertTaskTemplate: async (t: Record<string, unknown>) => {
      templates.set(t.id as string, t)
      return t.id as string
    },
    updateTaskTemplate: async (id: string, patch: Record<string, unknown>) => {
      const t = templates.get(id)
      if (t) Object.assign(t, patch)
    },
    listTaskTemplates: async (opts?: { isShared?: boolean }) => {
      const all = [...templates.values()]
      if (opts?.isShared !== undefined) {
        return all.filter((t) => (t.isShared as number) === (opts.isShared ? 1 : 0))
      }
      return all
    },
    _tasks: tasks,
    _templates: templates,
  } as any
}

function mockRegistry(): UnifiedCapabilityRegistry {
  return {
    execute: async () => ({ ok: true }),
    getBySlug: () => null,
    list: async () => [],
  } as unknown as UnifiedCapabilityRegistry
}

function mockPolicy(): ExecutionPolicyEngine {
  return {
    evaluate: async () => ({ allowed: true, reason: 'test' }),
  } as unknown as ExecutionPolicyEngine
}

function mockGovernor(): ChromeGovernor {
  return {
    ensureRunning: async () => ({ slaveId: 'test-slave' }),
    cdp: {
      send: async () => ({}),
      captureScreenshot: async () => 'base64-screenshot',
      getPageState: async () => ({ readyState: 'complete' }),
    },
    getTransport: () => null,
  } as unknown as ChromeGovernor
}

function mockEventBus(): CapabilityEventBus {
  return { emit: () => {} } as unknown as CapabilityEventBus
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('AutonomousExecutionEngine — Unit 8.10: Task templates', () => {
  let store: ReturnType<typeof mockStore>
  let engine: AutonomousExecutionEngine

  beforeEach(() => {
    store = mockStore()
    engine = new AutonomousExecutionEngine(
      store as unknown as AutonomousExecutionStore,
      mockRegistry(),
      mockPolicy(),
      mockGovernor(),
      mockEventBus(),
    )
  })

  it('saveTemplate persists with version 1', async () => {
    const id = await engine.saveTemplate(
      'Refactor Module',
      'Refactor {moduleName} to use {targetPattern}',
      ['moduleName', 'targetPattern'],
      true,
    )

    expect(id).toBeDefined()
    const row = await store.getTaskTemplate(id)
    expect(row).not.toBeNull()
    expect(row!.name).toBe('Refactor Module')
    expect(row!.planJson).toBe('Refactor {moduleName} to use {targetPattern}')
    expect(JSON.parse(row!.paramsJson as string)).toEqual(['moduleName', 'targetPattern'])
    expect(row!.version).toBe(1)
    expect(row!.isShared).toBe(1)
  })

  it('spawnFromTemplate substitutes bindings and executes', async () => {
    const id = await engine.saveTemplate(
      'Summarize PR',
      'Summarize PR #{prNumber}',
      ['prNumber'],
    )

    const task = await engine.spawnFromTemplate(id, { prNumber: '42' })

    expect(task).toBeDefined()
    expect(task.goal.description).toBe('Summarize PR #42')
    expect(task.status).not.toBe('failed')
  })

  it('missing binding substitutes empty string', async () => {
    const id = await engine.saveTemplate(
      'Test Template',
      'Process {item} in {context}',
      ['item', 'context'],
    )

    const task = await engine.spawnFromTemplate(id, { item: 'data' })

    expect(task).toBeDefined()
    expect(task.goal.description).toBe('Process data in ')
  })

  it('spawnFromTemplate with nonexistent template throws', async () => {
    let threw = false
    try {
      await engine.spawnFromTemplate('nonexistent', {})
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })

  it('private templates not visible to listTaskTemplates with isShared filter', async () => {
    await engine.saveTemplate('Private', 'Do {x}', ['x'], false)
    await engine.saveTemplate('Shared', 'Do {y}', ['y'], true)

    const shared = await store.listTaskTemplates({ isShared: true })
    expect(shared.length).toBe(1)
    expect(shared[0]!.name).toBe('Shared')
  })
})
