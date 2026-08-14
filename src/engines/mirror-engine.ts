// src/engines/mirror-engine.ts
// MirrorEngine — bidirectional UI⇄Chrome sync with optimistic updates

import type { CapabilityEventBus } from './capability-event-bus.js'
import type { CapabilityResolutionEngine } from './capability-resolution.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { ExecutionMemoizer } from './execution-memoizer.js'
import type {
  ObservationTap,
  ObservationOptions as ObservationTapOptions,
} from './observation-tap.js'

// ── Store contract ───────────────────────────────────────────────────────

export interface MirrorStateRow {
  conversationId: string
  chromeState: Record<string, unknown>
  uiState: Record<string, unknown>
  lastSyncAt: number
}

export interface MirrorStateInput {
  conversationId: string
  chromeState: Record<string, unknown>
  uiState: Record<string, unknown>
}

export interface OptimisticUpdateRow {
  id: string
  conversationId: string
  action: string
  expectedState: Record<string, unknown>
  confirmed: boolean
  actualState?: Record<string, unknown>
  createdAt: number
}

export interface OptimisticUpdateInput {
  conversationId: string
  action: string
  expectedState: Record<string, unknown>
}

export interface LatencyMeasurementInput {
  conversationId: string
  stage: string
  durationMs: number
}

export interface LatencyReport {
  conversationId: string
  stages: Record<string, { avg: number; p95: number; max: number }>
  totalMs: number
}

export interface SnapshotRow {
  id: string
  conversationId: string
  trigger: string
  state: Record<string, unknown>
  timestamp: number
}

export interface SnapshotInput {
  conversationId: string
  trigger: string
  state: Record<string, unknown>
}

export interface MirrorStore {
  getMirrorState(conversationId: string): Promise<MirrorStateRow | null>
  upsertMirrorState(state: MirrorStateInput): Promise<void>
  createOptimisticUpdate(input: OptimisticUpdateInput): Promise<OptimisticUpdateRow>
  resolveOptimisticUpdate(
    updateId: string,
    confirmed: boolean,
    actualValue?: unknown,
  ): Promise<void>
  recordLatency(input: LatencyMeasurementInput): Promise<void>
  getLatencyReport(
    conversationId: string,
    opts?: { from?: number; to?: number },
  ): Promise<LatencyReport>
  createSnapshot(input: SnapshotInput): Promise<SnapshotRow>
  getSnapshots(
    conversationId: string,
    opts?: { from?: number; to?: number; limit?: number },
  ): Promise<SnapshotRow[]>
}

// ── Action types ─────────────────────────────────────────────────────────

export interface MirrorAction {
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'custom'
  slaveId?: string
  target?: string
  value?: string
  conversationId: string
}

export interface ActionResult {
  success: boolean
  mirrorState?: Record<string, unknown>
  error?: string
}

export interface ObservationOptions {
  domMutations?: boolean
  networkEvents?: boolean
  consoleLogs?: boolean
  pageLifecycle?: boolean
  throttleMs?: number
}

export interface MirrorState {
  chrome: Record<string, unknown>
  ui: Record<string, unknown>
  lastSyncAt: number
  pendingUpdates: number
}

export interface BudgetResult {
  withinBudget: boolean
  actualMs: number
  budgetMs: number
  exceeded: boolean
}

// ── Latency budgets (ms) ────────────────────────────────────────────────

const _LATENCY_BUDGETS: Record<string, number> = {
  resolve: 5,
  lock: 0,
  ensure: 2000,
  send: 500,
  capture: 30000,
  parse: 200,
  store: 10,
  emit: 5,
}

// ── MirrorEngine ────────────────────────────────────────────────────────

export class MirrorEngine {
  private observationTap?: ObservationTap

  constructor(
    private governor: ChromeGovernor,
    _resolution: CapabilityResolutionEngine,
    private store: MirrorStore,
    _eventBus: CapabilityEventBus,
    _memoizer: ExecutionMemoizer,
    observationTap?: ObservationTap,
  ) {
    this.observationTap = observationTap
  }

