# 09 — Conceptual Synthesis

Where the two methodologies agree, where they diverge, and how to combine the best of
both.

## Shared invariants (do not break)

1. **Single CDP owner.** vivim-final's Governor Canon and cap-store's fleet both
   isolate Chrome control behind one gatekeeper. Keep this — it is the correct
   security/lifecycle boundary.
2. **Capability = taxonomy(global) → binding → program/selector → recipe.** Both
   encode the same conceptual stack. This is the shared domain model; standardise
   terminology on it.
3. **Provider + confidence + outcome.** Both track a provider, a confidence/health
   signal, and a recorded outcome. The vocabulary aligns.
4. **Streaming/event publication.** vivim-final's `eventBus` and cap-store's WS
   `publish` are the same idea — broadcast execution state to subscribers.
5. **Recovery / circuit-breaking.** Both degrade gracefully (recovery ladder vs
   circuit breaker).

## Structural divergence (pick deliberately)

| Axis | vivim-final strength | cap-store strength |
|---|---|---|
| Composition | kernel + contracts + composition root | none (simpler) |
| Capability form | typed, validated, multi-surface | data-driven, late-bound |
| Execution | atomic selector + recovery | ordered program→recipe injection |
| Maturity | oracle self-heal | strict status ladder + confidence |
| Entry | NL-first one-entry-point | verb fan-out |

## Recommended synthesis (target design)

**Use vivim-final as the wiring substrate; use cap-store as the execution substrate.**

1. **Keep the kernel + store contracts.** Inject persistence as interfaces; keep
   `bootstrapKernel` as the composition root. This is the exportable win.
2. **Keep the `UnifiedCapability` + 5-surface parity.** One definition, validated at
   registration, projected to every surface. Prevents surface drift.
3. **Adopt cap-store's `ActionProgram` as the *body* of a capability's `handler`.**
   Instead of a hard-coded `handler` closure, a capability's execution loads a
   `program` (data) and runs it through `programToRecipe` → governor-gated CDP. This
   gives late-bound, redeploy-free behaviour *inside* the typed registry.
4. **Adopt cap-store's status ladder for binding maturity.** Replace ad-hoc
   `healthy`/`broken` with `prospect → test-1 → test-2 → stable → flaky → broken →
   retired`, driven by confidence. Keep vivim-final's oracle *above* it for runtime
   healing.
5. **Keep the NLCL as the human entry; keep verb fan-out as the execution fan-out.**
   One NL phrase → one capability → its handler fans out to N provider bindings
   (cap-store-style) behind the governor.
6. **Single streaming model.** Emit fine-grained blocks via the event bus (cap-store's
   block stream semantics) rather than only coarse `executed`/`failed` events.

## What not to copy

- Do **not** copy cap-store's lack of a DI seam into a large system — the contract
  boundary scales; parameter threading does not.
- Do **not** copy vivim-final's hard-coded handler closures if behaviour must change
  without redeploys — pair them with cap-store's data-driven programs.
- Do **not** run CDP outside the governor/fleet gate in either model.

## Net assessment

vivim-final is the **better runtime architecture**; cap-store is the **better
action-injection engine**. They are not competitors on the same axis — they are
adjacent layers. The highest-value integration is a thin adapter: each
`UnifiedCapability.handler` delegates to a cap-store-style `executeBinding` that is
routed exclusively through the `ChromeGovernor`. That yields typed, multi-surface,
self-describing capabilities whose *behaviour* is data-driven and *execution* is
governor-gated.
