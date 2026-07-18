// src/engines/send-resilience.ts
// SendResilienceEngine — wraps the chat send pipeline with a pre-flight gate,
// a single silent auto-reconnect, and a structured SendResilienceError that the
// UI renders as a capability slot (FR-001..FR-006, spec 007-conversation-resilience).
//
// Governor Canon: the only legal CDP surface is ChromeGovernor. This engine never
// imports BunCdpClient; reconnect uses governor.launch / governor.getAllHealth.

import { EngineError, type RecoveryKind, SendResilienceError } from '../errors.js'
import type { ChromeGovernor, SlaveStatus } from './chrome-governor.js'
import type { ChromeSetupWizard } from './chrome-setup-wizard.js'
import type { ProviderHealthKernel } from './provider-health.js'

export interface SendPreflightResult {
  ok: boolean
  recoveryKind?: RecoveryKind
  slaveId?: string
  retryAfterMs?: number
  sessionHealth?: number | null
}

export interface SendInput {
  providerId: string
  slaveId: string
  text: string
  conversationId: string
  lastMessage?: string
}

export interface SendOutput {
  ok: boolean
  messageId?: string
}

export interface SendResilienceDeps {
  governor: ChromeGovernor
  health: ProviderHealthKernel
  wizard?: ChromeSetupWizard
  send: (input: SendInput) => Promise<SendOutput>
  reconnectBudgetMs?: number
}

const CIRCUIT_OPEN_PATTERN = /circuit breaker open/i
const DEFAULT_RECONNECT_BUDGET_MS = 5000

const DEFAULT_MESSAGES: Record<RecoveryKind, string> = {
  chrome_crash:
    'Chrome disconnected — your message was not sent. Click Retry to reconnect and resend.',
  cdp_down: 'Connection to Chrome dropped — click Retry to reconnect and resend.',
  session_expired: 'Your provider session expired — click to re-login.',
  circuit_open: 'Provider temporarily unavailable — waiting for recovery.',
  unknown: 'Message could not be sent. Try again.',
  relogin: 'Reconnecting to your provider for re-login…',
}

function classifyEngineError(err: unknown): RecoveryKind {
  if (err instanceof EngineError) {
    if (CIRCUIT_OPEN_PATTERN.test(err.message)) return 'circuit_open'
    if (/cdp transport not configured|cdp/i.test(err.message)) return 'cdp_down'
  }
  if (err instanceof Error) {
    if (CIRCUIT_OPEN_PATTERN.test(err.message)) return 'circuit_open'
    if (/cdp|transport|socket/i.test(err.message)) return 'cdp_down'
  }
  return 'unknown'
}

export class SendResilienceEngine {
  private readonly governor: ChromeGovernor
  private readonly health: ProviderHealthKernel
  private readonly wizard: ChromeSetupWizard | undefined
  private readonly sendFn: (input: SendInput) => Promise<SendOutput>
  private readonly reconnectBudgetMs: number

  constructor(deps: SendResilienceDeps) {
    this.governor = deps.governor
    this.health = deps.health
    this.wizard = deps.wizard
    this.sendFn = deps.send
    this.reconnectBudgetMs = deps.reconnectBudgetMs ?? DEFAULT_RECONNECT_BUDGET_MS
  }

  // ── Pre-flight gate (FR-001) ────────────────────────────────────────────────

  async preflight(providerId: string, slaveId: string): Promise<SendPreflightResult> {
    // 1. Chrome liveness
    const health = await this.governor.getAllHealth()
    const slaveHealth = health.get(slaveId)
    if (!slaveHealth || !this.isLive(slaveHealth.status)) {
      return { ok: false, recoveryKind: 'chrome_crash', slaveId }
    }

    // 2. CDP connection (optional transport hook)
    const transport = (this.governor as unknown as { isConnected?: (id: string) => boolean })
      .isConnected
    if (transport && !transport(slaveId)) {
      return { ok: false, recoveryKind: 'cdp_down', slaveId }
    }

    // 3. Session validity (reuse ProviderHealthKernel session_expiry signal)
    const providerHealth = this.health.getHealth(providerId)
    const sessionSignal = providerHealth?.signals.find((s) => s.signal === 'session_expiry')
    const sessionValue = sessionSignal?.value ?? null
    if (sessionValue !== null && sessionValue < 100) {
      const kind: RecoveryKind = sessionValue === 0 ? 'session_expired' : 'session_expired'
      return { ok: false, recoveryKind: kind, slaveId, sessionHealth: sessionValue }
    }

    return { ok: true, slaveId, sessionHealth: sessionValue }
  }

