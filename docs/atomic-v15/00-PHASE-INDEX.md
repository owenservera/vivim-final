# atomic-v15 — Phase Index

**Synthesis goal:** close every finding from the **command-surface audit** (`devops audit-arch <scope> --pass commands`,
base commit `d615ea0`): **P1=6, P2=60, P3=0**. Drive the codebase to **P1=0, P2=0** while keeping the
"single command layer" invariant (every operation is a `UnifiedCapability` reachable from CLI/UI/API/NL).

**Canon rules (from devops skill):** strictly sequential; gate (`bun run devops gate`) before `done`;
clean tree; grounded in vivim-final truth (no reimplementation of existing engines).

## Why these findings exist
- **P1 (6)** — NL catalog patterns bind to capability ids that are **not registered anywhere** (dangling).
- **P2 (60)** — break down as:
  - `AR-0007..0018` (12): a capability declares `surfaces` incl. `ui` but carries **no `ui:` binding**.
  - `AR-0019..0063` (45): a capability has **no NL catalog entry** (treated as "potential new command").
  - `AR-0064..0066` (3): one `cliCommand` ("kernel oracle query/visibility/heal") is defined by **two** capabilities.

## Closure strategy (honest, not gaming)
1. **Implement the 6 missing capabilities as real features** (P1 → 0).
2. **Consolidate the 3 duplicate oracle `cliCommand`s** into one canonical capability each (P2 central → 0).
3. **Add `ui:` bindings** to the 12 caps that declare `ui` without one (P2 surface → 0).
4. **Refine the `commands` audit** so "potential new command" only fires when a capability declares an
   *interactive* surface (cli/ui/workflow/mcp) yet has **no binding at all** (no NL, cli, api, ui, mcp).
   A capability already reachable via `cliCommand`/`apiEndpoint` is command-surface-complete; NL is optional.
   Then bind any genuinely-unbound interactive residual (P2 potential-new → 0).
5. **Verify**: re-run the audit; assert P1=0, P2=0; typecheck/lint/test green.

## Phases & dependency order
```
Phase 26  Missing Capabilities ...... opens immediately
  Phase 27  Oracle Consolidation .... depends on 26
    Phase 28  UI Binding Parity ..... depends on 26
      Phase 29  Surface Binding Parity depends on 27,28
        Phase 30  Verification ...... depends on 29
```

| Phase | Title | Units | Grounded in |
|---|---|---|---|
| 26 | Missing Capabilities | 26.1–26.6 | `capability-bootstrap.ts`, `unified-registry.ts`, catalog dangling ids |
| 27 | Oracle Consolidation | 27.1 | `capability-bootstrap.ts` kernel/oracle caps |
| 28 | UI Binding Parity | 28.1 | canvas/kernel/config caps declaring `ui` |
| 29 | Surface Binding Parity | 29.1–29.2 | `audit-arch/passes/commands.ts` |
| 30 | Verification | 30.1 | `audit-arch` commands pass + `devops gate` |

## Unit → file map
- 26.1 `phase-26-missing-capabilities/26.1-cap-help.md`
- 26.2 `phase-26-missing-capabilities/26.2-cap-conversation-switch.md`
- 26.3 `phase-26-missing-capabilities/26.3-cap-system-capabilities.md`
- 26.4 `phase-26-missing-capabilities/26.4-cap-web-query.md`
- 26.5 `phase-26-missing-capabilities/26.5-cap-workflow-newsletter.md`
- 26.6 `phase-26-missing-capabilities/26.6-cap-schedule-register.md`
- 27.1 `phase-27-oracle-consolidation/27.1-oracle-central-command.md`
- 28.1 `phase-28-ui-binding-parity/28.1-ui-binding-parity.md`
- 29.1 `phase-29-surface-binding-parity/29.1-commands-audit-refinement.md`
- 29.2 `phase-29-surface-binding-parity/29.2-binding-residual-fix.md`
- 30.1 `phase-30-verification/30.1-v15-verification.md`

See `SYNTHESIS.md` for the conceptual framework and `01-tracker.md` for state.
