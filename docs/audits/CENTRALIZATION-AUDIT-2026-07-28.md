# Frontend Centralization Audit

**Date:** 2026-07-28
**Scope:** Full frontend codebase (`frontend/src/`)
**Goal:** Identify shared conceptual components, duplicate patterns, and centralization opportunities

---

## Executive Summary

| Pattern | Occurrences | Files Affected | Impact |
|---------|-------------|----------------|--------|
| Panel container shell | 8 | 8 panels | HIGH — every panel duplicates 7 CSS properties |
| Error toast banner | 5 | 5 components | HIGH — identical error UI copy-pasted |
| Card/item container | 10+ | 10+ components | MEDIUM — repeated card styling |
| Inline spinner | 2 | 2 components | LOW — should be a shared component |
| Duplicate ErrorBoundary | 2 | SlidePanel + ErrorBoundary.tsx | MEDIUM — two implementations of same concept |
| Monospace font string | 48 | 20+ files | HIGH — `'ui-monospace, monospace'` hardcoded everywhere |
| Loading state hook | 15+ | 15+ components | MEDIUM — `useState(false)` + try/catch/finally pattern |
| `useIO()` import path | 20+ | 20+ files | LOW — already centralized, but import path reaches into canvas/ |

**Total deduplication potential:** ~200 lines of inline styles → 5 shared primitives

---

## Pattern 1: Panel Container Shell (8 files)

**The pattern:**
```tsx
<div style={{
  padding: 16,
  fontFamily: 'ui-sans-serif, system-ui',
  color: 'var(--text)',
  background: 'var(--bg)',
  height: '100%',
  overflowY: 'auto',
}}>
```

**Files:**
1. `components/canvas/AutomationLauncher.tsx:80`
2. `components/canvas/CanvasControlPanel.tsx:60`
3. `components/canvas/CapabilityCatalog.tsx:69`
4. `components/canvas/FleetStatus.tsx:38`
5. `components/canvas/HealthDashboard.tsx:36`
6. `components/canvas/SessionControls.tsx:50`
7. `components/canvas/TaskManager.tsx:115`
8. `components/canvas/SearchPanel.tsx:89` (slightly different — flex column)

**Fix:** Create `components/canvas/PanelShell.tsx` — a shared wrapper component.

---

## Pattern 2: Error Toast Banner (5 files)

**The pattern:**
```tsx
{error && (
  <div style={{
    padding: 8,
    background: 'color-mix(in oklch, #ef4444 12%, var(--bg-elevated))',
    border: '1px solid #ef4444',
    borderRadius: 6,
    color: '#ef4444',
    fontSize: 11,
    marginBottom: 12,
  }}>
    {error}
  </div>
)}
```

**Files:**
1. `components/canvas/CanvasControlPanel.tsx:117`
2. `components/canvas/AutomationLauncher.tsx:123`
3. `components/canvas/TaskManager.tsx:141`
4. `components/canvas/SessionControls.tsx:74`
5. `components/canvas/panels/ConversationsPanel.tsx:94` (text-only variant)

**Fix:** Create `components/canvas/ErrorBanner.tsx` — accepts `error: string | null`.

---

## Pattern 3: Card/Item Container (10+ files)

**The pattern:**
```tsx
<div style={{
  padding: 8-12,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6-8,
}}>
```

**Files (partial):**
1. `CapabilityCatalog.tsx:118` — capability card
2. `HealthDashboard.tsx:51,80` — provider card
3. `FleetStatus.tsx:42,62` — fleet card
4. `TaskManager.tsx:160` — task item
5. `SessionControls.tsx:60,108` — session card + button
6. `AutomationLauncher.tsx:126,135` — output + result item
7. `SearchPanel.tsx:100` — search input

**Fix:** Create `components/canvas/Card.tsx` — accepts `variant: 'card' | 'item' | 'input'`.

---

## Pattern 4: Inline Spinner (2 files)

**The pattern:**
```tsx
<div style={{
  width: 16-24,
  height: 16-24,
  border: '2px solid var(--border)',
  borderTopColor: 'var(--ring)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}} />
```

**Files:**
1. `LivingCanvas.tsx:250` (24px, also defines `@keyframes spin`)
2. `SlotNode.tsx:45` (16px)

