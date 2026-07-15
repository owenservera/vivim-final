# Changelog — atomic-v17

## 2026-07-14 — v17.0.0 (Devops Toolkit Hardening)
- **PRD** (`docs/atomic-v17/PRD.md`): consolidated 6 toolkit gaps from STEP-1 scenario analysis.
- **1.1** Static capability catalog (`cap-catalog.ts`) + `discover --offline` (no server needed).
- **1.2** Non-interactive `migrate --name=<x>` wrapper with hard spawn timeout (kills stdin hang).
- **1.3** `build backend --cap=<slug>` capability codegen (exact `makeCapability` shape).
- **1.4** `ensure-browser` precheck + `watchdog` agent-death reaper + in-process `process-guard`
  (the "hook that intercepts context just in case" — always reaps servers on interrupt/exit).
- **1.5** Goal-resolution gate in `loop` (vague goal → `needsClarification`, halt, no spin).
- **1.6** `guard` command + lefthook pre-commit (blocks commit while servers run / migration
  pending) and pre-push `audit-code standard`.
- **1.7** `devops-fullstack` SKILL.md reconciled + documents all v17 tooling.
- **1.8** Validation procedure (typecheck + offline command tests).
- **1.9** Iterative ledger-driven loop: `loop --objective` / `--resume` / `--reset` with persisted
  `.runtime/loop-state.json` so a flexible LLM stays on-task and shows progress across cycles +
  interruptions; reaping hardened (supervisor writes `.runtime/*.pid`, `stop-all.ps1` tree-kills +
  command-line sweep for detached orphans).

## Status
All units implemented and validated offline. The `:9420` orphan leak (supervisor detached backend
surviving an interrupt) is fixed: pid-file + tree-kill + sweep.
