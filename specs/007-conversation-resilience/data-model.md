# Data Model — Conversation Resilience

**Feature**: `007-conversation-resilience` · **Plan**: [plan.md](./plan.md)

Types introduced by this feature. No Prisma schema changes (all state derived — see research R7).

## Recovery Kind (closed union)

```ts
// The classification a send failure maps to. Drives which recovery UI slot renders.
export type RecoveryKind =
  | 'chrome_crash' // Chrome slave process died mid-send
  | 'cdp_down' // CDP transport dropped
  | 'session_expired' // provider auth cookie expired
  | 'circuit_open' // governor circuit breaker open for the slave
  | 'unknown' // liveness unknown / unclassified
```

## Send Resilience Error

```ts
import { EngineError } from '../errors.js'

export interface SendResilienceErrorContext {
  recoveryKind: RecoveryKind
  providerId: string
  slaveId?: string
  // For circuit_open: ms until the breaker is expected to half-open.
  retryAfterMs?: number
  // Whether a silent auto-reconnect was already attempted (FR-005).
  autoReconnectAttempted: boolean
  // Optional human-facing default (overridable by UiComponent tier, FR-006).
  defaultMessage?: string
}

// Custom error — never a raw `new Error()`. Carries machine-readable recoveryKind
// so the UI can pick the correct slot without string matching.
export class SendResilienceError extends EngineError {
  readonly recoveryKind: RecoveryKind
  readonly providerId: string
  readonly slaveId?: string
  readonly retryAfterMs?: number
  readonly autoReconnectAttempted: boolean
  readonly defaultMessage?: string

  constructor(message: string, ctx: SendResilienceErrorContext) {
    super(message)
    this.name = 'SendResilienceError'
    this.recoveryKind = ctx.recoveryKind
    this.providerId = ctx.providerId
    this.slaveId = ctx.slaveId
    this.retryAfterMs = ctx.retryAfterMs
    this.autoReconnectAttempted = ctx.autoReconnectAttempted
    this.defaultMessage = ctx.defaultMessage
  }
}
```

## Pre-flight Result

```ts
export interface SendPreflightResult {
  ok: boolean
  recoveryKind?: RecoveryKind // set when ok === false
  slaveId?: string
  retryAfterMs?: number // populated for circuit_open
  // session_expiry signal value from ProviderHealthKernel (0/50/100/null)
  sessionHealth?: number | null
}
```

## UI Slot Payload (transmitted to the chat surface)

```ts
export interface ResilienceSlotPayload {
  recoveryKind: RecoveryKind
  message: string // resolved from UiComponent tier, falls back to defaultMessage
  actions: Array<'retry' | 'relogin'>
  retryAfterMs?: number
}
```

> All types use `type` imports and `.js` extensions at consumption sites (TS strict).
> `RecoveryKind` is a closed union — exhaustive `switch` in the UI with a `never` guard.
