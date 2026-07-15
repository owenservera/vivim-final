# Changelog — atomic-v18

## 2026-07-14 — v18.0.0 (Skill Consolidation + Automation Integration)
- **PRD** (`docs/atomic-v18/PRD.md`): 5 toolkit gaps from skills/devops audit.
- **1.1** Fix `arch-audit` TypeScript errors (ModuleGraph export, Dimension type, null access).
- **1.2** Fix `providerDefinition` upsert constraint (seed crash).
- **1.3** Fix `policyRule` maxOccurrences (seed crash).
- **2.1** Consolidate `devops` + `vivim-runtime` into one skill with tracker-mode and goal-mode.
- **2.2** Fold `vivim-build` engine template into `devops` Build Strategies.
- **2.3** Wire `UIAutomator` into devops CLI as `bun run devops automate <action>`.
- **2.4** Update stale references in `devops-generators`, `devops-roadmap`, `vivim-runtime`.
- **2.5** Add `description` fields to all 5 skills missing them; create `docs/SKILLS.md` index.

## Status
All units implemented. Typecheck passes. Seeds load without crashes. Automation commands working.
