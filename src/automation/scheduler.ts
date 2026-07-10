// src/automation/scheduler.ts
// AutomationScheduler — time/event-driven automation runner for v1.
// Ported survivor component (L11 Operations).

import type { CapabilityEventBus } from '../engines/capability-event-bus.js'
import { newId } from '../ids.js'

// ── Types ──────────────────────────────────────────────────────────────────

export type ScheduleType = 'cron' | 'interval' | 'event'
export type RunStatus = 'running' | 'completed' | 'failed'

export interface AutomationScheduleRow {
  id: string
  name: string
  scheduleType: ScheduleType
  scheduleValue: string
  action: string
  actionConfigJson: string
  isActive: boolean
  lastRunAt: number | null
  nextRunAt: number | null
  createdAt: number
  updatedAt: number
}

export interface AutomationRunRow {
  id: string
  scheduleId: string
  status: RunStatus
  resultJson: string | null
  error: string | null
  startedAt: number
  completedAt: number | null
}

export interface AutomationRunner {
  run(action: string, config: unknown): Promise<unknown>
}

export interface AutomationStore {
  listSchedules(opts?: { activeOnly?: boolean }): Promise<AutomationScheduleRow[]>
  getSchedule(id: string): Promise<AutomationScheduleRow | null>
  createSchedule(input: AutomationScheduleRow): Promise<AutomationScheduleRow>
  updateSchedule(id: string, patch: Partial<AutomationScheduleRow>): Promise<void>
  deleteSchedule(id: string): Promise<void>
  createRun(input: AutomationRunRow): Promise<AutomationRunRow>
  updateRun(id: string, patch: Partial<AutomationRunRow>): Promise<void>
  listRuns(scheduleId: string, opts?: { limit?: number }): Promise<AutomationRunRow[]>
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseIntervalMs(value: string): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseCronNextMs(_cronExpr: string, _now: number): number | null {
  // v1 stub: real cron parsing would use a library.
  // For now, treat unparseable cron as "run every 60s".
  return 60_000
}

// ── AutomationScheduler ─────────────────────────────────────────────────────

export class AutomationScheduler {
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private unsubscribers: (() => void)[] = []

  constructor(
    private store: AutomationStore,
    private runner: AutomationRunner,
    private eventBus: CapabilityEventBus,
  ) {}

  start(): void {
    // Tick every 1 second
    this.tickTimer = setInterval(() => {
      this.tick().catch(() => {
        // Best-effort tick; errors logged by runner
      })
    }, 1000)

    // Subscribe to event-triggered schedules
    this.store
      .listSchedules({ activeOnly: true })
      .then((schedules) => {
        for (const sched of schedules) {
          if (sched.scheduleType === 'event') {
            this.subscribeEvent(sched)
          }
        }
      })
      .catch(() => {
        // Ignore startup errors
      })
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
  }

  async tick(now?: number): Promise<AutomationRunRow[]> {
    const ts = now ?? Date.now()
    const schedules = await this.store.listSchedules({ activeOnly: true })
    const fired: AutomationRunRow[] = []

    for (const sched of schedules) {
      if (!sched.isActive) continue
      if (sched.nextRunAt !== null && sched.nextRunAt > ts) continue

      const run = await this.executeSchedule(sched, ts)
      fired.push(run)
    }

    return fired
  }

  async runNow(scheduleId: string): Promise<AutomationRunRow> {
    const sched = await this.store.getSchedule(scheduleId)
    if (!sched) throw new Error(`Schedule not found: ${scheduleId}`)
    return this.executeSchedule(sched, Date.now())
  }

  async define(
    input: Omit<
      AutomationScheduleRow,
      'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt'
    >,
  ): Promise<AutomationScheduleRow> {
    const now = Date.now()
    const nextRunAt = this.computeNextRun(input.scheduleType, input.scheduleValue, now)
    const row: AutomationScheduleRow = {
      ...input,
      id: newId(),
      lastRunAt: null,
      nextRunAt,
      createdAt: now,
      updatedAt: now,
    }
    const created = await this.store.createSchedule(row)

    // If event-type, subscribe to bus
    if (input.scheduleType === 'event') {
      this.subscribeEvent(created)
    }

    return created
  }

  async list(): Promise<AutomationScheduleRow[]> {
    return this.store.listSchedules()
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private async executeSchedule(
    sched: AutomationScheduleRow,
    ts: number,
  ): Promise<AutomationRunRow> {
    const run: AutomationRunRow = {
      id: newId(),
      scheduleId: sched.id,
      status: 'running',
      resultJson: null,
      error: null,
      startedAt: ts,
      completedAt: null,
    }

    await this.store.createRun(run)

    try {
      const config = JSON.parse(sched.actionConfigJson || '{}')
      const result = await this.runner.run(sched.action, config)
      const completedAt = Date.now()
      await this.store.updateRun(run.id, {
        status: 'completed',
        resultJson: JSON.stringify(result),
        completedAt,
      })
      await this.store.updateSchedule(sched.id, {
        lastRunAt: ts,
        nextRunAt: this.computeNextRun(sched.scheduleType, sched.scheduleValue, completedAt),
        updatedAt: completedAt,
      })
      return { ...run, status: 'completed', resultJson: JSON.stringify(result), completedAt }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      const completedAt = Date.now()
      await this.store.updateRun(run.id, {
        status: 'failed',
        error: message,
        completedAt,
      })
      await this.store.updateSchedule(sched.id, {
        lastRunAt: ts,
        nextRunAt: this.computeNextRun(sched.scheduleType, sched.scheduleValue, completedAt),
        updatedAt: completedAt,
      })
      return { ...run, status: 'failed', error: message, completedAt }
    }
  }

  private computeNextRun(type: ScheduleType, value: string, fromMs: number): number | null {
    switch (type) {
      case 'interval': {
        const ms = parseIntervalMs(value)
        return ms !== null ? fromMs + ms : null
      }
      case 'cron': {
        return parseCronNextMs(value, fromMs)
      }
      case 'event':
        // Event-triggered schedules don't have a nextRunAt
        return null
      default:
        return null
    }
  }

  private subscribeEvent(sched: AutomationScheduleRow): void {
    const unsub = this.eventBus.on(sched.scheduleValue, (() => {
      this.executeSchedule(sched, Date.now()).catch(() => {
        // Best-effort
      })
    }) as Parameters<typeof this.eventBus.on>[1])
    this.unsubscribers.push(unsub)
  }
}
