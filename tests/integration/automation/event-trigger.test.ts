// tests/integration/automation/event-trigger.test.ts
// Integration: AutomationScheduler + CapabilityEventBus + event triggers

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type {
  AutomationRunRow,
  AutomationScheduleRow,
  AutomationStore,
} from '../../../src/automation/scheduler.js'
import { AutomationScheduler } from '../../../src/automation/scheduler.js'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'

function makeAutomationStore() {
  const schedules = new Map<string, AutomationScheduleRow>()
  const runs: AutomationRunRow[] = []

  return {
    _schedules: schedules,
    _runs: runs,
    listSchedules: mock((opts?: { activeOnly?: boolean }) => {
      const all = [...schedules.values()]
      if (opts?.activeOnly) return Promise.resolve(all.filter((s) => s.isActive))
      return Promise.resolve(all)
    }),
    getSchedule: mock((id: string) => Promise.resolve(schedules.get(id) ?? null)),
    createSchedule: mock((input: AutomationScheduleRow) => {
      schedules.set(input.id, input)
      return Promise.resolve(input)
    }),
    updateSchedule: mock((id: string, patch: Partial<AutomationScheduleRow>) => {
      const s = schedules.get(id)
      if (s) Object.assign(s, patch)
      return Promise.resolve()
    }),
    deleteSchedule: mock((id: string) => {
      schedules.delete(id)
      return Promise.resolve()
    }),
    createRun: mock((input: AutomationRunRow) => {
      runs.push(input)
      return Promise.resolve(input)
    }),
    updateRun: mock((id: string, patch: Partial<AutomationRunRow>) => {
      const run = runs.find((r) => r.id === id)
      if (run) Object.assign(run, patch)
      return Promise.resolve()
    }),
    listRuns: mock(() => Promise.resolve(runs)),
  } as unknown as AutomationStore & {
    _schedules: Map<string, AutomationScheduleRow>
    _runs: AutomationRunRow[]
  }
}

describe('AutomationScheduler event triggers', () => {
  let scheduler: AutomationScheduler
  let store: ReturnType<typeof makeAutomationStore>
  let eventBus: CapabilityEventBus
  let runnerExecuted: string[]

  beforeEach(async () => {
    eventBus = new CapabilityEventBus()
    store = makeAutomationStore()
    runnerExecuted = []

    scheduler = new AutomationScheduler(
      store,
      {
        run: mock(async (action: string, config: unknown) => {
          runnerExecuted.push(action)
          return { executed: true, action, config }
        }),
      },
      eventBus,
    )

    // Start the scheduler (non-blocking background tick)
    scheduler.start()
  })

  test('event schedule fires when matching event is emitted (exact match)', async () => {
    // Use define() which creates the schedule AND subscribes synchronously
    await scheduler.define({
      name: 'On Conversation Created',
      scheduleType: 'event',
      scheduleValue: 'conversation:created',
      action: 'cap:conversation:summarize',
      actionConfigJson: '{}',
      isActive: true,
    })

    // Emit matching event
    eventBus.emit({
      type: 'conversation:created',
      conversationId: 'c1',
      providerId: 'p1',
      accountId: 'a1',
    })

    // Wait for async execution
    await new Promise((r) => setTimeout(r, 50))

    scheduler.stop()
    expect(runnerExecuted.length).toBeGreaterThanOrEqual(1)
    expect(runnerExecuted).toContain('cap:conversation:summarize')
  })

  test('event schedule does NOT fire for non-matching event', async () => {
    await scheduler.define({
      name: 'On Conversation Created',
      scheduleType: 'event',
      scheduleValue: 'conversation:created',
      action: 'cap:test',
      actionConfigJson: '{}',
      isActive: true,
    })

    eventBus.emit({
      type: 'canvas:layer:spawned',
      instanceId: 'i1',
      definitionId: 'd1',
      slug: 's',
      category: 'c',
      layout: { x: 0, y: 0, w: 100, h: 100 },
    })

    await new Promise((r) => setTimeout(r, 20))
    scheduler.stop()
    expect(runnerExecuted).toHaveLength(0)
  })

  test('wildcard event pattern matches prefixed events (conversation:*)', async () => {
    await scheduler.define({
      name: 'All Conversation Events',
      scheduleType: 'event',
      scheduleValue: 'conversation:*',
      action: 'cap:log',
      actionConfigJson: '{}',
      isActive: true,
    })

    eventBus.emit({
      type: 'conversation:created',
      conversationId: 'c1',
      providerId: 'p1',
      accountId: 'a1',
    })
    eventBus.emit({ type: 'conversation:complete', conversationId: 'c1', message: {} })
    eventBus.emit({ type: 'conversation:error', conversationId: 'c1', error: 'err' })

    await new Promise((r) => setTimeout(r, 50))
    scheduler.stop()
    expect(runnerExecuted.length).toBeGreaterThanOrEqual(1)
  })

  test('inactive schedule does not fire', async () => {
    await scheduler.define({
      name: 'Disabled schedule',
      scheduleType: 'event',
      scheduleValue: 'conversation:created',
      action: 'cap:test',
      actionConfigJson: '{}',
      isActive: false,
    })

    eventBus.emit({
      type: 'conversation:created',
      conversationId: 'c1',
      providerId: 'p1',
      accountId: 'a1',
    })

    await new Promise((r) => setTimeout(r, 20))
    scheduler.stop()
    expect(runnerExecuted).toHaveLength(0)
  })

  test('multiple schedules fire independently', async () => {
    await scheduler.define({
      name: 'A',
      scheduleType: 'event',
      scheduleValue: 'conversation:created',
      action: 'cap:a',
      actionConfigJson: '{}',
      isActive: true,
    })
    await scheduler.define({
      name: 'B',
      scheduleType: 'event',
      scheduleValue: 'conversation:complete',
      action: 'cap:b',
      actionConfigJson: '{}',
      isActive: true,
    })

    eventBus.emit({
      type: 'conversation:created',
      conversationId: 'c1',
      providerId: 'p1',
      accountId: 'a1',
    })
    eventBus.emit({ type: 'conversation:complete', conversationId: 'c1', message: {} })

    await new Promise((r) => setTimeout(r, 50))
    scheduler.stop()
    expect(runnerExecuted).toContain('cap:a')
    expect(runnerExecuted).toContain('cap:b')
  })
})