  async sendAction(action: MirrorAction): Promise<ActionResult> {
    try {
      const slaveId = action.slaveId
      if (!slaveId) {
        return { success: false, error: 'slaveId required for CDP routing' }
      }

      switch (action.type) {
        case 'navigate':
          await this.governor.cdp.send(slaveId, 'Page.navigate', {
            url: action.value ?? action.target ?? '',
          })
          break
        case 'click':
          await this.governor.cdp.send(slaveId, 'Runtime.evaluate', {
            expression: `document.querySelector('${action.target ?? ''}')?.click()`,
          })
          break
        case 'type':
          await this.governor.cdp.send(slaveId, 'Runtime.evaluate', {
            expression: `document.querySelector('${action.target ?? ''}').value = '${action.value ?? ''}'`,
          })
          break
        case 'scroll':
          await this.governor.cdp.send(slaveId, 'Input.dispatchMouseEvent', {
            type: 'mouseWheel',
            x: 0,
            y: 0,
            deltaX: 0,
            deltaY: Number(action.value ?? '-100'),
          })
          break
        case 'custom':
          await this.governor.cdp.send(slaveId, 'Runtime.evaluate', {
            expression: action.value ?? '',
          })
          break
      }

      const result = { action: action.type, target: action.target, slaveId }

      const state = await this.store.getMirrorState(action.conversationId)
      if (state) {
        await this.store.upsertMirrorState({
          conversationId: action.conversationId,
          chromeState: { ...state.chromeState, lastAction: action },
          uiState: state.uiState,
        })
      }

      return { success: true, mirrorState: result }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  async startObservation(slaveId: string, opts?: ObservationOptions): Promise<void> {
    if (!this.observationTap) return
    const tapOpts: ObservationTapOptions = {
      domMutations: opts?.domMutations,
      networkEvents: opts?.networkEvents,
      consoleLogs: opts?.consoleLogs,
      pageLifecycle: opts?.pageLifecycle,
      throttleMs: opts?.throttleMs,
    }
    await this.observationTap.start(slaveId, tapOpts)
  }

  async stopObservation(slaveId: string): Promise<void> {
    if (!this.observationTap) return
    await this.observationTap.stop(slaveId)
  }

  async projectState(conversationId: string): Promise<MirrorState> {
    const state = await this.store.getMirrorState(conversationId)
    return {
      chrome: state?.chromeState ?? {},
      ui: state?.uiState ?? {},
      lastSyncAt: state?.lastSyncAt ?? Date.now(),
      pendingUpdates: 0,
    }
  }

  async getMirrorState(conversationId: string): Promise<MirrorState | null> {
    const state = await this.store.getMirrorState(conversationId)
    if (!state) return null
    return {
      chrome: state.chromeState,
      ui: state.uiState,
      lastSyncAt: state.lastSyncAt,
      pendingUpdates: 0,
    }
  }

  async applyOptimisticUpdate(
    conversationId: string,
    action: string,
    expectedState: Record<string, unknown>,
  ): Promise<string> {
    const update = await this.store.createOptimisticUpdate({
      conversationId,
      action,
      expectedState,
    })
    return update.id
  }

  async resolveOptimisticUpdate(
    updateId: string,
    confirmed: boolean,
    actualState?: Record<string, unknown>,
  ): Promise<void> {
    await this.store.resolveOptimisticUpdate(updateId, confirmed, actualState)
  }

  async revertOptimisticUpdate(updateId: string, reason: string): Promise<void> {
    await this.store.resolveOptimisticUpdate(updateId, false, { reason })
  }

  async recordStageLatency(
    conversationId: string,
    stage: string,
    durationMs: number,
  ): Promise<void> {
    await this.store.recordLatency({ conversationId, stage, durationMs })
  }

  async getLatencyReport(conversationId: string): Promise<LatencyReport> {
    return this.store.getLatencyReport(conversationId)
  }

  enforceBudget(_stage: string, durationMs: number, budgetMs: number): BudgetResult {
    return {
      withinBudget: durationMs <= budgetMs,
      actualMs: durationMs,
      budgetMs,
      exceeded: durationMs > budgetMs,
    }
  }

  async snapshot(conversationId: string, trigger: string): Promise<SnapshotRow> {
    const state = await this.store.getMirrorState(conversationId)
    return this.store.createSnapshot({
      conversationId,
      trigger,
      state: state?.chromeState ?? {},
    })
  }

  async scrubTo(conversationId: string, timestamp: number): Promise<SnapshotRow | null> {
    const snapshots = await this.store.getSnapshots(conversationId, {
      from: 0,
      to: timestamp,
      limit: 1,
    })
    return snapshots[0] ?? null
  }

  async startRecording(conversationId: string): Promise<string> {
    const snapshot = await this.store.createSnapshot({
      conversationId,
      trigger: 'recording_start',
      state: {},
    })
    return snapshot.id
  }
}
