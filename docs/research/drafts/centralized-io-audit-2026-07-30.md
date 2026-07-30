# Centralized I/O Audit — Draft Plan

**Date:** 2026-07-30
**Status:** Draft
**Scope:** Every place a user types in and interacts with the system

---

## Executive Summary

Invariant 5 (One Entry Point) says "no component calls `fetch()` directly." Today, **53 raw `fetch()` calls across 20 files** bypass UnifiedIO. Additionally, only **2 of 7 dispatch surfaces** use the central `dispatchBehavior()` function. The fix isn't routing everything through `/api/interpret` — it's two things:

1. **Every text dispatch** → `dispatchBehavior()` (already exists, underused)
2. **Every data fetch** → `io.get()` / `io.post()` (already exists, bypassed)

---

## Tier 1 — Dispatch Surfaces (user text → backend action)

| # | Component | File | Input | Dispatch Path | Endpoint | Through UnifiedIO? |
|---|-----------|------|-------|---------------|----------|--------------------|
| 1 | `ComposerShell` | `components/chat/ComposerShell.tsx` | textarea | `dispatchBehavior()` | `/api/interpret` or `/api/conversations/:id/send` | ✅ |
| 2 | `UnifiedEntry` | `components/canvas/UnifiedEntry.tsx` | textarea | `dispatchBehavior()` | `/api/interpret` or `/api/conversations/:id/send` | ✅ |
| 3 | `AIChat` (help) | `features/help-system/AIChat.tsx` | textarea | `io.post()` | `/api/interpret` | ✅ |
| 4 | `DevConsole` (chat) | `components/chat/DevConsole.tsx` | textarea | **direct `fetch()`** | `/api/interpret` | ❌ |
| 5 | `DevConsole` (canvas) | `components/canvas/DevConsole.tsx` | input | `io.post()` | `/api/interpret` | ✅ |
| 6 | `HelpWidget` | `features/help-system/HelpWidget.tsx` | button | `io.post()` | `/api/interpret` | ✅ |
| 7 | `guided-landing` | `features/guided-landing.tsx` | textarea | **own `api()` helper** | `/api/setup/*` | ❌ |

### What's Missing from `dispatchBehavior()`

Currently supports behaviors: `chat`, `prompt`, `command`, `search`, `execute`, `comment`

**Missing behaviors:**
- `help` — for help system explain/guide/execute routing
- `nl-inject` — for dev console NL injection
- `onboarding` — for guided landing provider detection + setup

---

## Tier 2 — Search Surfaces (user text → search/filter)

| # | Component | File | Input | Dispatch Path | Endpoint | Through UnifiedIO? |
|---|-----------|------|-------|---------------|----------|--------------------|
| 8 | `CommandPalette` | `components/canvas/CommandPalette.tsx` | input | **direct `fetch()`** | `/api/search` | ❌ |
| 9 | `SearchBar` (help) | `features/help-system/SearchBar.tsx` | input | `io.post()` | `/api/help/search` | ✅ (double-proxy) |
| 10 | `ConversationSearch` | `components/chat/ConversationSearch.tsx` | input | local filter | none | N/A |
| 11 | `CapabilityCatalog` | `components/chat/CapabilityCatalog.tsx` | input | local filter | none | N/A |
| 12 | `ConversationList` | `components/chat/ConversationList.tsx` | input | local filter | none | N/A |

### Issue: Help Search Double-Proxy

`SearchBar → io.post('/api/help/search') → /api/help/search/route.ts → fetch('http://localhost:9420/api/interpret')`

This adds an unnecessary Next.js API route hop. Should be either:
- Direct `io.post('/api/interpret')` (single hop), or
- Local catalog query (zero hops for static data)

---

## Tier 3 — Data Fetch (no user text input, but direct `fetch()` bypasses UnifiedIO)