  // ── Wrapped send (FR-002..FR-005) ─────────────────────────────────────────────

  async sendResilient(input: SendInput): Promise<SendOutput> {
    const pre = await this.preflight(input.providerId, input.slaveId)
    if (!pre.ok && pre.recoveryKind) {
      throw new SendResilienceError(DEFAULT_MESSAGES[pre.recoveryKind], {
        recoveryKind: pre.recoveryKind,
        providerId: input.providerId,
        slaveId: input.slaveId,
        retryAfterMs: pre.retryAfterMs,
        autoReconnectAttempted: false,
        defaultMessage: DEFAULT_MESSAGES[pre.recoveryKind],
      })
    }

    try {
      return await this.sendFn(input)
    } catch (err) {
      const kind = classifyEngineError(err)
      if (kind === 'chrome_crash' || kind === 'cdp_down') {
        // FR-005: exactly one silent reconnect attempt within budget.
        const reconnected = await this.attemptReconnect(input.providerId)
        if (reconnected) {
          try {
            return await this.sendFn(input)
          } catch (err2) {
            throw this.toResilienceError(err2, input, true)
          }
        }
      }
      throw this.toResilienceError(err, input, false)
    }
  }

  // ── Recovery actions (One Entry Point — invoked via capability) ───────────────

  async recover(kind: RecoveryKind, input: SendInput): Promise<SendOutput> {
    if (kind === 'relogin') {
      return this.relogin(input)
    }
    // retry: reconnect + resend lastMessage through the same resilient path so a
    // transient failure on the retry itself is still classified and surfaced.
    await this.attemptReconnect(input.providerId)
    return this.sendResilient({ ...input, text: input.lastMessage ?? input.text })
  }

  private async relogin(input: SendInput): Promise<SendOutput> {
    if (!this.wizard) {
      throw new EngineError('Re-login is not configured for this provider')
    }
    const accountId = input.slaveId
    const needs = await this.wizard.needsSetup(input.providerId, accountId)
    if (needs) {
      // Launch visible for manual auth (bounded, agent-safe, interactive).
      await this.governor.launch(input.providerId, { visible: true })
    }
    return { ok: true }
  }

  // ── Internals ─────────────────────────────────────────────────────────────────

  private isLive(status: SlaveStatus): boolean {
    return status === 'running' || status === 'starting'
  }

  private async attemptReconnect(providerId: string): Promise<boolean> {
    const started = Date.now()
    try {
      const slave = await this.governor.launch(providerId, { visible: false })
      return Date.now() - started <= this.reconnectBudgetMs ? slave.status !== 'error' : false
    } catch {
      return false
    }
  }

  private toResilienceError(
    err: unknown,
    input: SendInput,
    attempted: boolean,
  ): SendResilienceError {
    const kind = classifyEngineError(err)
    const retryAfterMs = kind === 'circuit_open' ? this.estimateCircuitRetryMs() : undefined
    return new SendResilienceError(DEFAULT_MESSAGES[kind], {
      recoveryKind: kind,
      providerId: input.providerId,
      slaveId: input.slaveId,
      retryAfterMs,
      autoReconnectAttempted: attempted,
      defaultMessage: DEFAULT_MESSAGES[kind],
    })
  }

  private estimateCircuitRetryMs(): number {
    // Fall back to a sane default; the governor's FleetConfig.circuitBreakerResetMs
    // is the source of truth when reachable.
    return 60_000
  }
}
