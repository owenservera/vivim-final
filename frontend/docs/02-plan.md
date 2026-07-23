# Phase 2: Feature Porting — Plan

**Feature:** frontend-feature-porting
**Spec:** `frontend/docs/02-phase2-feature-porting.md`
**Plan:** `frontend/docs/02-plan.md`
**Depends On:** Phase 1 complete (core convergence)

---

## Technical Context

- **Language:** TypeScript (strict, ESNext)
- **Framework:** Next.js 16, React 19, Tailwind v4
- **Runtime:** Bun
- **Key Dependencies:** framer-motion, react-markdown, react-syntax-highlighter, recharts, zustand, @tanstack/react-query

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| Governor Canon | ✅ N/A | No CDP changes |
| Store Contracts | ✅ N/A | No DB changes |
| One Entry Point | ✅ N/A | Chat components use existing capability system |
| Research-First | ✅ Assessment done | |
| Phase Gates | ✅ Phase 1 verified | |

---

## Phase 0: Research

### R:001 — Chat component import analysis
- **Decision:** All 16 chat components use `@/` aliases — no import rewrites needed
- **Rationale:** `web/ui/` and `frontend/` share same tsconfig path alias
- **Alternatives:** None — this is the safe path

### R:002 — Actions system dependencies
- **Decision:** Copy all 3 action files. They depend on `@/shared/*` and `@/sdk/backend-client` — both will exist after porting.
- **Rationale:** Actions are referenced in `devops/invariants.ts` — required for governance
- **Alternatives:** Skip (would break invariants)

### R:003 — SDK web hooks dependencies
- **Decision:** Copy all 8 SDK web hook files. They depend on `@/sdk/backend-client` — will exist after porting.
- **Rationale:** Chat components use these hooks
- **Alternatives:** None

### R:004 — Backend client dependencies
- **Decision:** Copy `backend-client.ts`. It's the typed API client used by all chat components.
- **Rationale:** Critical path — chat components cannot function without it
- **Alternatives:** None

### R:005 — ML layer deferral
- **Decision:** DEFER ML layer (7 files) to Phase 3 or later
- **Rationale:** ML is optional for initial convergence. Chat surface is critical. ML has heavy deps (LiteRT).
- **Alternatives:** Port now (adds risk, delays critical path)

### R:006 — Auth/memory deferral
- **Decision:** DEFER auth (LoginPanel) and memory (MemoryBrowser) to Phase 3
- **Rationale:** Nice-to-have, not critical for core convergence
- **Alternatives:** Port now (adds risk)

---

## Phase 1: Data Model

No data model changes. All files are TypeScript source copies.

---

## Phase 1: Contracts

### C:001 — Chat component contract
- All 16 chat components must import correctly from `@/components/chat`
- Barrel export must exist
- No circular dependencies

### C:002 — Actions contract
- `actions/registry.ts` must export `ActionRegistry`
- `actions/agent-bridge.ts` must export `AgentBridge`
- `actions/auto-populate.ts` must export `autoPopulate`

### C:003 — SDK contract
- `sdk/backend-client.ts` must export `executeCapability`
- `sdk/web/index.ts` must export all 7 hooks
- `api/client.ts` must export API client utilities
- `types/api.ts` must export API types

---

## Phase 1: Quickstart

1. Create `frontend/src/components/chat/` directory
2. Copy all 16 chat components
3. Create barrel export
4. Copy actions system (3 files)
5. Copy SDK web hooks (8 files)
6. Copy backend client (1 file)
7. Copy API client (1 file)
8. Copy API types (1 file)
9. Port UI defaults/registry
10. Create features directory, copy onboarding files
11. Update `frontend/src/app/page.tsx` to import chat components
12. Run typecheck + build
