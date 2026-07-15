# atomic-v15 — Tracker

Single source of truth. States: `pending | in_progress | done | blocked`.

> Selection (devops skill): a unit is selectable only if its phase is open (all
> lower-indexed phases `done`) and all `**Depends:**` units are `done`. Gate =
> `bun run devops gate` (typecheck + lint + bun test). Drive with:
> `bun run devops select --tracker docs/atomic-v15/01-tracker.md --atomic-dir docs/atomic-v15`
> `bun run devops mark <id> <state> --tracker docs/atomic-v15/01-tracker.md --atomic-dir docs/atomic-v15`

## Phase 26: Missing Capabilities (close 6 P1 dangling)
- [x] 26.1 — cap-help → `src/engines/command-parity-capabilities.ts`
- [x] 26.2 — cap-conversation-switch → `src/engines/command-parity-capabilities.ts`
- [x] 26.3 — cap-system-capabilities → `src/engines/command-parity-capabilities.ts`
- [x] 26.4 — cap-web-query → `src/engines/command-parity-capabilities.ts`
- [x] 26.5 — cap-workflow-newsletter → `src/engines/command-parity-capabilities.ts`
- [x] 26.6 — cap-schedule-register → `src/engines/command-parity-capabilities.ts`

## Phase 27: Oracle Consolidation (close 3 P2 central)
- [x] 27.1 — oracle-central-command → `src/engines/capability-bootstrap.ts`

## Phase 28: UI Binding Parity (close 12 P2 surface)
- [x] 28.1 — ui-binding-parity → `src/canvas/canvas-agent-tools.ts`, `src/canvas/mutation-caps.ts`, `src/engines/capability-bootstrap.ts`

## Phase 29: Surface Binding Parity (close 45 P2 potential-new)
- [x] 29.1 — commands-audit-refinement → `devops/audit-arch/passes/commands.ts`
- [x] 29.2 — binding-residual-fix → capability definitions (data-driven after 29.1)

## Phase 30: Verification
- [x] 30.1 — v15-verification → re-run audit-arch commands; assert P1=0, P2=0