| # | Component | File | Direct `fetch()` Calls | Endpoints |
|---|-----------|------|----------------------|-----------|
| 13 | `SurfaceContent` | `components/chat/SurfaceContent.tsx` | 6 | `/api/documents`, `/api/media`, `/api/automation/*`, `/api/agent/*` |
| 14 | `DrawerSystem` | `components/canvas/DrawerSystem.tsx` | 4 | `/api/agent/list`, `/api/notification/list`, `/api/presence/list`, `/api/audit/list` |
| 15 | `AuditDashboard` | `components/canvas/AuditDashboard.tsx` | 3 | `/api/audit/list`, `/api/audit/stats`, `/api/audit/export` |
| 16 | `RbacManager` | `components/canvas/RbacManager.tsx` | 6 | `/api/rbac/*` |
| 17 | `NotificationsCenter` | `components/canvas/NotificationsCenter.tsx` | 3 | `/api/notification/*` |
| 18 | `OnboardingTour` | `components/canvas/OnboardingTour.tsx` | 4 | `/api/onboarding/*` |
| 19 | `TemplatesGallery` | `components/canvas/TemplatesGallery.tsx` | 2 | `/api/template/*` |
| 20 | `PresenceIndicator` | `components/canvas/PresenceIndicator.tsx` | 2 | `/api/presence/*` |
| 21 | `WorkspaceSwitcher` | `components/canvas/WorkspaceSwitcher.tsx` | 1 | `/api/workspace/list` |
| 22 | `ShellCard` | `components/canvas/cards/ShellCard.tsx` | 1 | `/api/canvas/shell` |
| 23 | `LiveConfigProvider` | `components/canvas/LiveConfigProvider.tsx` | 1 | `/api/canvas/definition/:id` |
| 24 | `useUpdateChecker` | `hooks/useUpdateChecker.ts` | 6 | `/api/update/*` |
| 25 | `onboard-flow` | `features/onboard-flow.tsx` | 1 | `/api/setup/profiles` |
| 26 | `useAnalytics` | `features/onboarding/useAnalytics.ts` | 1 | `/api/onboarding/analytics` |
| 27 | `useHelpAnalytics` | `features/help-system/useHelpAnalytics.ts` | 1 | `/api/onboarding/analytics` |
| 28 | `use-stream-slot` | `components/canvas/use-stream-slot.ts` | 1 | `/api/canvas/node/stream` |
| 29 | `use-resolved-nodes` | `components/canvas/use-resolved-nodes.ts` | 1 | `/api/canvas/resolve` |
| 30 | `api/client` | `api/client.ts` | 1 | generic wrapper (used by some components) |
| 31 | `cli/commands/shell` | `cli/commands/shell.ts` | 5 | `/api/ui/*` |

**Total: 53 raw `fetch()` calls across 20+ files**

---

## Tier 4 — Server-Side Proxy (acceptable, no fix needed)

| # | File | Calls | Endpoint |
|---|------|-------|----------|
| 32 | `app/api/help/search/route.ts` | 1 | `http://localhost:9420/api/interpret` |
| 33 | `app/api/help/agent/route.ts` | 1 | `http://localhost:9420/api/interpret` |

These are Next.js API routes that proxy to the backend. Server-side `fetch()` is expected.

---

## What Each Bypass Loses

When components use raw `fetch()` instead of UnifiedIO, they lose:

| Feature | UnifiedIO Provides | Raw fetch() |
|---------|-------------------|-------------|
| **traceId propagation** | Auto-generated ULID on every request | None |
| **Error normalization** | `IOError` with status + traceId | Raw `Response` or thrown error |
| **Retry/backoff** | Exponential backoff (default 2 retries) | None |
| **Request deduplication** | GET dedupe by default | None |
| **Auth token injection** | Auto-injected from localStorage | Must manually add header |
| **Timeout** | 30s default, configurable | None (hangs forever) |
| **Zod validation** | Optional response schema validation | None |
| **Event emission** | `request:start/success/error` events | None |

---

## Implementation Plan

### Phase 1: Expand `dispatchBehavior()` (low effort, high impact)

**Files to modify:**
- `src/shared/dispatch-behavior.ts` — add `help`, `nl-inject` behaviors
- `features/help-system/AIChat.tsx` — replace `io.post('/api/interpret')` with `dispatchBehavior('prompt', ...)`
- `components/chat/DevConsole.tsx` — replace `fetch('/api/interpret')` with `dispatchBehavior('prompt', ...)`
- `components/canvas/DevConsole.tsx` — replace `io.post('/api/interpret')` with `dispatchBehavior('prompt', ...)`
- `features/help-system/HelpWidget.tsx` — replace `io.post('/api/interpret')` with `dispatchBehavior('execute', ...)`
- `components/canvas/CommandPalette.tsx` — replace `fetch('/api/search')` with `dispatchBehavior('search', ...)`

### Phase 2: Migrate data fetch to `io` (medium effort, high impact)

Batch by component family:

**Batch A — Canvas panels (8 components, ~22 calls):**
- `DrawerSystem.tsx` (4)
- `AuditDashboard.tsx` (3)
- `RbacManager.tsx` (6)
- `NotificationsCenter.tsx` (3)
- `PresenceIndicator.tsx` (2)
- `TemplatesGallery.tsx` (2)
- `WorkspaceSwitcher.tsx` (1)
- `OnboardingTour.tsx` (4)

**Batch B — Canvas cards/providers (4 components, ~4 calls):**
- `ShellCard.tsx` (1)
- `LiveConfigProvider.tsx` (1)
- `use-stream-slot.ts` (1)
- `use-resolved-nodes.ts` (1)

**Batch C — Chat surfaces (2 components, ~7 calls):**
- `SurfaceContent.tsx` (6)
- `ConversationSearch.tsx` (0 — local filter, OK)

