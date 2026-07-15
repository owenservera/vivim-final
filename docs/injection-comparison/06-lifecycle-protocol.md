# 06 — Lifecycle & Health Protocol

How each repo tracks the *state* of an engine/binding and how confidence moves it.

## vivim-final: registry status + selector health + oracle

### Engine status in the registry

`KernelRegistry` tracks each engine/store/capability/route with a `status` field and
transitions via `markWired` / `markRunning` / `markError` / `markStopped`. Health is
pushed through `updateHealth(id, HealthState)`, which auto-marks `running`/`error`.
Observers (`onStatusChange`) react.

### Selector/binding health

`CapabilityEngine` records outcomes and updates:

- `store.updateSelectorHealth(primary.id, ok)`
- `store.updateBindingHealth(binding.id, { status: 'healthy' | 'broken' })`

Health is **binary per attempt** and feeds **recovery selection** (doc 05), not a
promotion ladder.

### Self-healing: the oracle

A dedicated sub-system (`oracle-query`, `oracle-diagnostic`, `oracle-actuator`,
`oracle-event-stream`) observes the registry and *acts* to heal. This is injection of
**corrective behaviour** driven by health signals.

## cap-store (OG): status ladder + confidence-driven promotion

### The ladder

`lifecycle/index.ts` defines a strict state machine:

```
prospect → test-1 → test-2 → stable → flaky → broken → retired
```

with `VALID_TRANSITIONS` enforcing legal moves and `assertValidTransition` guarding
them.

### Auto-promotion via confidence

`autoStatus(binding)` advances the binding based on observed `oks`/`fails`:

- `prospect` → `test-1` after 1 ok
- `test-1` → `test-2` after 2 oks
- `test-2` → `stable` after 3 oks **and** `confidence ≥ 0.65`
- any fail while `stable`/`broken` → `broken`

`confidence()` consumes `confidence_inputs`
(`oks, fails, last_ok_ms, replay_verified, intended_matched, pattern_hits`).

### Timeout guard

`checkTimeoutGuard` / `applyTimeoutGuard` auto-promote bindings stuck too long in
`test-1` (>24h) / `test-2` (>7d) if confidence thresholds met — a time-based promotion
safety net.

### Escalation at resolve time

`shouldEscalate` decides per-binding whether a dispatch should be `escalated` based
on the same confidence inputs.

### Fleet circuit breaker

The fleet wraps `ensure` in a `CircuitOpenError` circuit breaker — if a provider is
failing, calls are rejected fast and surfaced as a retry-after error.

## Contrast

| | vivim-final | cap-store (OG) |
|---|---|---|
| State model | free-form status per node | strict ladder w/ legal transitions |
| Confidence role | selects **recovery** strategy | drives **promotion/escalation** |
| Health direction | updates selector/binding health | advances binding status |
| Self-healing | oracle actuator (reactive) | ladder auto-promote + circuit breaker |
| Time dimension | none | timeout-guard promotion |

## Takeaway

vivim-final treats health as **a signal to recover an action**; cap-store treats
confidence as **a signal to promote or retire a binding**. The cap-store ladder is a
more rigorous, testable state machine for *capability maturity*; vivim-final's oracle
is a more general *self-healing* mechanism. The recommended model: adopt cap-store's
ladder as the **maturity protocol** for bindings, and keep vivim-final's oracle as the
**runtime healing** layer above it.
