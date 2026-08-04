# PRD #6: Error Handling

## Problem Statement

Error handling is inconsistent across the frontend:

- **Two toast systems** — `components/ui/toast.tsx` (Radix/shadcn) and `components/canvas/Toast.tsx` (simple fixed-position) coexist; the Radix Toaster is never mounted in the layout
- **ErrorBoundary exists** but only logs to `console.error` — no backend error logging
- **No network status detection** — offline/reconnect scenarios not handled
- **No error classification** — network/auth/validation errors all look the same
- **ErrorBanner is text-only** — no retry action, no dismiss, no details toggle
- **No full-page fallback** — ErrorBoundary has inline fallback div, but no top-level "Something went wrong" page for unrecoverable crashes

## Goals

1. **Unify toast system** — one `useToast` hook + `Toaster` mounted in layout, replacing the two separate implementations
2. **Network error handling** — detect offline/reconnect, show banner with reconnect prompt
3. **Error logging** — send errors to backend `/api/error/log` with component stack + user context
4. **Error classification** — distinguish network/auth/validation/logic errors in toast title
5. **Upgrade ErrorBanner** — add retry action, dismiss, details toggle
6. **Full-page fallback** — "Something went wrong" with retry + copy-error for unrecoverable crashes

## Scope

| Area | Files | Action |
|------|-------|--------|
| Toast unification | `hooks/useToast.ts` (upgrade), `components/ui/Toaster.tsx` (mount in layout) | Merge Radix toast + canvas toast into one hook, mount Toaster in layout |
| Network detector | `hooks/useNetworkStatus.ts` (new) | Hook: `{ isOnline, isReconnecting, reconnect }` |
| Error logger | `lib/errorLogger.ts` (new) | POST errors to `/api/error/log` with context |
| Error classification | `lib/errorClassifier.ts` (new) | Classify errors → network/auth/validation/logic |
| ErrorBanner upgrade | `components/canvas/ErrorBanner.tsx` (edit) | Add retry, dismiss, details toggle |
| Full-page fallback | `components/ui/ErrorFallback.tsx` (new) | Full-page error with retry + copy-error |

## Non-Goals

- Error analytics dashboard (covered by AuditDashboard)
- Automatic error recovery (retry only)
- Error aggregation across sessions

## Existing Code Assessment

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| ErrorBoundary | `components/ErrorBoundary.tsx` | ✅ Exists | Class component, auto-retry (3x), fallback div with "Try again". Used in `page.tsx`, `layout.tsx`, `ChatSlotSurface.tsx`, `SlotNode.tsx`, `SlidePanel.tsx` |
| ErrorBanner | `components/canvas/ErrorBanner.tsx` | ⚠️ Partial | Simple red banner, no retry/dismiss/details. Used in AutomationLauncher, CanvasControlPanel, TaskManager, SessionControls |
| Toast (canvas) | `components/canvas/Toast.tsx` | ✅ Exists | Fixed-position, ok/err variants, auto-dismiss. Used by 5 canvas panels via `hooks/useToast.ts` |
| Toast (Radix) | `components/ui/toast.tsx` + `toaster.tsx` + `hooks/use-toast.ts` | ⚠️ Unused | Full Radix/shadcn toast with title/description/action. Toaster never mounted in layout |
| Network status | — | ❌ Missing | No `navigator.onLine` detection or online/offline event listeners |
| Error logging | — | ❌ Missing | Only `console.error` in ErrorBoundary. No backend logging |
| Error classification | — | ❌ Missing | No distinction between network/auth/validation/logic errors |
| Full-page fallback | — | ❌ Missing | ErrorBoundary has inline fallback, no top-level crash page |

## Implementation Steps

### Step 1: Mount Toaster in layout + unify useToast
- Mount `<Toaster />` from `@/components/ui/toaster` in `frontend/src/app/layout.tsx`
- Upgrade `hooks/useToast.ts` to use the Radix `toast()` function from `hooks/use-toast.ts`
- Update canvas components (`AutomationLauncher`, `CanvasControlPanel`, `CapabilityCatalog`, `SessionControls`, `TaskManager`) to use the unified hook
- Delete `components/canvas/Toast.tsx` after migration

### Step 2: Network status hook
- Create `hooks/useNetworkStatus.ts` — listens to `navigator.onLine`, `online`/`offline` events
- Returns `{ isOnline, isReconnecting, reconnect }`
- `reconnect()` attempts `fetch('/api/health')` with timeout

### Step 3: Error classifier
- Create `lib/errorClassifier.ts` — classify errors by type:
  - `TypeError: Failed to fetch` → network
  - `401`/`403` → auth
  - `400`/`422` → validation
  - Everything else → logic
- Returns `{ type: 'network'|'auth'|'validation'|'logic', title: string, retryable: boolean }`

### Step 4: Error logger
- Create `lib/errorLogger.ts` — POST errors to `/api/error/log`
- Payload: `{ message, stack, componentStack, type, url, timestamp, userAgent }`
- Debounce: max 1 log per 5s per error message
- Fails silently (no error loop)

### Step 5: Upgrade ErrorBanner
- Edit `components/canvas/ErrorBanner.tsx`:
  - Add optional `onRetry` callback → shows "Retry" button
  - Add optional `onDismiss` callback → shows close button
  - Add "Details" toggle → expands to show full error message
  - Use error classifier for type-based color/icon

### Step 6: Full-page fallback
- Create `components/ui/ErrorFallback.tsx` — full-page error screen
- Shows: "Something went wrong", error message, "Copy error" button, "Retry" button
- Used as top-level `<ErrorBoundary fallback={<ErrorFallback />}>` in `layout.tsx`

### Step 7: Wire network status banner
- In `layout.tsx`, use `useNetworkStatus` to show a persistent banner when offline
- Banner: "You're offline. [Reconnect]" — auto-hides when back online

## Acceptance Criteria

- [ ] Single `useToast` hook used across all components
- [ ] `<Toaster />` mounted in layout, visible app-wide
- [ ] Network offline detected, reconnect prompt shown
- [ ] Errors logged to backend with component stack
- [ ] Error classification (network/auth/validation/logic) in toast title
- [ ] ErrorBanner has retry + dismiss + details
- [ ] "Something went wrong" full-page fallback for unrecoverable errors
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

## Priority

**P1** — Critical for production reliability.

## Estimated Effort

~3–4 hours. Toast unification + error classifier + logger + ErrorBanner upgrade + fallback + network hook + CSS.
