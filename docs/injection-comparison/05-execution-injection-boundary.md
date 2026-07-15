# 05 — Execution Injection Boundary (CDP)

Both repos ultimately *perform an action in a provider's web UI via Chrome DevTools
Protocol*. This is where the "injection" metaphor is most literal. The **boundary
rules** differ sharply.

## Shared substrate: a single CDP owner

Both honour the principle that **only one owner talks to CDP**:

- vivim-final: **Governor Canon** — "Only `ChromeGovernor` touches CDP. No engine
  imports `BunCdpClient`." `CapabilityEngine` never opens a socket; it calls
  `governor.cdp.send(slaveId, method, params)`.
- cap-store: **fleet owns Chrome** — `executeBinding` delegates slave lifecycle to
  `fleet.ensure(providerId)` and only then `createCdpClient()`; the recipe runs
  against the fleet-managed page.

Both isolate CDP behind a gatekeeper. Good — converge here.

## vivim-final: capability → selector → governor.cdp

Execution path in `CapabilityEngine.execute`:

1. `store.getCapabilityBySlug(slug)` → `store.getBinding(cap.id, providerId)`.
2. `store.getSelectors(cap.id, providerId)` → pick `primary`.
3. `runSelector` → `governor.cdp.send(slaveId, 'DOM.querySelector', { selector })`.
4. On miss, walk **recovery strategies**
   (`retry_selector` → `retry_with_fallback` → `navigate_home` → `restart_chrome` →
   `mark_broken`), each an injected CDP call.
5. Record outcome; emit `capability:executed` / `capability:failed` on `eventBus`.

The "injection" here is **selector-value injection into a CDP DOM call**, mediated by
the governor. The action is **small and atomic** (a single selector hit), wrapped in
recovery. The capability's *meaning* is in the code handler; CDP is just the final
actuator.

## cap-store (OG): program → recipe → injected action sequence

Execution path in `executeBinding`:

1. Load `binding` + `provider` + `program(best_program_id)`.
2. `resolveDebugPort(providerId)` (from `PROVIDER_PROFILES` in `fleet.ts`).
3. `fleet.ensure(providerId)` → `createCdpClient()` → `connect` → `listTargets` →
   `attach(page.id)` → `sessionId`.
4. `programToRecipe(program, providerId)`: each `ActionStep` op
   (`click|type|wait|navigate|arm`) becomes a `RecipeStep` verb.
5. `runRecipe(client, sessionId, recipe, { prompt, model, actionTag }, sink)` —
   streams blocks via `onBlock`/`onDone`/`onError`.
6. `recordOutcome` → `publish` WS delta.

The "injection" here is a **full action sequence injected into a live page**: the
program *is* the behaviour, translated verb-by-verb to CDP and performed in order.
This is macro-level injection (a workflow), not a single selector.

## Boundary-rule comparison

| Rule | vivim-final | cap-store (OG) |
|---|---|---|
| CDP owner | `ChromeGovernor` (canon) | `fleet` (ensure + client) |
| Action granularity | single selector + recovery | ordered op sequence (recipe) |
| Behaviour source | code handler decides CDP call | `ActionProgram` rows decide CDP calls |
| Streaming | eventBus emit (coarse) | WS block stream (fine-grained) |
| Failure handling | recovery strategy ladder | circuit breaker + status ladder |
| Prompt injection | passed as `input` to handler | passed into `runRecipe` as prompt |

## Takeaway

vivim-final's boundary is **a guarded, atomic, recoverable selector call**. cap-store's
boundary is **a streamed, multi-step program injection into a page**. They are
complementary: vivim-final gives the *safety gate*; cap-store gives the *rich action
language*. The recommended execution substrate is cap-store's program→recipe model,
but routed exclusively through vivim-final's governor gate.
