// src/engines/capability.ts
// CapabilityEngine — execute capabilities via Governor CDP (04-merged-engines.md §4).

import { EngineError } from '../errors.js'
import { deriveSlaveId, newId } from '../ids.js'
import type {
  CapabilityBindingRow,
  CapabilityStore,
  SelectorStrategyRow,
} from '../storage/contracts/capability-store.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { CapabilityEventBus } from './conversation-manager.js'

export interface CapabilityExecutionResult {
  ok: boolean
  capabilityId: string
  output?: Record<string, unknown>
  traceId: string
  latencyMs: number
  error?: string
  recoveryAttempted?: boolean
  recoveryStrategies?: RecoveryStrategyResult[]
}

export interface LoginDetectionResult {
  isLoggedIn: boolean
  confidence: number
  pageUrl?: string
  indicators: LoginIndicator[]
}

export interface LoginIndicator {
  type: 'selector_found' | 'url_match' | 'cookie_exists' | 'text_match'
  value: string
  matched: boolean
}

export interface RecoveryStrategyResult {
  strategy: string
  index: number
  ok: boolean
  error?: string
}

export type RecoveryStrategy = {
  type:
    | 'retry_selector'
    | 'retry_with_fallback'
    | 'navigate_home'
    | 'restart_chrome'
    | 'mark_broken'
  config?: Record<string, unknown>
}

const DEFAULT_RECOVERY: RecoveryStrategy[] = [
  { type: 'retry_selector' },
  { type: 'retry_with_fallback' },
  { type: 'navigate_home' },
  { type: 'restart_chrome' },
  { type: 'mark_broken' },
]

export class CapabilityEngine {
  constructor(
    private governor: ChromeGovernor,
    private store: CapabilityStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async execute(
    capabilitySlug: string,
    providerId: string,
    accountId: string,
    input?: Record<string, unknown>,
  ): Promise<CapabilityExecutionResult> {
    const start = Date.now()
    const slaveId = deriveSlaveId(providerId, accountId)
    const traceId = newId()

    const cap = await this.store.getCapabilityBySlug(capabilitySlug)
    if (!cap) return this.fail(capabilitySlug, traceId, start, 'capability not found')

    const binding = await this.store.getBinding(cap.id, providerId)
    if (!binding) return this.fail(cap.id, traceId, start, 'binding not found')

    const selectors = await this.store.getSelectors(cap.id, providerId)
    const _programs = await this.store.getPrograms(binding.id)
    const primary = selectors[0]
    if (!primary) return this.fail(cap.id, traceId, start, 'no selectors for capability')

    const strategies =
      (input?.recoveryStrategies as RecoveryStrategy[] | undefined) ?? DEFAULT_RECOVERY

    let output: Record<string, unknown> | undefined
    try {
      output = await this.runSelector(primary, slaveId, input)
    } catch {
      output = undefined
    }

    const recoveryResults: RecoveryStrategyResult[] = []
    let recoveryAttempted = false
    let attempt = 0
    while (!output && attempt < strategies.length) {
      const strat = strategies[attempt]
      if (!strat) break
      recoveryAttempted = true
      try {
        await this.applyStrategy(strat, slaveId, binding, primary, input)
        output = await this.runSelector(primary, slaveId, input)
      } catch (_err) {
        output = undefined
      }
      recoveryResults.push({
        strategy: strat.type,
        index: attempt,
        ok: !!output,
        error: output ? undefined : 'selector still missed after recovery',
      })
      attempt++
    }

    const ok = !!output
    const latencyMs = Date.now() - start

    await this.store.createOutcome({
      capabilityId: cap.id,
      bindingId: binding.id,
      providerId,
      accountId,
      ok,
      latencyMs,
      error: ok ? null : 'all recovery strategies exhausted',
      outputJson: JSON.stringify(output ?? {}),
      traceId,
    })
    await this.store.updateSelectorHealth(primary.id, ok)

    if (ok) {
      await this.store.updateBindingHealth(binding.id, {
        status: 'healthy',
        lastSuccessAt: Date.now(),
      })
      this.eventBus?.emit({
        type: 'capability:executed',
        capabilityId: cap.id,
        providerId,
        bindingId: binding.id,
        traceId,
        ok: true,
        latencyMs,
      })
    } else {
      await this.store.updateBindingHealth(binding.id, {
        status: 'broken',
        lastFailureAt: Date.now(),
      })
      this.eventBus?.emit({
        type: 'capability:failed',
        capabilityId: cap.id,
        providerId,
        bindingId: binding.id,
        traceId,
        error: 'all recovery strategies exhausted',
        recoveryBehavior: 'none',
      })
    }

    return {
      ok,
      capabilityId: cap.id,
      output,
      traceId,
      latencyMs,
      recoveryAttempted,
      recoveryStrategies: recoveryResults,
    }
  }

  async detectLogin(providerId: string, accountId: string): Promise<LoginDetectionResult> {
    const slaveId = deriveSlaveId(providerId, accountId)
    const page = await this.governor.cdp.getPageState(slaveId)
    const indicators: LoginIndicator[] = []

    try {
      const loginEl = await this.governor.cdp.send(slaveId, 'DOM.querySelector', {
        selector: '[data-testid="login"], .login-form, .auth-gate',
      })
      indicators.push({ type: 'selector_found', value: 'login-form', matched: !!loginEl })
    } catch {
      indicators.push({ type: 'selector_found', value: 'login-form', matched: false })
    }

    const urlMatch = /(chat|app|dashboard|conversations)/.test(page?.url ?? '')
    indicators.push({ type: 'url_match', value: page?.url ?? '', matched: urlMatch })

    const loginFormFound = indicators.some((i) => i.type === 'selector_found' && i.matched)
    const isLoggedIn = urlMatch && !loginFormFound
    const confidence = isLoggedIn ? 0.9 : 0.2

    return { isLoggedIn, confidence, pageUrl: page?.url ?? '', indicators }
  }

  async sendMessage(
    providerId: string,
    accountId: string,
    message: string,
  ): Promise<CapabilityExecutionResult> {
    return this.execute('send_message', providerId, accountId, { message })
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async runSelector(
    selector: SelectorStrategyRow,
    slaveId: string,
    input?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const found = await this.governor.cdp.send(slaveId, 'DOM.querySelector', {
      selector: selector.selectorValue,
    })
    if (found == null) throw new EngineError(`selector missed: ${selector.selectorValue}`)
    return { selector: selector.selectorValue, found: true, input: input ?? {} }
  }

  private async applyStrategy(
    strat: RecoveryStrategy,
    slaveId: string,
    binding: CapabilityBindingRow,
    _primary: SelectorStrategyRow,
    _input?: Record<string, unknown>,
  ): Promise<void> {
    switch (strat.type) {
      case 'retry_selector':
      case 'retry_with_fallback':
        await this.governor.cdp.send(slaveId, 'DOM.getDocument', {})
        break
      case 'navigate_home':
        await this.governor.cdp.send(slaveId, 'Page.navigate', {
          url: 'https://chat.example.com',
        })
        break
      case 'restart_chrome':
        await this.governor.ensureRunning(slaveId)
        break
      case 'mark_broken':
        await this.store.updateBindingHealth(binding.id, { status: 'broken' })
        break
    }
  }

  private fail(
    capabilityId: string,
    traceId: string,
    start: number,
    error: string,
  ): CapabilityExecutionResult {
    return {
      ok: false,
      capabilityId,
      traceId,
      latencyMs: Date.now() - start,
      error,
    }
  }
}
