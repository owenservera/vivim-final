# Phase 2: Feature Porting

**Date:** 2026-07-22
**Status:** Baseline — pre-implementation
**Risk Level:** MEDIUM
**Estimated Duration:** 4-6 hours
**Depends On:** Phase 1 (Core Convergence) complete

---

## Objective

Port the production chat surface, actions system, ML layer, auth, and memory from `web/ui/` into `frontend/`. After this phase, `frontend/` has feature parity with `web/ui/` as the active frontend.

---

## Scope

### 1. Chat Components (16 files) — HIGHEST PRIORITY

This is the crown jewel of `web/ui/`. These components form the production chat UX.

**Files to port (all from `web/ui/src/components/chat/`):**

| File | Purpose | Dependencies |
|------|---------|-------------|
| `Composer.tsx` | Message composer with streaming support | `@/sdk/backend-client`, `@/shared/streaming` |
| `MessageBlock.tsx` | Single message renderer (markdown, code blocks) | `react-markdown`, `react-syntax-highlighter` |
| `CapabilityCatalog.tsx` | Searchable capability grid (provider actions) | `@/sdk/backend-client`, `framer-motion` |
| `ConversationList.tsx` | Conversation sidebar with search/filter | `@/sdk/backend-client`, `@/shared/agent` |
| `ChatHeader.tsx` | Top bar (workspace, theme, palette trigger) | `@/components/canvas/*` |
| `ChatSidebar.tsx` | Left sidebar (providers, variant, workspace) | `@/components/canvas/WorkspaceSwitcher` |
| `SurfaceTabs.tsx` | Surface tab bar (chat/docs/media/etc) | `@/shared/route-context` |
| `SurfaceContent.tsx` | Surface router (renders active surface) | All surface components |
| `DevConsole.tsx` | WS event firehose + NL inject overlay | `ws://localhost:9420/ws` |
| `HealthDashboard.tsx` | Provider health cards (auto-refresh) | `@/sdk/backend-client` |
| `HealthIndicator.tsx` | Single provider health dot | `@/sdk/backend-client` |
| `LatencyBreakdown.tsx` | Latency bar chart (recharts) | `recharts` |
| `ProviderManager.tsx` | Account CRUD modal | `@/sdk/backend-client` |
| `WorkspaceSettings.tsx` | Fleet/chrome config modal | `@/sdk/backend-client` |
| `ChatSlotSurface.tsx` | Slot-based surface renderer | `@/ui/slots` |
| `ChatSurface.tsx` | Main chat surface container | `Composer`, `MessageBlock` |

**Porting strategy:**
1. Copy all 16 files to `frontend/src/components/chat/`
2. Fix imports — all should use `@/` aliases (already do in `web/ui/`)
3. Create `frontend/src/components/chat/index.ts` barrel
4. Verify no circular deps

### 2. Actions System (3 files)

**Files to port:**

| File | Purpose | Dependencies |
|------|---------|-------------|
| `actions/registry.ts` | ActionRegistry — agent-addressable UI | `@/shared/*` |
| `actions/agent-bridge.ts` | AgentBridge — agent command transport | `@/sdk/backend-client` |
| `actions/auto-populate.ts` | Auto-populate action on mount | `@/sdk/backend-client` |

**Porting strategy:**
1. Copy all 3 files to `frontend/src/actions/`
2. Create barrel if needed
3. Verify `devops/invariants.ts` references resolve

### 3. SDK Web Hooks (8 files)

**Files to port from `web/ui/src/sdk/web/`:**

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `use-capability.ts` | Capability execution hook |
| `use-conversation.ts` | Conversation state hook |
| `use-health.ts` | Provider health polling hook |
| `use-interpret.ts` | NL interpretation hook |
| `use-provider.ts` | Provider state hook |
| `use-session.ts` | Session management hook |

**Porting strategy:**
1. Copy all files to `frontend/src/sdk/web/`
2. Verify imports resolve

### 4. Backend Client (1 file)

**File:** `web/ui/src/sdk/backend-client.ts`

This is the typed API client used by chat components. Must port.

**Porting strategy:**
1. Copy to `frontend/src/sdk/backend-client.ts`
2. Verify no conflicts with existing `frontend/src/sdk/canvas/`

### 5. API Client (1 file)

**File:** `web/ui/src/api/client.ts`

Generic API client utility. Port it.

### 6. Types (1 file)

**File:** `web/ui/src/types/api.ts`

API type definitions. Port it.

### 7. UI Defaults & Registry

**Files:**

| File | Purpose |
|------|---------|
| `ui/defaults/index.tsx` | Default slot renderers |
| `ui/defaults/register.ts` | Default registration |
| `ui/registry.ts` | UI component registry |
| `ui/slots.ts` | Slot ID definitions |
| `ui/context.tsx` | UI context provider |

**Porting strategy:**
1. Compare with existing `frontend/src/ui/` (if any)
2. Merge or replace as needed

### 8. Feature: Onboarding

**Files:**

| File | Purpose |
|------|---------|
| `features/onboarding/onboarding-wizard.tsx` | Onboarding wizard component |
| `features/provider-setup-wizard.tsx` | Provider setup wizard |

**Porting strategy:**
1. Copy both files to `frontend/src/features/`
2. Create `frontend/src/features/` directory