**Fix:** Create `components/canvas/Spinner.tsx` — accepts `size?: number`. Move `@keyframes spin` to `globals.css`.

---

## Pattern 5: Duplicate ErrorBoundary (2 implementations)

**Implementation 1:** `components/ErrorBoundary.tsx` — class component, used by page.tsx, ChatSlotSurface, SlotNode
**Implementation 2:** `SlidePanel.tsx:20` — `PanelErrorBoundary` class, nearly identical

**Fix:** Delete `PanelErrorBoundary` from SlidePanel.tsx. Import from `@/components/ErrorBoundary`.

---

## Pattern 6: Hardcoded Monospace Font (48 occurrences)

**The string:** `fontFamily: 'ui-monospace, monospace'` appears 48 times across 20+ files.

**Fix:** Add CSS variable `--font-mono: 'ui-monospace, monospace'` to `globals.css :root`. Replace all 48 occurrences with `fontFamily: 'var(--font-mono)'`.

---

## Pattern 7: Loading State Hook (15+ components)

**The pattern:**
```tsx
const [loading, setLoading] = useState(false);
// ...
setLoading(true);
try { /* API call */ }
catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
finally { setLoading(false); }
```

**Files:** AutomationLauncher, TaskManager, SessionControls, SearchPanel, CapabilityCatalog, CommandPalette, RelatedNodes, TimeMachinePanel, NotificationsCenter, ReprogramController, WorkspaceSettings, AgentPlanCard, ResetToFactory, BuilderSurface, DevConsole

**Fix:** Create `hooks/useAsyncOperation.ts`:
```tsx
function useAsyncOperation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true); setError(null);
    try { return await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Operation failed'); return null; }
    finally { setLoading(false); }
  };
  return { loading, error, run, clearError: () => setError(null) };
}
```

---

## Pattern 8: Scattered Type Definitions

**Issue:** `ComposerBehavior` is defined in BOTH:
- `types/api.ts:55` — `export type ComposerBehavior = 'chat' | 'search' | 'execute' | 'prompt' | 'command' | 'comment'`
- `shared/dispatch-behavior.ts:12` — `export type Behavior = 'chat' | 'prompt' | 'command' | 'search' | 'execute' | 'comment'`

These are the same type with different names.

**Fix:** Keep one canonical definition in `types/api.ts`. Import in `shared/dispatch-behavior.ts`.

---

## Pattern 9: Duplicate `useIO()` Import Paths

**Issue:** 20+ files import `useIO` from `@/components/canvas/UnifiedIOProvider`. This couples every component to the canvas directory structure.

**Fix:** Re-export `useIO` from `sdk/web/index.ts` or `shared/index.ts` so components import from a public API, not internal paths.

---

## Recommended Execution Order

| Priority | Refactoring | Effort | Impact |
|----------|-------------|--------|--------|
| 1 | PanelShell component | Small | Eliminates 8 duplicate containers |
| 2 | ErrorBanner component | Small | Eliminates 5 duplicate error UIs |
| 3 | Spinner component + CSS keyframe | Small | Eliminates 2 inline spinners |
| 4 | `--font-mono` CSS variable | Tiny | Eliminates 48 hardcoded strings |
| 5 | useAsyncOperation hook | Medium | Eliminates 15+ loading state patterns |
| 6 | ErrorBoundary dedup | Tiny | Removes duplicate class component |
| 7 | Type consolidation | Tiny | Removes duplicate ComposerBehavior |
| 8 | useIO re-export | Tiny | Cleans import paths |

---

## Files to Create

1. `components/canvas/PanelShell.tsx` — shared panel container
2. `components/canvas/ErrorBanner.tsx` — shared error toast
3. `components/canvas/Spinner.tsx` — shared loading spinner
4. `hooks/useAsyncOperation.ts` — shared async loading state

## Files to Modify

1. `globals.css` — add `--font-mono`, move `@keyframes spin`
2. `SlidePanel.tsx` — delete duplicate ErrorBoundary
3. `shared/dispatch-behavior.ts` — import canonical Behavior type
4. `sdk/web/index.ts` — re-export useIO
5. 8 panel files — replace inline container with PanelShell
6. 5 error files — replace inline error with ErrorBanner
7. 48 monospace occurrences — replace with CSS variable
8. 15+ loading files — replace with useAsyncOperation
