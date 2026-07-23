# Phase 3: Wiring, Cleanup & Cutover — Plan

**Feature:** frontend-wiring-cleanup
**Spec:** `frontend/docs/03-phase3-wiring-cleanup.md`
**Plan:** `frontend/docs/03-plan.md`
**Depends On:** Phase 1 + Phase 2 complete

---

## Technical Context

- **Languages:** PowerShell (scripts), TypeScript (devops), JSON (configs)
- **Scope:** Project-wide config migration, not code changes
- **Risk:** Medium — affects all entry points

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Governor Canon | ✅ No CDP changes | |
| Store Contracts | ✅ No DB changes | |
| One Entry Point | ✅ Scripts still route to single frontend | |
| Research-First | ✅ All references identified | |
| Phase Gates | ✅ Phase 1+2 verified | |

---

## Phase 0: Research

### R:001 — PowerShell script analysis
- **Decision:** Update `start-frontend.ps1` and `start-all.ps1` to use `frontend/`
- **Rationale:** These are the primary entry points for the dev loop
- **Alternatives:** Keep `web/ui/` (defeats purpose)

### R:002 — Tauri config
- **Decision:** Update `frontendDist` path
- **Rationale:** Tauri builds from this path
- **Alternatives:** None

### R:003 — DevOps references
- **Decision:** Update all devops scripts that reference `web/ui/`
- **Rationale:** DevOps scripts drive the autonomous loop
- **Alternatives:** None

### R:004 — ML layer deferral
- **Decision:** DEFER ML port to Phase 3 optional tasks
- **Rationale:** Not critical for core convergence
- **Alternatives:** Port now (adds risk)

### R:005 — Test infrastructure
- **Decision:** Port vitest config + test files from `web/ui/`
- **Rationale:** Tests validate correctness
- **Alternatives:** Skip (risky)

---

## Phase 1: Data Model

No data model changes.

---

## Phase 1: Contracts

### C:001 — Script contract
- `scripts/start-frontend.ps1` must launch `frontend/` on port 3000
- `scripts/start-all.ps1` must launch both backend and `frontend/`
- `scripts/health-check.ps1` must check `frontend/` health

### C:002 — Tauri contract
- `src-tauri/tauri.conf.json` must point to `frontend/dist`

### C:003 — DevOps contract
- All devops scripts must resolve `frontend/` paths correctly
- Invariants must check `frontend/src/actions/*`

---

## Phase 1: Quickstart

1. Update `scripts/start-frontend.ps1`
2. Update `scripts/start-all.ps1`
3. Update `scripts/health-check.ps1`
4. Update `scripts/gen-canvas-source.ps1`
5. Update `src-tauri/tauri.conf.json`
6. Update `devops/runtime-test/build-frontend.ts`
7. Update `devops/runtime-test/supervisor.ts`
8. Update `devops/invariants.ts`
9. Update `devops/agentic/decomposer.ts`
10. Update `devops/audit-code/checks/architecture.ts`
11. Update `devops/audit-arch/passes/commands.ts`
12. Update `docs/user-stories-moments/moments.json`
13. Update `docs/research/evidence/infinite-canvas-hot-swap/sources.json`
14. Port ML layer (optional)
15. Port auth component (optional)
16. Port memory component (optional)
17. Port test infrastructure
18. Final typecheck + build
19. Cleanup old directories
20. Final integration test
