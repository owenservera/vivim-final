// src/engines/kernel/oracle-event-stream.ts
// OracleEventStream — real-time system state over WebSocket. Broadcasts oracle
// events (health changes, issue detection, healing actions) to all subscribers.

import type { CapabilityEventBus } from '../capability-event-bus.js'
import type { KernelRegistry } from './kernel-registry.js'
import type { HealAction, OracleActuator } from './oracle-actuator.js'
import type { DiagnosticIssue, OracleDiagnosticEngine } from './oracle-diagnostic.js'

export type OracleEventKind =
  | 'health-changed'
  | 'issue-detected'
  | 'issue-resolved'
  | 'heal-started'
  | 'heal-completed'
  | 'heal-failed'
  | 'topology-changed'

export interface OracleEvent {
  kind: OracleEventKind
  engineId?: string
  data: unknown
  timestamp: number
}

export class OracleEventStream {
  private subscribers = new Set<(event: OracleEvent) => void>()
  private recent: OracleEvent[] = []
  private recentCapacity: number
  private scanTimer: ReturnType<typeof setInterval> | null = null
  private knownIssues = new Map<string, DiagnosticIssue>()

  constructor(
    private readonly diagnostic: OracleDiagnosticEngine,
    private readonly actuator: OracleActuator,
    private readonly registry: KernelRegistry,
    private readonly eventBus?: CapabilityEventBus,
    opts?: { recentCapacity?: number },
  ) {
    this.recentCapacity = opts?.recentCapacity ?? 200
    this.wireActuator()
    this.wireRegistry()
  }

  subscribe(callback: (event: OracleEvent) => void): () => void {
    this.subscribers.add(callback)
    return () => {
      this.subscribers.delete(callback)
    }
  }

  getRecentEvents(limit = 10): OracleEvent[] {
    return this.recent.slice(-limit)
  }

  startPeriodicScan(intervalMs = 60_000): void {
    this.stopPeriodicScan()
    this.scanTimer = setInterval(() => {
      void this.runScan()
    }, intervalMs)
  }

  stopPeriodicScan(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer)
      this.scanTimer = null
    }
  }

  emit(event: Omit<OracleEvent, 'timestamp'>): void {
    const full: OracleEvent = { ...event, timestamp: Date.now() }
    this.recent.push(full)
    if (this.recent.length > this.recentCapacity) {
      this.recent = this.recent.slice(-Math.floor(this.recentCapacity / 2))
    }
    for (const cb of this.subscribers) {
      try {
        cb(full)
      } catch {
        /* ignore subscriber errors */
      }
    }
    if (this.eventBus) {
      try {
        this.eventBus.emit({ type: 'kernel:oracle', ...full })
      } catch {
        /* ignore */
      }
    }
  }

  private async runScan(): Promise<void> {
    const issues = await this.diagnostic.scan()
    for (const issue of issues) {
      if (!this.knownIssues.has(issue.id)) {
        this.knownIssues.set(issue.id, issue)
        this.emit({ kind: 'issue-detected', engineId: issue.engineId, data: issue })
      }
    }
    for (const [id, issue] of this.knownIssues) {
      if (!issues.find((i) => i.id === id)) {
        this.emit({ kind: 'issue-resolved', engineId: issue.engineId, data: { issueId: id } })
        this.knownIssues.delete(id)
      }
    }
  }

  private wireActuator(): void {
    this.actuator.onHeal((action: HealAction) => {
      if (action.status === 'executing') {
        this.emit({
          kind: 'heal-started',
          engineId: action.engineId,
          data: { actionId: action.id, kind: action.kind },
        })
      } else if (action.status === 'completed') {
        this.emit({
          kind: 'heal-completed',
          engineId: action.engineId,
          data: { actionId: action.id, result: action.result ?? 'success' },
        })
      } else if (action.status === 'failed') {
        this.emit({
          kind: 'heal-failed',
          engineId: action.engineId,
          data: { actionId: action.id, error: action.result },
        })
      }
    })
  }

  private wireRegistry(): void {
    this.registry.onStatusChange((id, from, to) => {
      this.emit({
        kind: 'health-changed',
        engineId: id,
        data: { from, to },
      })
      if (from !== to) {
        this.emit({ kind: 'topology-changed', data: { changed: [id], from, to } })
      }
    })
  }
}
