# Phase 2: Feature Porting — Tasks

**Spec:** `02-phase2-feature-porting.md`
**Plan:** `02-plan.md`
**Depends On:** Phase 1 tasks complete

---

## Setup

- [ ] T2.01 Verify Phase 1 complete — `cd frontend && bun run typecheck` passes
- [ ] T2.02 Create `frontend/src/components/chat/` directory
- [ ] T2.03 Create `frontend/src/actions/` directory
- [ ] T2.04 Create `frontend/src/sdk/web/` directory
- [ ] T2.05 Create `frontend/src/api/` directory
- [ ] T2.06 Create `frontend/src/types/` directory
- [ ] T2.07 Create `frontend/src/features/` directory

---

## Phase 2: Chat Components (16 files)

- [ ] T2.08 [P] Copy `web/ui/src/components/chat/Composer.tsx` → `frontend/src/components/chat/`
- [ ] T2.09 [P] Copy `web/ui/src/components/chat/MessageBlock.tsx` → `frontend/src/components/chat/`
- [ ] T2.10 [P] Copy `web/ui/src/components/chat/CapabilityCatalog.tsx` → `frontend/src/components/chat/`
- [ ] T2.11 [P] Copy `web/ui/src/components/chat/ConversationList.tsx` → `frontend/src/components/chat/`
- [ ] T2.12 [P] Copy `web/ui/src/components/chat/ChatHeader.tsx` → `frontend/src/components/chat/`
- [ ] T2.13 [P] Copy `web/ui/src/components/chat/ChatSidebar.tsx` → `frontend/src/components/chat/`
- [ ] T2.14 [P] Copy `web/ui/src/components/chat/SurfaceTabs.tsx` → `frontend/src/components/chat/`
- [ ] T2.15 [P] Copy `web/ui/src/components/chat/SurfaceContent.tsx` → `frontend/src/components/chat/`
- [ ] T2.16 [P] Copy `web/ui/src/components/chat/DevConsole.tsx` → `frontend/src/components/chat/`
- [ ] T2.17 [P] Copy `web/ui/src/components/chat/HealthDashboard.tsx` → `frontend/src/components/chat/`
- [ ] T2.18 [P] Copy `web/ui/src/components/chat/HealthIndicator.tsx` → `frontend/src/components/chat/`
- [ ] T2.19 [P] Copy `web/ui/src/components/chat/LatencyBreakdown.tsx` → `frontend/src/components/chat/`
- [ ] T2.20 [P] Copy `web/ui/src/components/chat/ProviderManager.tsx` → `frontend/src/components/chat/`
- [ ] T2.21 [P] Copy `web/ui/src/components/chat/WorkspaceSettings.tsx` → `frontend/src/components/chat/`
- [ ] T2.22 [P] Copy `web/ui/src/components/chat/ChatSlotSurface.tsx` → `frontend/src/components/chat/`
- [ ] T2.23 [P] Copy `web/ui/src/components/chat/ChatSurface.tsx` → `frontend/src/components/chat/`
- [ ] T2.24 Create `frontend/src/components/chat/index.ts` — barrel export for all 16 components

---

## Phase 2: Actions System (3 files)

- [ ] T2.25 [P] Copy `web/ui/src/actions/registry.ts` → `frontend/src/actions/`
- [ ] T2.26 [P] Copy `web/ui/src/actions/agent-bridge.ts` → `frontend/src/actions/`
- [ ] T2.27 [P] Copy `web/ui/src/actions/auto-populate.ts` → `frontend/src/actions/`
- [ ] T2.28 Create `frontend/src/actions/index.ts` — barrel export

---

## Phase 2: SDK Layer (10 files)

- [ ] T2.29 [P] Copy `web/ui/src/sdk/backend-client.ts` → `frontend/src/sdk/`
- [ ] T2.30 [P] Copy `web/ui/src/sdk/web/index.ts` → `frontend/src/sdk/web/`
- [ ] T2.31 [P] Copy `web/ui/src/sdk/web/use-capability.ts` → `frontend/src/sdk/web/`
- [ ] T2.32 [P] Copy `web/ui/src/sdk/web/use-conversation.ts` → `frontend/src/sdk/web/`
- [ ] T2.33 [P] Copy `web/ui/src/sdk/web/use-health.ts` → `frontend/src/sdk/web/`
- [ ] T2.34 [P] Copy `web/ui/src/sdk/web/use-interpret.ts` → `frontend/src/sdk/web/`
- [ ] T2.35 [P] Copy `web/ui/src/sdk/web/use-provider.ts` → `frontend/src/sdk/web/`
- [ ] T2.36 [P] Copy `web/ui/src/sdk/web/use-session.ts` → `frontend/src/sdk/web/`

---

## Phase 2: API & Types (2 files)

- [ ] T2.37 [P] Copy `web/ui/src/api/client.ts` → `frontend/src/api/`
- [ ] T2.38 [P] Copy `web/ui/src/types/api.ts` → `frontend/src/types/`

---

## Phase 2: UI Defaults & Registry (5 files)

- [ ] T2.39 [P] Copy `web/ui/src/ui/defaults/index.tsx` → `frontend/src/ui/defaults/`
- [ ] T2.40 [P] Copy `web/ui/src/ui/defaults/register.ts` → `frontend/src/ui/defaults/`
- [ ] T2.41 [P] Copy `web/ui/src/ui/registry.ts` → `frontend/src/ui/`
- [ ] T2.42 [P] Copy `web/ui/src/ui/slots.ts` → `frontend/src/ui/`
- [ ] T2.43 [P] Copy `web/ui/src/ui/context.tsx` → `frontend/src/ui/`

---

## Phase 2: Features (2 files)

- [ ] T2.44 [P] Copy `web/ui/src/features/onboarding/onboarding-wizard.tsx` → `frontend/src/features/onboarding/`
- [ ] T2.45 [P] Copy `web/ui/src/features/provider-setup-wizard.tsx` → `frontend/src/features/`

---

## Phase 2: Page Integration

- [ ] T2.46 Update `frontend/src/app/page.tsx` — add health/capabilities/memory surfaces to SURFACES array
- [ ] T2.47 Update `frontend/src/app/page.tsx` — import chat components (Composer, MessageBlock, etc.)
- [ ] T2.48 Verify all `@/` imports resolve correctly

---

## Phase 2: Verification

- [ ] T2.49 Run `cd frontend && bun run typecheck` — expect zero errors
- [ ] T2.50 Run `cd frontend && bun run build` — expect build success
- [ ] T2.51 Verify `frontend/src/components/chat/` has 16 files
- [ ] T2.52 Verify `frontend/src/actions/` has 3 files
- [ ] T2.53 Verify `frontend/src/sdk/web/` has 8 files
- [ ] T2.54 Verify `frontend/src/sdk/backend-client.ts` exists
- [ ] T2.55 Verify `frontend/src/api/client.ts` exists
- [ ] T2.56 Verify `frontend/src/types/api.ts` exists
- [ ] T2.57 Verify `frontend/src/ui/` has defaults/registry/slots/context
- [ ] T2.58 Verify `frontend/src/features/` has onboarding + provider-setup

---

## Phase 2: Gate Check

- [ ] T2.59 Run `bun run typecheck` in project root — verify no regressions
- [ ] T2.60 Git commit: `feat(frontend): feature porting — chat surface, actions, SDK, UI registry`

---

**Total tasks: 60**
**Parallelizable: T2.08-T2.45 (38 tasks)**
**Estimated time: 4-6 hours**
