# Phase 1: Core Convergence

**Date:** 2026-07-22
**Status:** Baseline — pre-implementation
**Risk Level:** LOW
**Estimated Duration:** 2-3 hours

---

## Objective

Converge the identical/near-identical layers between `frontend/` and `web/ui/` so that `frontend/` becomes the canonical frontend root. Zero functional regression. Zero behavioral change.

---

## Scope

### What Gets Merged (Identical — Copy Verbatim)

| Source (`web/ui/`) | Target (`frontend/`) | File Count | Action |
|---|---|---|---|
| `components/ui/*` | `components/ui/*` | 48 | Skip (already identical) |
| `shared/index.ts` | `shared/index.ts` | 1 | Reconcile barrel exports |
| `shared/agent-canvas.ts` | `shared/agent-canvas.ts` | 1 | Skip (identical) |
| `shared/agent.ts` | `shared/agent.ts` | 1 | Skip (identical) |
| `shared/audit.ts` | `shared/audit.ts` | 1 | Skip (identical) |
| `shared/automation.ts` | `shared/automation.ts` | 1 | Skip (identical) |
| `shared/canvas-types.ts` | `shared/canvas-types.ts` | 1 | Skip (identical) |
| `shared/conceptual-model.ts` | `shared/conceptual-model.ts` | 1 | Skip (identical) |
| `shared/connection-line.ts` | `shared/connection-line.ts` | 1 | Skip (identical) |
| `shared/document-types.ts` | `shared/document-types.ts` | 1 | Skip (identical) |
| `shared/document.ts` | `shared/document.ts` | 1 | Skip (identical) |
| `shared/drawer.ts` | `shared/drawer.ts` | 1 | Skip (identical) |
| `shared/layout-intent.ts` | `shared/layout-intent.ts` | 1 | Skip (identical) |
| `shared/media.ts` | `shared/media.ts` | 1 | Skip (identical) |
| `shared/notification.ts` | `shared/notification.ts` | 1 | Skip (identical) |
| `shared/observability.ts` | `shared/observability.ts` | 1 | Skip (identical) |
| `shared/onboarding.ts` | `shared/onboarding.ts` | 1 | Skip (identical) |
| `shared/presence.ts` | `shared/presence.ts` | 1 | Skip (identical) |
| `shared/rbac.ts` | `shared/rbac.ts` | 1 | Skip (identical) |
| `shared/route-context.ts` | `shared/route-context.ts` | 1 | Skip (identical) |
| `shared/search.ts` | `shared/search.ts` | 1 | Skip (identical) |
| `shared/shell-command.ts` | `shared/shell-command.ts` | 1 | Skip (identical) |
| `shared/stream-blocks.ts` | `shared/stream-blocks.ts` | 1 | Skip (identical) |
| `shared/streaming.ts` | `shared/streaming.ts` | 1 | Skip (identical) |
| `shared/template.ts` | `shared/template.ts` | 1 | Skip (identical) |
| `shared/theme.ts` | `shared/theme.ts` | 1 | Skip (identical) |
| `shared/ui-component.ts` | `shared/ui-component.ts` | 1 | Skip (identical) |
| `shared/ui-language.ts` | `shared/ui-language.ts` | 1 | Skip (identical) |
| `shared/unified-io.ts` | `shared/unified-io.ts` | 1 | Skip (identical) |
| `shared/universal-registry.ts` | `shared/universal-registry.ts` | 1 | Skip (identical) |
| `shared/vcard.ts` | `shared/vcard.ts` | 1 | Skip (identical) |
| `shared/workspace-route.ts` | `shared/workspace-route.ts` | 1 | Skip (identical) |
| `shared/workspace.ts` | `shared/workspace.ts` | 1 | Skip (identical) |
| `shared/z-layer.ts` | `shared/z-layer.ts` | 1 | Skip (identical) |
| `hooks/use-mobile.ts` | `hooks/use-mobile.ts` | 1 | Skip (identical) |
| `hooks/use-toast.ts` | `hooks/use-toast.ts` | 1 | Skip (identical) |
| `lib/ulid.ts` | `lib/ulid.ts` | 1 | Skip (identical) |
| `lib/utils.ts` | `lib/utils.ts` | 1 | Skip (identical) |

**Total: 37 files — all identical, skip entirely.**

---

### What Needs Reconciliation (Drifted)

#### 1. `shared/api-config.ts` — MISSING from `frontend/`

- **Action:** Copy `web/ui/src/shared/api-config.ts` → `frontend/src/shared/api-config.ts`
- **Risk:** Low — standalone config file, no internal imports to reconcile
- **Verify:** `import { getApiUrl } from '@/shared/api-config'` resolves in `frontend/`

#### 2. `shared/index.ts` — Barrel exports differ

- **Action:** Compare both barrel files. Add `api-config` export to `frontend/shared/index.ts` if `web/ui/` exports it.
- **Risk:** Low — barrel file, no runtime behavior

#### 3. `components/canvas/` — 36 vs 40 files

**Missing from `frontend/` (must copy from `web/ui/`):**

