# Phase 3: Wiring, Cleanup & Cutover — Tasks

**Spec:** `03-phase3-wiring-cleanup.md`
**Plan:** `03-plan.md`
**Depends On:** Phase 1 + Phase 2 tasks complete

---

## Setup

- [ ] T3.01 Verify Phase 1+2 complete — `cd frontend && bun run typecheck` passes
- [ ] T3.02 Verify Phase 1+2 complete — `cd frontend && bun run build` passes

---

## Phase 3: PowerShell Scripts

- [ ] T3.03 Update `scripts/start-frontend.ps1` — change `web\ui` → `frontend` (line 13)
- [ ] T3.04 Update `scripts/start-all.ps1` — change all `web\ui` → `frontend` (~12 references)
- [ ] T3.05 Verify `scripts/health-check.ps1` — Test-FrontendHealth works with new path
- [ ] T3.06 Update `scripts/gen-canvas-source.ps1` — change all `web/ui/src` → `frontend/src` references

---

## Phase 3: Tauri Config

- [ ] T3.07 Update `src-tauri/tauri.conf.json` — change `"frontendDist": "../web/ui/dist"` → `"../frontend/dist"`

---

## Phase 3: DevOps References

- [ ] T3.08 Update `devops/runtime-test/build-frontend.ts` — change `UI_ROOT = 'web/ui'` → `'frontend'`
- [ ] T3.09 Update `devops/runtime-test/build-frontend.ts` — update template file paths
- [ ] T3.10 Update `devops/runtime-test/supervisor.ts` — change `'web/ui'` → `'frontend'`
- [ ] T3.11 Update `devops/invariants.ts` — change `web/ui/src/actions/*` → `frontend/src/actions/*`
- [ ] T3.12 Update `devops/agentic/decomposer.ts` — change all `web/ui/src/*` → `frontend/src/*` (~20 references)
- [ ] T3.13 Update `devops/audit-code/checks/architecture.ts` — change `web/ui/src/actions/registry.ts` → `frontend/src/actions/registry.ts`
- [ ] T3.14 Update `devops/audit-arch/passes/commands.ts` — change `web/ui/src/actions/` → `frontend/src/actions/`

---

## Phase 3: Documentation References

- [ ] T3.15 Update `docs/user-stories-moments/moments.json` — change `web/ui/src/features/provider-setup-wizard.tsx` → `frontend/src/features/provider-setup-wizard.tsx`
- [ ] T3.16 Update `docs/research/evidence/infinite-canvas-hot-swap/sources.json` — change `web/ui/src/ui/*` → `frontend/src/ui/*`

---

## Phase 3: Optional Porting

- [ ] T3.17 [P] Port ML layer — copy `web/ui/src/ml/*` → `frontend/src/ml/` (7 files)
- [ ] T3.18 [P] Port auth — copy `web/ui/src/components/auth/LoginPanel.tsx` → `frontend/src/components/auth/`
- [ ] T3.19 [P] Port memory — copy `web/ui/src/components/memory/MemoryBrowser.tsx` → `frontend/src/components/memory/`

---

## Phase 3: Test Infrastructure

- [ ] T3.20 [P] Copy `web/ui/vitest.config.ts` → `frontend/vitest.config.ts`
- [ ] T3.21 [P] Copy `web/ui/tests/unit/*` → `frontend/tests/unit/`
- [ ] T3.22 [P] Copy `web/ui/src/__tests__/*` → `frontend/src/__tests__/`
- [ ] T3.23 Verify `bun test` passes in `frontend/`

---

## Phase 3: Final Verification

- [ ] T3.24 Run `cd frontend && bun run typecheck` — expect zero errors
- [ ] T3.25 Run `cd frontend && bun run build` — expect build success
- [ ] T3.26 Run `bun run typecheck` in project root — verify no regressions
- [ ] T3.27 Run `pwsh scripts/start-all.ps1` — verify both services start
- [ ] T3.28 Run `bun run devops invariants check` — verify invariants pass

---

## Phase 3: Cleanup

- [ ] T3.29 Archive `web/ui/` → `.archive/web-ui-backup/` (don't delete yet)
- [ ] T3.30 Delete `web/ui-backup/` (stale Vite backup)
- [ ] T3.31 Update `.gitignore` if needed
- [ ] T3.32 Git commit: `feat(frontend): wiring, cleanup & cutover — all references migrated`

---

## Phase 3: Gate Check

- [ ] T3.33 Final `bun run typecheck` in project root
- [ ] T3.34 Final `bun run build` in `frontend/`
- [ ] T3.35 Final `pwsh scripts/start-all.ps1` integration test
- [ ] T3.36 Git tag: `frontend-v1.0.0`

---

**Total tasks: 36**
**Parallelizable: T3.17-T3.22 (6 tasks)**
**Estimated time: 3-4 hours**
