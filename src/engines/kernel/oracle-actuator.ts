// src/engines/kernel/oracle-actuator.ts
// OracleActuator — the oracle's "hands". Translates diagnostic issues into
// corrective (self-healing) actions. Auto-heal respects AutoHealPolicy.

import { NotFoundError } from '../../errors.js'
import type { KernelStore } from '../../storage/contracts/kernel-store.js'
import type { KernelRegistry } from './kernel-registry.js'
import type { DiagnosticIssue, OracleDiagnosticEngine } from './oracle-diagnostic.js'

export type HealKind =
  | 'restart-engine'
  | 'reconfigure'
  | 'clear-cache'
  | 'reset-circuit'
  | 'reconnect'
  | 'notify'

export interface HealAction {
  id: string
  issueId: string
  kind: HealKind
  engineId: string
  description: string
  parameters: Record<string, unknown>
  status: 'pending' | 'executing' | 'completed' | 'failed'
  result?: string
  executedAt?: number
}

export interface AutoHealPolicy {
  stalledEngineRestart: { enabled: boolean; timeoutMs: number }
  circuitBreakerReset: { enabled: boolean; cooldownMs: number }
  configFallback: { enabled: boolean; defaults: Record<string, unknown> }
  notify: { enabled: boolean; channels: string[] }
}

const CATEGORY_TO_ACTION: Record<
  DiagnosticIssue['category'],
  { kind: HealKind; autoFixable: boolean }
> = {
  stalled: { kind: 'restart-engine', autoFixable: true },
  'broken-wire': { kind: 'reconnect', autoFixable: false },
  'missing-dep': { kind: 'notify', autoFixable: false },
  'health-degraded': { kind: 'reset-circuit', autoFixable: true },
  'config-missing': { kind: 'reconfigure', autoFixable: true },
  'schema-mismatch': { kind: 'notify', autoFixable: false },
  stub: { kind: 'notify', autoFixable: false },
}

const DEFAULT_POLICY: AutoHealPolicy = {
  stalledEngineRestart: { enabled: true, timeoutMs: 30_000 },
  circuitBreakerReset: { enabled: true, cooldownMs: 5_000 },
  configFallback: { enabled: true, defaults: {} },
  notify: { enabled: true, channels: ['log'] },
}

export class OracleActuator {
  private actions: HealAction[] = []
  private policy: AutoHealPolicy = structuredClone(DEFAULT_POLICY)
  private healCallbacks = new Set<(action: HealAction) => void>()

  constructor(
    private readonly registry: KernelRegistry,
    private readonly diagnostic: OracleDiagnosticEngine,
    private readonly store: KernelStore | null = null,
  ) {}

  onHeal(callback: (action: HealAction) => void): () => void {
    this.healCallbacks.add(callback)
    return () => {
      this.healCallbacks.delete(callback)
    }
  }

  async heal(issueId: string): Promise<HealAction> {
    const issue = await this.findIssue(issueId)
    if (!issue) throw new NotFoundError(`Diagnostic issue ${issueId} not found`)
    const mapping = CATEGORY_TO_ACTION[issue.category]
    const action: HealAction = {
      id: `heal_${issue.id}_${this.actions.length}`,
      issueId: issue.id,
      kind: mapping.kind,
      engineId: issue.engineId,
      description: `Heal ${issue.category} on ${issue.engineId} via ${mapping.kind}`,
      parameters: {},
      status: 'pending',
    }
    this.actions.push(action)
    await this.execute(action, issue, mapping.autoFixable)
    return action
  }

  async getActions(limit = 50): Promise<HealAction[]> {
    return this.actions.slice(-limit)
  }

  async getAction(id: string): Promise<HealAction | null> {
    return this.actions.find((a) => a.id === id) ?? null
  }

  async undo(actionId: string): Promise<void> {
    const action = this.actions.find((a) => a.id === actionId)
    if (!action) throw new NotFoundError(`Heal action ${actionId} not found`)
    // Only restart-engine and reset-circuit have meaningful undo (re-mark running).
    if (action.kind === 'restart-engine' || action.kind === 'reset-circuit') {
      this.registry.markRunning(action.engineId)
    }
    action.status = 'pending'
    action.result = 'undone'
  }

  async getAutoHealPolicy(): Promise<AutoHealPolicy> {
    return structuredClone(this.policy)
  }

  async setAutoHealPolicy(policy: AutoHealPolicy): Promise<void> {
    this.policy = structuredClone(policy)
    if (this.store) {
      try {
        await this.store.insertEvent('kernel:autoheal-policy', 'kernel', this.policy)
      } catch {
        /* non-fatal */
      }
    }
  }

  // Auto-heal a freshly produced issue list: execute only what policy allows.
  async autoHeal(issues: DiagnosticIssue[]): Promise<HealAction[]> {
    const executed: HealAction[] = []
    for (const issue of issues) {
      const mapping = CATEGORY_TO_ACTION[issue.category]
      if (!mapping.autoFixable) continue
      if (!this.policyAllows(mapping.kind)) continue
      const action = await this.heal(issue.id)
      executed.push(action)
    }
    return executed
  }

  private async execute(
    action: HealAction,
    issue: DiagnosticIssue,
    autoFixable: boolean,
  ): Promise<void> {
    if (!autoFixable) {
      action.status = 'completed'
      action.result = 'manual intervention required — notification only'
      action.executedAt = Date.now()
      this.emitHeal(action)
      return
    }
    if (!this.policyAllows(action.kind)) {
      action.status = 'completed'
      action.result = 'skipped — disabled by AutoHealPolicy'
      action.executedAt = Date.now()
      this.emitHeal(action)
      return
    }
    action.status = 'executing'
    action.executedAt = Date.now()
    this.emitHeal(action)
    try {
      await this.apply(action, issue)
      action.status = 'completed'
      action.result = 'success'
    } catch (err) {
      action.status = 'failed'
      action.result = String(err)
    }
    this.emitHeal(action)
  }

  private async apply(action: HealAction, issue: DiagnosticIssue): Promise<void> {
    switch (action.kind) {
      case 'restart-engine':
        this.registry.markStopped(action.engineId)
        this.registry.markRunning(action.engineId)
        break
      case 'reset-circuit':
        // Circuit breaker state lives on the engine; mark running clears error.
        this.registry.markRunning(action.engineId)
        break
      case 'reconfigure': {
        const desc = this.registry.getEngine(action.engineId)
        if (desc) {
          const merged = { ...desc.config, ...this.policy.configFallback.defaults }
          desc.config = merged
        }
        break
      }
      case 'reconnect':
        this.registry.markWired(action.engineId)
        break
      case 'clear-cache':
        // No global cache handle; record intent.
        break
      case 'notify':
        break
      default:
        break
    }
    void issue
  }

  private policyAllows(kind: HealKind): boolean {
    switch (kind) {
      case 'restart-engine':
        return this.policy.stalledEngineRestart.enabled
      case 'reset-circuit':
        return this.policy.circuitBreakerReset.enabled
      case 'reconfigure':
        return this.policy.configFallback.enabled
      case 'notify':
        return this.policy.notify.enabled
      default:
        return false
    }
  }

  private async findIssue(issueId: string): Promise<DiagnosticIssue | null> {
    return this.diagnostic.getIssue(issueId)
  }

  private emitHeal(action: HealAction): void {
    for (const cb of this.healCallbacks) {
      try {
        cb(action)
      } catch {
        /* ignore subscriber errors */
      }
    }
  }
}