**Batch D — Hooks and features (4 components, ~9 calls):**
- `useUpdateChecker.ts` (6)
- `onboard-flow.tsx` (1)
- `useAnalytics.ts` (1)
- `useHelpAnalytics.ts` (1)

**Batch E — CLI and API client (2 files, ~6 calls):**
- `cli/commands/shell.ts` (5)
- `api/client.ts` (1)

### Phase 3: Remove dead help routes (low effort)

- Delete `app/api/help/search/route.ts` — replace with local catalog or direct interpret call
- Delete `app/api/help/agent/route.ts` — replace with `dispatchBehavior()` call

---

## Metrics (updated after deep inspection)

| Metric | Current | After Fix |
|--------|---------|-----------|
| Dispatch surfaces through `dispatchBehavior()` | 2/7 (29%) | 7/7 (100%) |
| Data fetch through UnifiedIO | ~12 components | 32+ components |
| Raw `fetch()` calls | 53 in 20 files | 0 (except CLI) |
| WebSocket bypassing UnifiedIO | 4 components | 0 |
| Duplicate fetch wrappers | 3 | 0 |
| Dual import paths | 2 | 1 |
| Invariant 5 violations | 53 fetch + 4 WS = 57 | 0 |

---

## Risk Assessment

- **Low risk:** Phase 1 (dispatch behavior expansion) — additive, no existing behavior changes
- **Medium risk:** Phase 2 (data fetch migration) — each `fetch()` → `io.get()` is a mechanical swap but needs testing
- **Low risk:** Phase 3 (dead route removal) — routes are unused after Phase 1

---

## Deep Inspection — Additional Findings

### A. WebSocket Bypasses UnifiedIO Entirely

**File:** `hooks/useWebSocket.ts`
**Impact:** HIGH — real-time streaming bypasses all IO invariants

```
useWebSocket() → new WebSocket(getWsUrl()) → raw ws://localhost:9420/ws
```

UnifiedIO has `subscribeSSE()` for Server-Sent Events, but WebSocket is a separate protocol. The `useWebSocket` hook:
- Creates raw `WebSocket` connections
- No traceId propagation
- No error normalization
- No auth token injection
- No retry/backoff (manual reconnect only)
- No event emission to IO listeners

**Used by:**
- `components/chat/Composer.tsx` — WS status display
- `components/chat/ChatSurface.tsx` — subscribes to `conversation:<id>` topic
- `components/canvas/StreamingIndicator.tsx` — WS status display
- `components/chat/DevConsole.tsx` — raw WS connection for event firehose

**Fix options:**
1. Add `subscribeWS()` to UnifiedIO contract (preferred — keeps one transport layer)
2. Wrap `useWebSocket` to emit IO events (partial fix)

### B. Dual `useIO` Import Paths

Two import paths exist for the same hook:

| Import Path | Used By |
|-------------|---------|
| `@/components/canvas/UnifiedIOProvider` | page.tsx, HelpWidget, DevConsole, DrawerSystem, ZLayerPanel, UnifiedEntry, SearchPanel, etc. |
| `@/sdk/web` | ComposerShell, Composer, CapabilityCatalog, AgentPlanCard, WorkspaceSettings, HealthDashboard, BuilderSurface, ChromeSurface, etc. |

Both resolve to the same `useIO` function (SDK re-exports it). Not a bug, but confusing. Should consolidate to one import path.

### C. Duplicate API Helper Functions

Two files define their own `api()` fetch wrappers, completely bypassing UnifiedIO:

| File | Function | Used For |
|------|----------|----------|
| `features/guided-landing.tsx` | `async function api<T>(path, init)` | Onboarding flow setup calls |
| `features/onboard-flow.tsx` | `async function api<T>(path, init)` | Provider setup profile checks |

Both add `X-Source: frontend` header and 15s timeout. They're duplicated code that should use `io`.

### D. `api/client.ts` — Third Fetch Wrapper

`api/client.ts` defines `capabilityApi` with its own `request()` function using raw `fetch()`. This is a third fetch wrapper alongside UnifiedIO and the two `api()` helpers above.

**Should be:** Deprecated in favor of `io.get()`/`io.post()`.

### E. Context Menu Actions (QuickActionsMenu, VCardMenu)

**QuickActionsMenu** (`components/canvas/QuickActionsMenu.tsx`):
- Right-click context menu with actions: Open doc/video/audio, Run automation, Invoke agent, Shell command, Search, Switch workspace
- Actions are callback props (`onOpenDoc`, `onRunAutomation`, etc.) — no direct API calls
- **Status:** ✅ OK (dispatches to parent, which should use UnifiedIO)

**VCardMenu** (`components/canvas/VCardMenu.tsx`):
- Per-node capability menu (collapse, expand, pin, fullscreen, lock, remove)
- All actions are local state mutations in `LivingCanvas.tsx`
- **Status:** ✅ OK (no API calls)

