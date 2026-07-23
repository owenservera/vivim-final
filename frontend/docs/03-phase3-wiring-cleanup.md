# Phase 3: Wiring, Cleanup & Cutover

**Date:** 2026-07-22
**Status:** Baseline — pre-implementation
**Risk Level:** MEDIUM
**Estimated Duration:** 3-4 hours
**Depends On:** Phase 1 + Phase 2 complete

---

## Objective

Migrate all project-level references from `web/ui/` to `frontend/`, update Tauri config, port test infrastructure, and clean up the old directory.

---

## Scope

### 1. PowerShell Scripts (61+ references)

#### `scripts/start-frontend.ps1`
**Current:** `$frontendDir = Join-Path $projectRoot "web\ui"`
**Change to:** `$frontendDir = Join-Path $projectRoot "frontend"`

**Files to update:**
- `scripts/start-frontend.ps1` — ~8 references
- `scripts/start-all.ps1` — ~12 references

**Specific changes in `start-frontend.ps1`:**
```powershell
# Line 13: Change
$frontendDir = Join-Path $projectRoot "web\ui"
# To
$frontendDir = Join-Path $projectRoot "frontend"
```

**Specific changes in `start-all.ps1`:**
```powershell
# Line 110: Change
$frontendDir = Join-Path $projectRoot "web\ui"
# To
$frontendDir = Join-Path $projectRoot "frontend"
```

**Also update port references if needed:**
- `start-all.ps1` line 136: `$frontendPort = 3000  # Next.js dev server` — verify this matches `frontend/package.json` dev port

#### `scripts/health-check.ps1`
- Verify `Test-FrontendHealth` function works with new path

#### `scripts/stop-all.ps1`
- Verify `Stop-Service "frontend" 5173` still works (service name, not path)

---

### 2. Tauri Configuration

**File:** `src-tauri/tauri.conf.json`
**Current:** `"frontendDist": "../web/ui/dist"`
**Change to:** `"frontendDist": "../frontend/dist"`

---

### 3. DevOps References

#### `devops/runtime-test/build-frontend.ts`
**Current:** `const UI_ROOT = 'web/ui'`
**Change to:** `const UI_ROOT = 'frontend'`

**Also update:**
- Template file paths (line 71+)
- Any `web/ui/src` references

#### `devops/runtime-test/supervisor.ts`
**Current:** `['run', '--cwd', 'web/ui', 'vite', 'dev', ...]`
**Change to:** `['run', '--cwd', 'frontend', 'vite', 'dev', ...]`

#### `devops/invariants.ts`
**Current references:**
- `web/ui/src/actions/registry.ts`
- `web/ui/src/actions/agent-bridge.ts`

**Change to:**
- `frontend/src/actions/registry.ts`
- `frontend/src/actions/agent-bridge.ts`

#### `devops/agentic/decomposer.ts`
**Current:** 20+ references to `web/ui/src/*`
**Change to:** All references updated to `frontend/src/*`

#### `devops/audit-code/checks/architecture.ts`
**Current:** `web/ui/src/actions/registry.ts`
**Change to:** `frontend/src/actions/registry.ts`

#### `devops/audit-arch/passes/commands.ts`
**Current:** `web/ui/src/actions/`
**Change to:** `frontend/src/actions/`

#### `scripts/gen-canvas-source.ps1`
**Current:** `web/ui/src/index.ts`, `web/ui/src/actions/registry.ts`, etc.
**Change to:** All updated to `frontend/src/*`

---

### 4. Documentation References

#### `docs/user-stories-moments/moments.json`
**Current:** `web/ui/src/features/provider-setup-wizard.tsx`
**Change to:** `frontend/src/features/provider-setup-wizard.tsx`

#### `docs/research/evidence/infinite-canvas-hot-swap/sources.json`
**Current:** `web/ui/src/ui/registry.ts`, `web/ui/src/ui/slots.ts`
**Change to:** `frontend/src/ui/registry.ts`, `frontend/src/ui/slots.ts`

---

### 5. ML Layer (Optional Port)

**Decision:** Port if Phase 2 chat components are stable.

**Files:**
- `web/ui/src/ml/*` (7 files) → `frontend/src/ml/`

**Action:** Create `frontend/src/ml/`, copy all files, verify imports.

---

### 6. Auth (Optional Port)

**File:** `web/ui/src/components/auth/LoginPanel.tsx`

**Action:** Copy to `frontend/src/components/auth/LoginPanel.tsx`. Create barrel.

---

### 7. Memory (Optional Port)

**File:** `web/ui/src/components/memory/MemoryBrowser.tsx`

**Action:** Copy to `frontend/src/components/memory/MemoryBrowser.tsx`. Create barrel.

---

### 8. Test Infrastructure

**Current state:**
- `web/ui/tests/unit/` — vitest + RTL tests
- `frontend/tests/` — bun test, route-sync focused

**Action:** Port test files from `web/ui/tests/` to `frontend/tests/`. Update vitest config.

**Files to port:**
- `web/ui/vitest.config.ts` → `frontend/vitest.config.ts`
- `web/ui/tests/unit/*` → `frontend/tests/unit/`
- `web/ui/src/__tests__/*` → `frontend/src/__tests__/`

**Verify:** `bun test` passes in `frontend/`.

---

### 9. Cleanup

**After all phases verified:**
1. Delete `web/ui/` directory (or move to `.archive/web-ui-backup/`)
2. Delete `web/ui-backup/` directory (Vite-era backup, stale)
3. Update `.gitignore` if needed
4. Final `bun run typecheck` + `bun run build` in `frontend/`
5. Final `bun run typecheck` + `bun run build` in root