### 9. ML Layer (7 files) — OPTIONAL / DEFER

**Files from `web/ui/src/ml/`:**

| File | Purpose |
|------|---------|
| `capabilities.ts` | ML capability definitions |
| `embed-runtime.ts` | Embedding runtime |
| `litertjs.d.ts` | LiteRT type declarations |
| `media-runtime.ts` | Media processing runtime |
| `ml-boot.ts` | ML bootstrap |
| `ml-store.ts` | ML state store |
| `prerouter.ts` | Pre-routing logic |

**Decision:** DEFER to future phase. ML is optional for initial convergence. Chat surface is critical.

### 10. Auth (1 file) — OPTIONAL / DEFER

**File:** `web/ui/src/components/auth/LoginPanel.tsx`

**Decision:** DEFER. Auth is provider-level, not critical for core convergence.

### 11. Memory (1 file) — OPTIONAL / DEFER

**File:** `web/ui/src/components/memory/MemoryBrowser.tsx`

**Decision:** DEFER. Memory browser is a nice-to-have, not critical.

---

## Task List

### T2.1 — Create chat directory
- **Action:** `mkdir -p frontend/src/components/chat`
- **Verify:** Directory exists

### T2.2 — Copy 16 chat components
- **Source:** `web/ui/src/components/chat/*`
- **Target:** `frontend/src/components/chat/`
- **Verify:** All 16 files exist in target

### T2.3 — Create chat barrel export
- **File:** `frontend/src/components/chat/index.ts`
- **Action:** Export all 16 components
- **Verify:** `import { Composer, MessageBlock } from '@/components/chat'` resolves

### T2.4 — Fix chat component imports
- **Files:** All 16 chat components
- **Action:** Verify all `@/` imports resolve within `frontend/`. Fix any that reference `web/ui` specific paths.
- **Verify:** `bun run typecheck` in `frontend/`

### T2.5 — Copy actions system
- **Source:** `web/ui/src/actions/*`
- **Target:** `frontend/src/actions/`
- **Verify:** 3 files exist, barrel exports

### T2.6 — Copy SDK web hooks
- **Source:** `web/ui/src/sdk/web/*`
- **Target:** `frontend/src/sdk/web/`
- **Verify:** 8 files exist, barrel exports

### T2.7 — Copy backend client
- **Source:** `web/ui/src/sdk/backend-client.ts`
- **Target:** `frontend/src/sdk/backend-client.ts`
- **Verify:** File exists, exports `executeCapability`

### T2.8 — Copy API client
- **Source:** `web/ui/src/api/client.ts`
- **Target:** `frontend/src/api/client.ts`
- **Verify:** File exists

### T2.9 — Copy API types
- **Source:** `web/ui/src/types/api.ts`
- **Target:** `frontend/src/types/api.ts`
- **Verify:** File exists

### T2.10 — Port UI defaults/registry
- **Source:** `web/ui/src/ui/*`
- **Target:** `frontend/src/ui/` (merge or replace)
- **Verify:** Slot system works

### T2.11 — Create features directory and port
- **Source:** `web/ui/src/features/*`
- **Target:** `frontend/src/features/`
- **Verify:** 2 files exist

### T2.12 — Update frontend page.tsx to use chat components
- **File:** `frontend/src/app/page.tsx`
- **Action:** Add health/capabilities/memory surfaces to SURFACES array. Import chat components.
- **Verify:** Page renders all 14 surfaces

### T2.13 — Update frontend layout.tsx providers
- **File:** `frontend/src/app/layout.tsx`
- **Action:** Add any missing providers from `web/ui/` layout (should be identical already)
- **Verify:** Layout renders correctly

### T2.14 — Run full typecheck
- **Action:** `cd frontend && bun run typecheck`
- **Verify:** Zero errors

### T2.15 — Run build
- **Action:** `cd frontend && bun run build`
- **Verify:** Build succeeds

---

## Verification Checklist

- [ ] `frontend/src/components/chat/` has 16 files
- [ ] `frontend/src/components/chat/index.ts` exports all
- [ ] `frontend/src/actions/` has 3 files
- [ ] `frontend/src/sdk/web/` has 8 files
- [ ] `frontend/src/sdk/backend-client.ts` exists
- [ ] `frontend/src/api/client.ts` exists
- [ ] `frontend/src/types/api.ts` exists
- [ ] `frontend/src/ui/` has defaults/registry/slots/context
- [ ] `frontend/src/features/` has onboarding + provider-setup
- [ ] `frontend/src/app/page.tsx` imports chat components
- [ ] `cd frontend && bun run typecheck` passes
- [ ] `cd frontend && bun run build` passes

---

## Rollback

All changes are file copies. Rollback = delete copied files. No DB changes. The original `web/ui/` remains untouched until Phase 3.

---

## Deferred Items (Phase 3 or later)

| Item | Reason | Target Phase |
|------|--------|-------------|
| ML layer (7 files) | Optional, heavy deps | Phase 3 or later |
| Auth (LoginPanel) | Provider-level, not critical | Phase 3 |
| Memory (MemoryBrowser) | Nice-to-have | Phase 3 |
| Tests (vitest/RTL) | Port after features stable | Phase 3 |
