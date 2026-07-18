# Decision Table: SpecKit vs DevOps

Use this table to decide which system (or both) to drive a given scenario.

| Scenario | Use SpecKit | Use DevOps | Use Both | Why |
|----------|------------|------------|----------|-----|
| New feature with requirements | `specify` → `plan` → `tasks` | — | implement via devops loop | SpecKit defines **what**; DevOps builds it |
| Bug fix | — | goal mode (`devops runtime-test loop`) | — | No spec needed; fix directly |
| Atomic unit from tracker | — | tracker mode (`devops select`/`mark`) | — | Already defined in tracker |
| Architecture change | `plan` (constitution check) | `audit-arch` | `converge` + `audit` | Plan for design; audit for validation |
| Research needed | `clarify` Phase 0 | `devops-research` | bridge brief | DevOps has deeper research; bridge converts formats |
| Full release | `tasks` → `implement` → `converge` | `audit-code full` | unified gate | Both systems validate |
| Taxonomy expansion | — | `devops-generators` | — | DevOps-only domain |
| Frontend UI | `plan` contracts | `vivi-frontend` | — | Plan defines contracts; frontend builds them |
| Schema change | `data-model.md` | `prisma-workflow` | — | SpecKit defines model; Prisma implements |
| New capability | `plan` → `tasks` | devops loop | `speckit sync` | SpecKit plans; DevOps builds; sync tracks |
| Tracking progress across both | — | `devops speckit sync` | — | Bidirectional task↔unit linkage |
| Quality gate before commit | — | `devops speckit gate` | — | Unified gate wraps typecheck/lint/test + SpecKit checklists |
| Convergence check vs spec | `converge` | `devops speckit converge` | — | Both run spec/code/arch analysis; DevOps appends tasks |
| Skill readiness audit | — | `devops speckit audit` | — | Audits 12 skills for SpecKit-awareness |
| New webapp provider (onboard chatgpt.com etc.) | `specify` → `plan` | `runtime-test onboard run` | `onboard converge` (unified gate) | SpecKit defines the provider contract; DevOps onboarding modes (discover→infer→test-selectors→test-parse→test-cap→test-frontend→verify→converge) build + verify it; every activity logged for post-mortem |

## How to Read

- **SpecKit only** — pure spec/plan/task authoring, no code execution.
- **DevOps only** — autonomous build/audit loops driven by the tracker or a goal.
- **Both** — SpecKit defines the artifact, DevOps executes and tracks it through the bridge.

## Related Docs

- [UNIFIED-WORKFLOW.md](./UNIFIED-WORKFLOW.md) — the full 6-step canonical workflow.
- `devops/speckit-bridge.ts` — task↔unit ID mapping.
- `devops/unified-gate.ts` — unified quality gate.
- `devops/speckit-converge-bridge.ts` — consolidated converge pipeline.
