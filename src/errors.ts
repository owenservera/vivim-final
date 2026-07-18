// src/errors.ts
// Typed error hierarchy for the entire system.

export class CapStoreError extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'CapStoreError'
    this.code = code
    this.details = details
  }

  toJSON() {
    return { error: this.message, code: this.code, details: this.details }
  }
}

export class ValidationError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('ValidationError', message, details)
  }
}

export class NotFoundError extends CapStoreError {
  constructor(message: string) {
    super('NotFoundError', message)
  }
}

export class ConflictError extends CapStoreError {
  constructor(message: string) {
    super('ConflictError', message)
  }
}

export class AuthRequired extends CapStoreError {
  constructor(message: string) {
    super('AuthRequired', message)
  }
}

// Governor-specific errors
export class SlaveNotRunningError extends CapStoreError {
  constructor(slaveId: string) {
    super('SlaveNotRunningError', `Slave ${slaveId} is not running`)
  }
}

export class SlaveBusyError extends CapStoreError {
  constructor(slaveId: string) {
    super('SlaveBusyError', `Slave ${slaveId} is busy`)
  }
}

export class CdpTimeoutError extends CapStoreError {
  constructor(method: string) {
    super('CdpTimeoutError', `CDP command ${method} timed out`)
  }
}

export class CircuitOpenError extends CapStoreError {
  constructor(slaveId: string) {
    super('CircuitOpenError', `Circuit breaker open for slave ${slaveId}`)
  }
}

export class CdpConnectionError extends CapStoreError {
  constructor(message: string) {
    super('CdpConnectionError', message)
  }
}

export class ChromeNotFoundError extends CapStoreError {
  constructor() {
    super('ChromeNotFoundError', 'Chrome binary not found')
  }
}

export class PortOccupiedError extends CapStoreError {
  constructor(range: string) {
    super('PortOccupiedError', `All ports in range ${range} occupied`)
  }
}

export class EngineError extends CapStoreError {
  constructor(message: string) {
    super('EngineError', message)
  }
}

// ── Agentic / Intent ─────────────────────────────────────────
export class IntentDecompositionError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('IntentDecompositionError', message, details)
  }
}

export class CapabilityNotFoundError extends CapStoreError {
  constructor(slug: string) {
    super('CapabilityNotFoundError', `Capability not found: ${slug}`)
  }
}

export class CapabilityCompositionError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('CapabilityCompositionError', message, details)
  }
}

// ── Canvas ────────────────────────────────────────────────────
export class CanvasSpawnError extends CapStoreError {
  constructor(message: string) {
    super('CanvasSpawnError', message)
  }
}

export class CanvasMutationError extends CapStoreError {
  constructor(message: string) {
    super('CanvasMutationError', message)
  }
}

// ── Sandbox ──────────────────────────────────────────────────
export class SandboxTimeoutError extends CapStoreError {
  constructor(handlerSlug: string, budgetMs: number) {
    super('SandboxTimeoutError', `Handler ${handlerSlug} exceeded ${budgetMs}ms budget`)
  }
}

export class SandboxBudgetError extends CapStoreError {
  constructor(handlerSlug: string, kind: 'cpu' | 'memory', used: number, budget: number) {
    super('SandboxBudgetError', `${handlerSlug} ${kind} ${used} > ${budget}`)
  }
}

export class SandboxPermissionError extends CapStoreError {
  constructor(handlerSlug: string, denied: string) {
    super('SandboxPermissionError', `${handlerSlug} denied: ${denied}`)
  }
}

// ── Sovereign / Sync ─────────────────────────────────────────
export class ConsentViolationError extends CapStoreError {
  constructor(host: string) {
    super('ConsentViolationError', `Outbound call to ${host} denied (no user consent)`)
  }
}

export class SyncConflictError extends CapStoreError {
  constructor(table: string, recordId: string) {
    super('SyncConflictError', `Conflict on ${table}:${recordId}`)
  }
}

// ── HITL ─────────────────────────────────────────────────────
export class HitlGateExpiredError extends CapStoreError {
  constructor(gateId: string) {
    super('HitlGateExpiredError', `Gate ${gateId} expired without resolution`)
  }
}

export class HitlGateDeniedError extends CapStoreError {
  constructor(gateId: string, by: string) {
    super('HitlGateDeniedError', `Gate ${gateId} denied by ${by}`)
  }
}

// ── Budget ───────────────────────────────────────────────────
export class BudgetExceededError extends CapStoreError {
  constructor(budget: 'cost' | 'tokens' | 'iterations' | 'duration', used: number, limit: number) {
    super('BudgetExceededError', `${budget} ${used} > ${limit}`)
  }
}

// ── Harness Command Registry / Repair Engine (017-harness-command-registry) ──
export class HarnessRepairError extends CapStoreError {
  constructor(message: string, details?: unknown) {
    super('HarnessRepairError', message, details)
  }
}

export class HarnessCommandNotFoundError extends CapStoreError {
  constructor(commandId: string, version?: string) {
    const v = version ? ` v${version}` : ''
    super('HarnessCommandNotFoundError', `Harness command not found: ${commandId}${v}`)
  }
}

export class HarnessRetryExhaustedError extends CapStoreError {
  public readonly attempts: number
  public readonly lastError?: string

  constructor(attempts: number, lastError?: string) {
    super('HarnessRetryExhaustedError', `Retry exhausted after ${attempts} attempt(s)`, {
      attempts,
      lastError,
    })
    this.attempts = attempts
    this.lastError = lastError
  }
}

// ── SendResilience ────────────────────────────────────────────────

export type RecoveryKind = 'chrome_crash' | 'cdp_down' | 'session_expired' | 'circuit_open' | 'unknown' | 'relogin'

export class SendResilienceError extends CapStoreError {
  public readonly recoveryKind: RecoveryKind
  public readonly retryAfterMs?: number
  public readonly autoReconnectAttempted: boolean

  constructor(message: string, meta: { recoveryKind: RecoveryKind; providerId: string; slaveId: string; retryAfterMs?: number; autoReconnectAttempted: boolean; defaultMessage: string }) {
    super('SendResilienceError', message, meta)
    this.recoveryKind = meta.recoveryKind
    this.retryAfterMs = meta.retryAfterMs
    this.autoReconnectAttempted = meta.autoReconnectAttempted
  }
}