---

## Task List

### T3.1 — Update start-frontend.ps1
- **File:** `scripts/start-frontend.ps1`
- **Action:** Change `web\ui` → `frontend` (1 line)
- **Verify:** `pwsh scripts/start-frontend.ps1` launches frontend

### T3.2 — Update start-all.ps1
- **File:** `scripts/start-all.ps1`
- **Action:** Change all `web\ui` → `frontend` (~12 references)
- **Verify:** `pwsh scripts/start-all.ps1` launches both

### T3.3 — Update health-check.ps1
- **File:** `scripts/health-check.ps1`
- **Action:** Verify Test-FrontendHealth works with new path
- **Verify:** Health check passes

### T3.4 — Update gen-canvas-source.ps1
- **File:** `scripts/gen-canvas-source.ps1`
- **Action:** Update all `web/ui/src` → `frontend/src` references
- **Verify:** Script runs without path errors

### T3.5 — Update Tauri config
- **File:** `src-tauri/tauri.conf.json`
- **Action:** Change `frontendDist: "../web/ui/dist"` → `"../frontend/dist"`
- **Verify:** `bun run tauri build` (if applicable)

### T3.6 — Update devops/runtime-test/build-frontend.ts
- **File:** `devops/runtime-test/build-frontend.ts`
- **Action:** Change `UI_ROOT = 'web/ui'` → `'frontend'`
- **Verify:** `bun run devops runtime-test build-frontend` works

### T3.7 — Update devops/runtime-test/supervisor.ts
- **File:** `devops/runtime-test/supervisor.ts`
- **Action:** Change `'web/ui'` → `'frontend'`
- **Verify:** Supervisor starts frontend

### T3.8 — Update devops/invariants.ts
- **File:** `devops/invariants.ts`
- **Action:** Update 2 references to `web/ui/src/actions/*`
- **Verify:** `bun run devops invariants check` passes

### T3.9 — Update devops/agentic/decomposer.ts
- **File:** `devops/agentic/decomposer.ts`
- **Action:** Update all 20+ references to `web/ui/src/*`
- **Verify:** Decomposer resolves all file paths

### T3.10 — Update audit checks
- **Files:**
  - `devops/audit-code/checks/architecture.ts`
  - `devops/audit-arch/passes/commands.ts`
- **Action:** Update `web/ui/src/actions/` → `frontend/src/actions/`
- **Verify:** Audit passes

### T3.11 — Update docs references
- **Files:**
  - `docs/user-stories-moments/moments.json`
  - `docs/research/evidence/infinite-canvas-hot-swap/sources.json`
- **Action:** Update paths
- **Verify:** No broken references

### T3.12 — Port ML layer (optional)
- **Source:** `web/ui/src/ml/*`
- **Target:** `frontend/src/ml/`
- **Verify:** `bun run typecheck` passes

### T3.13 — Port auth component (optional)
- **Source:** `web/ui/src/components/auth/LoginPanel.tsx`
- **Target:** `frontend/src/components/auth/`
- **Verify:** Component renders

### T3.14 — Port memory component (optional)
- **Source:** `web/ui/src/components/memory/MemoryBrowser.tsx`
- **Target:** `frontend/src/components/memory/`
- **Verify:** Component renders

### T3.15 — Port test infrastructure
- **Source:** `web/ui/vitest.config.ts`, `web/ui/tests/unit/*`, `web/ui/src/__tests__/*`
- **Target:** `frontend/`
- **Verify:** `bun test` passes

### T3.16 — Final typecheck
- **Action:** `cd frontend && bun run typecheck`
- **Verify:** Zero errors

### T3.17 — Final build
- **Action:** `cd frontend && bun run build`
- **Verify:** Build succeeds

### T3.18 — Root typecheck
- **Action:** `bun run typecheck` in project root
- **Verify:** Zero errors (or only pre-existing errors)

### T3.19 — Cleanup old directories
- **Action:** Delete or archive `web/ui/`, `web/ui-backup/`
- **Verify:** No broken imports in project

### T3.20 — Final integration test
- **Action:** `pwsh scripts/start-all.ps1`
- **Verify:** Both backend and frontend start successfully

---

## Verification Checklist

- [ ] All PS1 scripts reference `frontend/` not `web/ui/`
- [ ] Tauri config points to `frontend/dist`
- [ ] All devops references updated
- [ ] All doc references updated
- [ ] ML layer ported (optional)
- [ ] Auth ported (optional)
- [ ] Memory ported (optional)
- [ ] Tests ported
- [ ] `cd frontend && bun run typecheck` passes
- [ ] `cd frontend && bun run build` passes
- [ ] `pwsh scripts/start-all.ps1` works
- [ ] Old `web/ui/` deleted/archived

---

## Risk Mitigation

1. **Keep `web/ui/` archived** — Don't delete immediately. Move to `.archive/web-ui-backup/` for 30 days.
2. **Staged rollout** — Update scripts one at a time, test each.
3. **Git commits between phases** — Each phase gets its own commit for easy rollback.
4. **No DB changes** — All changes are file copies and config edits.

---

## Rollback

If Phase 3 fails:
1. Revert git commits for Phase 3
2. Restore `web/ui/` from `.archive/`
3. Revert all script changes
4. `web/ui/` remains functional throughout

The system is never in a broken state because `web/ui/` is preserved until the very last step.
