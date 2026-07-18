# Research Log — Conversation Resilience

**Feature**: `007-conversation-resilience` · **Plan**: [plan.md](./plan.md)

Decisions resolving every `NEEDS CLARIFICATION` / open design question from spec.md.
Format: **Decision / Rationale / Alternatives rejected**.

---

## R1 — What is the legal reconnect surface?

**Decision**: `ChromeGovernor` only. `SendResilienceEngine` triggers reconnect via
`governor.ensureConnected(slaveId)` (auto-attaches transport if dropped) and, when the slave
process is dead, `governor.launch(providerId, { visible: false })`. The engine never imports
`BunCdpClient` (Governor Canon, AGENTS.md §Critical Boundaries #1).

**Rationale**: Governor Canon is a non-negotiable invariant; `ChromeGovernor` already owns the
fleet lifecycle, circuit breaker, and CDP transport. Reusing it avoids a second CDP owner and
keeps circuit-breaker accounting in one place.

**Alternatives rejected**:
- Direct `BunCdpClient` reconnect from the resilience engine → violates Governor Canon, duplicates
  circuit logic. Rejected.
- A new `ReconnectEngine` → unnecessary layer; governor already exposes the method. Rejected.

---

## R2 — How do we detect session expiry without re-implementing cookie logic?

**Decision**: Read `ProviderHealthKernel.getHealth(providerId).signals` for the `session_expiry`
signal (value 0 = expired, 50 = near, 100 = valid, null = unknown), computed by the existing
`checkSessionExpiry()` CDP cookie inspection in `provider-health.ts`. Pre-flight uses this signal;
the resilience engine does **not** parse cookies itself.

**Rationale**: `004`/`006` already built and tuned the session-expiry signal. Re-implementing it
would drift from the canonical health model and double the CDP traffic.

**Alternatives rejected**:
- Re-implement `Network.getCookies` in the resilience engine → drift + duplicate CDP calls. Rejected.
- Treat `null` (unknown) as failure → too strict; Chrome may simply be mid-restart. Treated as
  "liveness unknown, proceed but guard send". Rejected as default.

---

## R3 — How is circuit-open surfaced?

**Decision**: `ChromeGovernor.cdp.send`/`submitMessage` already throw
`EngineError('Circuit breaker open for slave: <id>')`. The resilience engine catches `EngineError`
and, when the message matches the circuit-open pattern, maps it to `recoveryKind: 'circuit_open'`
with an estimated retry time derived from `FleetConfig.circuitBreakerResetMs`.

**Rationale**: Circuit state is owned by the governor; we observe, never re-derive.

**Alternatives rejected**: Polling circuit state pre-flight then blocking → the governor already
blocks at send time, so catching the thrown error is simpler and race-free. Rejected pre-flight poll.

---

## R4 — Re-login flow

**Decision**: The recovery "Re-login" action invokes the existing `ChromeSetupWizard` flow
(`needsSetup()` → launch visible → poll login URL) via the existing setup capability. The button
label is a `UiComponent` slot string, not a hardcoded literal (FR-006).

**Rationale**: `chrome-setup-wizard.ts` already implements bounded, agent-safe manual re-auth.
Reusing it keeps one login path.

**Alternatives rejected**: Auto-login without user presence → impossible (CAPTCHA/interactive auth).
Rejected.

---

## R5 — Where do recovery strings live?

**Decision**: Error *codes* (`recoveryKind`) live in `SendResilienceError` (backend, deterministic).
Human strings ("Chrome disconnected — your message was not sent…") live in the conceptual model
(`UiComponent` tiers) resolved by `ConceptualModelService`, consistent with FR-006 and the
canvas/conceptual-model frontend model (AGENTS.md). A fallback default string ships in code so the
UI never renders an empty error if no tier is seeded.

**Rationale**: AGENTS.md mandates DB-backed surfaces over hardcoded `if (slug===...)` branches;
FR-006 explicitly requires surfacing resilience states as capability slots.

---

## R6 — Auto-recovery timer (FR-005)

**Decision**: On send failure classified as `chrome_crash` or `cdp_down`, the engine performs
**exactly one** `ensureConnected`/`launch` attempt (budget ≤5 s) before constructing the user-facing
error. If the single attempt succeeds, it transparently resends; only on second failure does it
surface the error with the Retry button.

**Rationale**: One silent retry matches the spec ("attempt one reconnect before showing the error")
without risking a retry storm.

**Alternatives rejected**: Multiple auto-retries → could mask hard failures and stall the UI. Rejected.

---

## R7 — Do we need new DB tables?

**Decision**: No. All resilience state is derived from existing `providerAccount` (`loginState`,
`profileDir`), governor fleet state, and the health/circuit stores. `SendResilienceError` is transient
(runtime, not persisted).

**Rationale**: Avoids migration churn and keeps the feature additive.
