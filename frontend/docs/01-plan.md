# Phase 1: Core Convergence — Plan

**Feature:** frontend-core-convergence
**Spec:** `frontend/docs/01-phase1-core-convergence.md`
**Constitution Check:** No violations. All changes are file copies and config edits. No engine changes. No DB changes. No CDP. No provider logic.

---

## Technical Context

- **Language:** TypeScript (strict, ESNext)
- **Framework:** Next.js 16, React 19, Tailwind v4
- **Runtime:** Bun
- **Package Manager:** bun (lockfile present)
- **Testing:** bun test + vitest
- **Linter:** Biome + ESLint

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Governor Canon | ✅ N/A | No CDP changes |
| Store Contracts | ✅ N/A | No storage changes |
| One Entry Point | ✅ N/A | No capability changes |
| Research-First | ✅ N/A | Assessment already done |
| Phase Gates | ✅ Phase 0 (this) before implementation | |
| Testing Gates | ✅ Will verify after each task | |

---

## Phase 0: Research

### R:001 — shared/api-config.ts contents
- **Decision:** Copy from `web/ui/src/shared/api-config.ts` → `frontend/src/shared/api-config.ts`
- **Rationale:** File is missing from `frontend/`. Used by `@/shared/api-config` imports in chat components.
- **Alternatives:** Skip (would break Phase 2 imports)

### R:002 — Canvas component drift analysis
- **Decision:** Copy 5 missing files, keep `Icon.tsx`
- **Rationale:** `web/ui/` has 40 canvas components, `frontend/` has 36. The 5 missing are additive. `Icon.tsx` is unique to `frontend/`.
- **Alternatives:** None — these are required for Phase 2 chat components

### R:003 — Root package.json script naming
- **Decision:** Replace `web:build` with `frontend:build`, add `frontend:dev` and `frontend:typecheck`
- **Rationale:** Standard naming convention. Backward-compatible alias possible.
- **Alternatives:** Keep `web:build` alias (confusing)

---

## Phase 1: Data Model

No data model changes. All files are TypeScript source copies.

---

## Phase 1: Contracts

### C:001 — Import resolution contract
- All imports use `@/` path alias
- `frontend/tsconfig.json` maps `@/*` to `./src/*`
- No changes needed — already configured

### C:002 — Barrel export contract
- `frontend/src/shared/index.ts` must export all shared types
- `frontend/src/components/canvas/index.ts` must export all 40 canvas components
- `frontend/src/components/chat/index.ts` must export all 16 chat components (Phase 2)

---

## Phase 1: Quickstart

1. Copy `api-config.ts` to `frontend/src/shared/`
2. Update `frontend/src/shared/index.ts` barrel
3. Copy 5 canvas components to `frontend/src/components/canvas/`
4. Update `frontend/src/components/canvas/index.ts` barrel
5. Update root `package.json` scripts
6. Update `frontend/package.json` name
7. Run `bun run typecheck` in `frontend/`
8. Run `bun run build` in `frontend/`
