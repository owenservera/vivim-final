# atomic-v14 — Phase Index

**Synthesis goal:** graft the **proven cap-store injection harness** (program→recipe→CDP
injection, content pipeline, stream reconstruction, status ladder + confidence) onto
**vivim-final's** existing governor-gated, registry-backed, multi-surface architecture.

**Canon rules (from devops skill):** strictly sequential; gate before `done`; clean tree;
grounded in vivim-final truth (no reimplementation of existing engines).

## Phases & dependency order

```
Phase 21  Harness Core ............ opens after atomic-v13 (governor/fleet) + v8 (taxonomy)
  Phase 22  Program Model ......... depends on 21
    Phase 23  Harness Execution ... depends on 22
      Phase 24  Lifecycle & Conf .. depends on 23
        Phase 25  Surface & Verify  depends on 24
```

| Phase | Title | Units | Grounded in |
|---|---|---|---|
| 21 | Harness Core | 21.1–21.4 | `FleetSupervisor`, `CapabilityStore`, `unified-registry` |
| 22 | Program Model | 22.1–22.4 | `CapabilityProgramRow`, `capability-store` contract, `provider-registrar` |
| 23 | Harness Execution | 23.1–23.4 | `chrome-governor`, `composer-typing`, `stream-block-store`, `circuit-breaker` |
| 24 | Lifecycle & Confidence | 24.1–24.4 | `lifecycle/index.ts` (cap-store), `capability-resolution` |
| 25 | Surface & Verification | 25.1–25.4 | `cdp-capability-registrar`, `CapabilityEventBus`, `kernel-bootstrap` |

## Unit → file map

- 21.1 `phase-21-harness-core/21.1-harness-contract.md`
- 21.2 `phase-21-harness-core/21.2-fleet-lifecycle-adapter.md`
- 21.3 `phase-21-harness-core/21.3-recipe-types.md`
- 21.4 `phase-21-harness-core/21.4-recipe-compiler.md`
- 22.1 `phase-22-program-model/22.1-program-schema.md`
- 22.2 `phase-22-program-model/22.2-program-store.md`
- 22.3 `phase-22-program-model/22.3-program-registrar.md`
- 22.4 `phase-22-program-model/22.4-binding-program-link.md`
- 23.1 `phase-23-harness-execution/23.1-harness-executor-engine.md`
- 23.2 `phase-23-harness-execution/23.2-content-pipeline-adapter.md`
- 23.3 `phase-23-harness-execution/23.3-stream-capture-reconstruct.md`
- 23.4 `phase-23-harness-execution/23.4-circuit-breaker-adapter.md`
- 24.1 `phase-24-lifecycle-confidence/24.1-binding-status-ladder.md`
- 24.2 `phase-24-lifecycle-confidence/24.2-confidence-promotion.md`
- 24.3 `phase-24-lifecycle-confidence/24.3-health-probe-adapter.md`
- 24.4 `phase-24-lifecycle-confidence/24.4-timeout-guard.md`
- 25.1 `phase-25-surface-verification/25.1-unified-capability-program-handler.md`
- 25.2 `phase-25-surface-verification/25.2-recipe-capability-registration.md`
- 25.3 `phase-25-surface-verification/25.3-observability-streaming.md`
- 25.4 `phase-25-surface-verification/25.4-v14-verification.md`

See `SYNTHESIS.md` for the conceptual framework and `01-tracker.md` for state.
