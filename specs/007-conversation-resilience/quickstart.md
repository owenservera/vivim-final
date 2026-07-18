# Quickstart — Conversation Resilience

**Feature**: `007-conversation-resilience` · **Plan**: [plan.md](./plan.md)

End-to-end validation scenarios. Each is reproducible **without a real provider login** by
mocking the governor/health/wizard deps (used in integration tests) and via the UI slot in the
browser (used in manual E2E).

## Scenario A — Chrome crash during send → one-click Retry (US1, FR-002, FR-005)

1. Start backend; seed one provider account with a slave in `running` state.
2. Force the slave process to die (test: resolve `governor.getAllHealth` to `stopped`; manual: kill the Chrome pid).
3. Invoke the chat send capability with a message.
4. **Expected**:
   - Engine attempts ONE silent `launch` (budget ≤5 s).
   - If the relaunch fails, UI renders `SendErrorSlot` with text
     *"Chrome disconnected — your message was not sent. Click Retry to reconnect and resend."*
     and a **Retry** button.
   - Click Retry → `recover('retry')` reconnects the slave and resends `lastMessage`; user sees
     normal streaming response. (SC-001: one-click recovery path exists.)
5. **No raw stack trace** is shown to the user (SC-003).

## Scenario B — Session expiry mid-conversation → Re-login (US2, FR-003)

1. Seed a running slave whose auth cookies are expired (test: `health.getHealth(providerId)`
   returns `session_expiry` signal `0`; manual: let the cookie lapse).
2. Invoke send.
3. **Expected**:
   - Pre-flight detects expired session → `SendResilienceError` with `recoveryKind:'session_expired'`.
   - UI renders inline warning *"ChatGPT session expired — click to re-login"* (provider name from
     the account) with a **Re-login** button.
   - Click Re-login → `recover('relogin')` calls `ChromeSetupWizard` → Chrome opens **visible** to
     the provider login page. (SC-002: expiry detected at pre-flight, <1 s.)
4. After manual login, subsequent sends pass pre-flight.

## Scenario C — Circuit breaker open → "temporarily unavailable" (US3, FR-004)

1. Force the governor's circuit to `open` for the slave (test: stub `governor.cdp.send` to throw
   `EngineError('Circuit breaker open for slave: …')`; manual: trip via repeated failures).
2. Invoke send.
3. **Expected**:
   - Engine catches the error → `recoveryKind:'circuit_open'` with `retryAfterMs` derived from
     `FleetConfig.circuitBreakerResetMs`.
   - UI renders *"Provider temporarily unavailable — waiting for recovery"* with a countdown of
     `retryAfterMs`. No error storm; no raw trace (SC-003).

## Scenario D — Happy path (no regression)

1. All checks green; send proceeds normally; `SendErrorSlot` is not rendered.
   Confirms the resilience wrapper is transparent when healthy.

## How to run

- **Unit/integration**: `bun test tests/integration/engines/send-resilience.test.ts`
  (mock `SendResilienceDeps`).
- **Manual UI**: launch stack (`pwsh scripts/start-bg.ps1`), open chat, trigger A/B/C by toggling
  the mock flags exposed on `SendResilienceEngine` (dev-only) or by killing the slave process.
- **Gates after each phase** (from tasks template):
  `bun run typecheck`, `bun test tests/unit/engines/send-resilience*`, `bun run lint`,
  `bun run devops invariants check --category B`.