### F. ReprogramModal — NLCL Input Surface

**File:** `components/canvas/ReprogramModal.tsx`
- Text input for NLCL commands (e.g., "/hide panel:conversations")
- Uses `interpret.interpret()` from `useInterpret()` SDK hook
- `useInterpret()` → `io.post('/api/nlcl/interpret')` → UnifiedIO ✅
- **Status:** ✅ OK

### G. Keyboard Shortcut Dispatch Mapping

| Shortcut | Component | Action | Dispatch Path |
|----------|-----------|--------|---------------|
| `Cmd+K` | CommandPalette | Open search | Local state toggle |
| `Cmd+Shift+H` | page.tsx | Toggle assistant | Local state toggle |
| `Cmd+`` ` | page.tsx | Toggle dev console | Local state toggle |
| `Cmd+1/2/3` | page.tsx | Switch layers | Local state dispatch |
| `Cmd+.` | page.tsx | Toggle panels | Local state toggle |
| `Cmd+/` | page.tsx | Search panel | Local state toggle |
| `Cmd+Shift+K` | page.tsx | Capabilities | Local state toggle |
| `Cmd+Shift+A` | page.tsx | Automations | Local state toggle |
| `Cmd+Shift+T` | page.tsx | Terminal | Local state toggle |
| `Ctrl+?` / `F1` | HelpWidget | Toggle help | Local state toggle |
| `Cmd+R` | ReprogramController | Reprogram surface | Opens modal (local state) |
| `Ctrl+Tab` | SurfaceTabs | Cycle tabs | Local state dispatch |

**Status:** ✅ All keyboard shortcuts are local state toggles. No API calls from shortcuts directly.

### H. What the Scorecard Looks Like After Deep Inspection

| Category | Count | Status |
|----------|-------|--------|
| Dispatch surfaces (text → action) | 7 | 5/7 on dispatchBehavior, 2 bypass |
| Data fetch (read/write) | 53 calls in 20 files | All bypass UnifiedIO |
| WebSocket connections | 4 components | All bypass UnifiedIO |
| SSE subscriptions | via `io.subscribeSSE()` | ✅ On UnifiedIO |
| Duplicate fetch wrappers | 3 (`api()` ×2, `api/client.ts`) | Should be deprecated |
| Dual import paths | 2 (`UnifiedIOProvider`, `@/sdk/web`) | Should consolidate |
| Context menu actions | 2 menus | ✅ OK (callback props) |
| Keyboard shortcuts | 12 shortcuts | ✅ OK (local state) |
| Sandbox postMessage | `SandboxedNode.tsx` | ✅ OK (isolated by design) |
| Clipboard/navigator | 2 calls | N/A (browser API, not server) |

### I. Revised Implementation Plan

#### Phase 1: Expand `dispatchBehavior()` (low effort, high impact)
Add `help`, `nl-inject` behaviors. Wire AIChat, DevConsoles, HelpWidget, CommandPalette.

#### Phase 2: Migrate data fetch to `io` (medium effort, high impact)
53 raw `fetch()` calls → `io.get()`/`io.post()`. Batch by component family.

#### Phase 3: Add WebSocket to UnifiedIO (medium effort, medium impact)
Add `subscribeWS()` to `UnifiedIO` contract. Wrap `useWebSocket` to go through it.

#### Phase 4: Consolidate fetch wrappers (low effort, low impact)
- Delete `api/client.ts` `request()` function
- Delete `guided-landing.tsx` `api()` helper
- Delete `onboard-flow.tsx` `api()` helper
- All replaced by `io.get()`/`io.post()`

#### Phase 5: Consolidate import paths (low effort, low impact)
Pick one: `@/components/canvas/UnifiedIOProvider` or `@/sdk/web`. Update all imports.

---

## Open Questions (updated)

1. Should `api/client.ts` be kept as an alternative to UnifiedIO, or deprecated?
   - **Recommendation:** Deprecated. It's a third fetch wrapper.
2. Should `cli/commands/shell.ts` use UnifiedIO or is it intentionally independent?
   - **Recommendation:** CLI runs in Node, not browser. Keep separate but add traceId.
3. Is the `guided-landing.tsx` onboarding flow intentionally decoupled?
   - **Recommendation:** No. Use `io` like everything else.
4. Should `useWebSocket` be folded into UnifiedIO?
   - **Recommendation:** Yes. Add `subscribeWS()` method. WebSocket is a transport, not a separate concern.
5. Should we keep both `@/sdk/web` and `@/components/canvas/UnifiedIOProvider` import paths?
   - **Recommendation:** Keep `@/sdk/web` as the public API, `@/components/canvas/UnifiedIOProvider` as internal. Update components to use `@/sdk/web`.
