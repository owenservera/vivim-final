# Contracts — Send Resilience Engine

**Feature**: `007-conversation-resilience` · **Plan**: [plan.md](./plan.md)

Engine-facing contract for `SendResilienceEngine`. The engine depends ONLY on these injected
interfaces (Store Contracts invariant) — never on `storage/impl/*`.

## `SendResilienceDeps`

```ts
import type { ChromeGovernor } from '../chrome-governor.js'
import type { ProviderHealthKernel } from '../provider-health.js'
import type { ChromeSetupWizard } from '../chrome-setup-wizard.js'
import type { RecoveryKind } from './data-model.js' // see data-model.md

export interface SendResilienceDeps {
  governor: ChromeGovernor // reconnect surface (Governor Canon)
  health: ProviderHealthKernel // session_expiry + circuit signals
  wizard?: ChromeSetupWizard // re-login (optional; omitted if no setup support)
  // The underlying send that the resilience engine wraps. Implemented by the
  // existing session/send pipeline (e.g. governor cdp.send + composer-typing).
  send: (input: SendInput) => Promise<SendOutput>
  // Budget for the single auto-reconnect attempt (FR-005). Default 5000 ms.
  reconnectBudgetMs?: number
}

export interface SendInput {
  providerId: string
  slaveId: string
  text: string
  conversationId: string
  // last message content retained so Retry can resend without re-prompting.
  lastMessage?: string
}

export interface SendOutput {
  ok: boolean
  messageId?: string
}
```

## `SendResilienceEngine` — public API

```ts
export class SendResilienceEngine {
  constructor(deps: SendResilienceDeps)

  /**
   * Pre-flight gate (FR-001). Checks, in order:
   *   1. Chrome liveness   — governor.getAllHealth() has a running slave for providerId
   *   2. CDP connection     — governor.isConnected?(slaveId)
   *   3. Session validity   — health.getHealth(providerId) session_expiry signal
   * Returns ok:false with recoveryKind instead of throwing on a pre-flight failure.
   */
  preflight(providerId: string, slaveId: string): Promise<SendPreflightResult>

  /**
   * Wrapped send (FR-002..FR-005). Flow:
   *   1. run preflight; if !ok throw SendResilienceError(recoveryKind)
   *   2. try send(); on EngineError:
   *        - circuit-open pattern → recoveryKind 'circuit_open' (+ retryAfterMs)
   *        - CDP/transport error   → recoveryKind 'cdp_down' | 'chrome_crash'
   *   3. on crash/cdp_down: ONE silent ensureConnected/launch attempt (budget),
   *      then transparently resend; only on 2nd failure throw with
   *      autoReconnectAttempted=true (FR-005)
   *   4. on session_expired → throw with recoveryKind 'session_expired'
   */
  sendResilient(input: SendInput): Promise<SendOutput>

  /**
   * Recovery action invoked by the UI slot (One Entry Point — via capability).
   * 'retry'   → ensureConnected/launch + resend lastMessage
   * 'relogin' → wizard.needsSetup + launch visible (manual re-auth)
   */
  recover(kind: RecoveryKind, input: SendInput): Promise<SendOutput>
}
```

## Error mapping rules (must hold)

| Thrown / observed | recoveryKind |
|-------------------|--------------|
| `EngineError` message matches `/Circuit breaker open/i` | `circuit_open` |
| `EngineError('CDP transport not configured')` or CDP timeout | `cdp_down` |
| Chrome process gone (`getAllHealth` shows slave `stopped`/`error`) | `chrome_crash` |
| `health` session_expiry signal === 0 | `session_expired` |
| anything else | `unknown` |

> `recover('retry')` returns the resend result; `recover('relogin')` returns once the wizard
> launches visible (login itself is interactive). Both go through the capability pipeline so the
> UI re-renders from the same slot contract.
