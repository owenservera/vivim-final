# Phase 1: Core Convergence — Tasks

**Spec:** `01-phase1-core-convergence.md`
**Plan:** `01-plan.md`

---

## Setup

- [ ] T1.01 Verify `frontend/` directory exists and has `src/`, `package.json`, `tsconfig.json`
- [ ] T1.02 Verify `web/ui/` directory exists and has `src/`, `package.json`

---

## Phase 1: Shared Layer Convergence

- [ ] T1.03 [P] Copy `web/ui/src/shared/api-config.ts` → `frontend/src/shared/api-config.ts`
- [ ] T1.04 [P] Compare `web/ui/src/shared/index.ts` with `frontend/src/shared/index.ts` — add missing exports
- [ ] T1.05 [P] Verify `import { getApiUrl } from '@/shared/api-config'` resolves in `frontend/`

---

## Phase 1: Canvas Component Convergence

- [ ] T1.06 [P] Copy `web/ui/src/components/canvas/CapabilityBar.tsx` → `frontend/src/components/canvas/`
- [ ] T1.07 [P] Copy `web/ui/src/components/canvas/ErrorBoundary.tsx` → `frontend/src/components/canvas/`
- [ ] T1.08 [P] Copy `web/ui/src/components/canvas/MinimapNode.tsx` → `frontend/src/components/canvas/`
- [ ] T1.09 [P] Copy `web/ui/src/components/canvas/RelatedNodes.tsx` → `frontend/src/components/canvas/`
- [ ] T1.10 [P] Copy `web/ui/src/components/canvas/StreamingIndicator.tsx` → `frontend/src/components/canvas/`
- [ ] T1.11 Update `frontend/src/components/canvas/index.ts` — add exports for 5 new components

---

## Phase 1: Config Wiring

- [ ] T1.12 Update root `package.json` — change `"web:build"` to `"frontend:build"`, add `frontend:dev`, `frontend:typecheck`
- [ ] T1.13 Update `frontend/package.json` — change `"name"` to `"vivim-frontend"`

---

## Phase 1: Verification

- [ ] T1.14 Run `cd frontend && bun run typecheck` — expect zero errors
- [ ] T1.15 Run `cd frontend && bun run build` — expect build success
- [ ] T1.16 Verify all 40 canvas components in `frontend/src/components/canvas/` (36 original + 5 copied - 1 skip = 40)
- [ ] T1.17 Verify `frontend/src/shared/` has 35 files (34 original + 1 api-config)

---

## Phase 1: Gate Check

- [ ] T1.18 Run `bun run typecheck` in project root — verify no regressions
- [ ] T1.19 Git commit: `feat(frontend): core convergence — shared types + canvas components`

---

**Total tasks: 19**
**Parallelizable: T1.03-T1.10 (8 tasks)**
**Estimated time: 1-2 hours**