| File | Purpose | Risk |
|------|---------|------|
| `CapabilityBar.tsx` | Provider capability display bar | Low — self-contained |
| `ErrorBoundary.tsx` | React error boundary wrapper | Low — utility component |
| `MinimapNode.tsx` | Canvas minimap node renderer | Low — canvas extension |
| `RelatedNodes.tsx` | Node relationship display | Low — canvas extension |
| `StreamingIndicator.tsx` | Live streaming status indicator | Low — canvas extension |

**Extra in `frontend/` (keep):**

| File | Purpose | Action |
|------|---------|--------|
| `Icon.tsx` | SVG icon system (not in `web/ui/`) | Keep — `web/ui/` uses emoji instead |

**Action:** Copy 5 missing files. Keep `Icon.tsx`. No merge conflicts expected — these are additive.

#### 4. `sdk/canvas/` — 9 vs 11 files

**Missing from `frontend/` (must copy from `web/ui/`):**
- None — `web/ui/` has subset of `frontend/`

**Extra in `frontend/` (keep):**

| File | Purpose | Action |
|------|---------|--------|
| `hot-reload.ts` | Plugin hot-reload client | Keep — unique to frontend |
| `index.ts` | Barrel export | Keep — unique to frontend |

**Action:** No changes needed.

#### 5. `lib/` — 3 extra files in `frontend/`

**Extra in `frontend/` (keep):**

| File | Purpose | Action |
|------|---------|--------|
| `canvas-engine-bootstrap.ts` | Engine bootstrap logic | Keep |
| `seed-canvas-model.ts` | Canvas model seeder | Keep |
| `seed-canvas-model-phase2.ts` | Phase 2 seeder | Keep |

**Action:** No changes needed — these are additions, not conflicts.

---

### Config Wiring

#### 6. Update `package.json` root scripts

**Current:**
```json
"web:build": "bun run --cwd web/ui build"
```

**Change to:**
```json
"web:build": "bun run --cwd frontend build"
```

**Also add:**
```json
"frontend:dev": "bun run --cwd frontend dev",
"frontend:build": "bun run --cwd frontend build",
"frontend:typecheck": "bun run --cwd frontend typecheck"
```

#### 7. Update `frontend/package.json` name

**Current:** `"name": "nextjs_tailwind_shadcn_ts"`
**Change to:** `"name": "vivim-frontend"`

---

## Task List

### T1.1 — Copy missing shared file
- **File:** `web/ui/src/shared/api-config.ts` → `frontend/src/shared/api-config.ts`
- **Verify:** File exists and exports `getApiUrl`

### T1.2 — Update shared barrel
- **File:** `frontend/src/shared/index.ts`
- **Action:** Add `api-config` export if missing
- **Verify:** `import { getApiUrl } from '@/shared'` resolves

### T1.3 — Copy 5 missing canvas components
- **Files:**
  - `web/ui/src/components/canvas/CapabilityBar.tsx` → `frontend/src/components/canvas/`
  - `web/ui/src/components/canvas/ErrorBoundary.tsx` → `frontend/src/components/canvas/`
  - `web/ui/src/components/canvas/MinimapNode.tsx` → `frontend/src/components/canvas/`
  - `web/ui/src/components/canvas/RelatedNodes.tsx` → `frontend/src/components/canvas/`
  - `web/ui/src/components/canvas/StreamingIndicator.tsx` → `frontend/src/components/canvas/`
- **Verify:** All 5 files exist in target. `frontend/components/canvas/index.ts` exports them.

### T1.4 — Update canvas barrel exports
- **File:** `frontend/src/components/canvas/index.ts`
- **Action:** Add exports for the 5 new components
- **Verify:** Import works from `@/components/canvas`

### T1.5 — Update root package.json
- **File:** `package.json` (root)
- **Action:** Update `web:build` → `frontend:build`, add `frontend:dev`, `frontend:typecheck`
- **Verify:** `bun run frontend:build` works

### T1.6 — Update frontend package.json name
- **File:** `frontend/package.json`
- **Action:** `"name": "vivim-frontend"`
- **Verify:** `bun run typecheck` passes in `frontend/`

### T1.7 — Verify convergence
- **Action:** Run `bun run typecheck` in `frontend/`
- **Verify:** Zero errors from merged files

---

## Verification Checklist

- [ ] `frontend/src/shared/api-config.ts` exists and exports `getApiUrl`
- [ ] `frontend/src/shared/index.ts` exports `api-config`
- [ ] 5 canvas components copied to `frontend/src/components/canvas/`
- [ ] `frontend/src/components/canvas/index.ts` exports all 40 components
- [ ] Root `package.json` `web:build` → `frontend:build`
- [ ] `frontend/package.json` name = `vivim-frontend`
- [ ] `cd frontend && bun run typecheck` passes
- [ ] `cd frontend && bun run build` passes

---

## Rollback

All changes in Phase 1 are file copies and config edits. Rollback = delete copied files + revert config edits. No DB changes. No runtime behavior changes.
