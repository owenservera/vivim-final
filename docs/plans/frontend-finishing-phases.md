# Frontend Finishing Phases — Implementation Plan

> Generated from deep inspection of `frontend/` codebase. All paths under `frontend/src/`.

---

## The Vision: Universal Canvas

The frontend is a **plugin-based, hot-swappable, live-configurable UI system** where "the interface is data, not code." Key pillars:

1. **Living Canvas** — Infinite 2D canvas with draggable nodes, semantic zoom (micro/mid/macro), force-directed layout, and 6 layout intents (cluster, timeline, mindmap, kanban, grid, free)
2. **Slot System** — 13 `chat.*` slots hot-swappable at runtime per provider/capability (capabilitySlug > providerSlug > default)
3. **Universal Component Registry** — Single registry for ALL UI components, resolved dynamically
4. **Agent Co-pilot** — Ghost overlays showing agent plans with accept/reject UX
5. **Drawer System** — Edge drawers (left/right/top/bottom) with configurable panels

---

## UX Assessment: What Works

| Feature | Status | Quality |
|---------|--------|---------|
| Theme System (6 accents, light/dark/auto) | ✅ | Excellent |
| Command Palette (⌘K, fuzzy search) | ✅ | Excellent |
| Notifications Center (filters, badges) | ✅ | Good |
| Health Dashboard (provider cards) | ✅ | Good |
| Streaming Indicator (WS status) | ✅ | Good |
| Latency Breakdown (bar chart) | ✅ | Good |
| Icon System (100+ SVG, no emojis) | ✅ | Excellent |
| Glass-morphism surfaces | ✅ | Excellent |
| Semantic Zoom (3 tiers) | ✅ | Good |
| VCard context menus | ✅ | Good |
| Skeleton loading (ConversationList) | ✅ | Basic |
| Error banner with retry (Composer) | ✅ | Basic |

---

## Bugs Found (5)

| # | File | Line | Bug | Impact | Fix |
|---|------|------|-----|--------|-----|
| 1 | `Composer.tsx` | 89-95 | `useEffect` clears messages on switch but does **NOT** clear `lastError` or `localSuggestion` | SC-M4-3 FAIL — stale error shown after conversation switch | Add `setLastError(null); setLocalSuggestion(null);` |
| 2 | `Composer.tsx` | 119-144 | `conversation:complete` appends synthetic message from buffered blocks instead of calling `loadHistory()` | SC-M4-2 FAIL — no reconciliation with backend state, dropped blocks diverge from DB | Replace with `loadHistory(conversationId)` |
| 3 | `ThemeProvider.tsx` | 63-78 | Applies CSS vars but does **NOT** toggle `.dark`/`.light` class on `<html>` or set `colorScheme` | Tailwind's `@custom-variant dark` (globals.css:4) never triggers; `.dark` CSS rules (globals.css:81) never match | Add `classList.toggle` + `colorScheme` after token loop |
| 4 | `StreamingIndicator.tsx` | 5 | `@ts-nocheck` annotation hides type errors | Type safety bypassed; component is already type-safe (`WsStatus` matches) | Remove line, no other changes needed |
| 5 | `CapabilityCatalog.tsx` | 4,28,46 | Uses deprecated `getApiUrl` + raw `fetch()` instead of `useIO()` | Bypasses UnifiedIO traceId propagation, dedup, audit logging | Replace with `useIO()` hook |

### Bug Details

**Bug 1 — Stale error on conversation switch:**
```tsx
// Composer.tsx:89-95
useEffect(() => {
  setMessages([]);
  setStreamingBlocks([]);
  setStreamingTiming(null);
  setStreaming(false);
  // BUG: setLastError(null) is missing here
  // BUG: setLocalSuggestion(null) is missing here
  if (conversationId) loadHistory(conversationId);
}, [conversationId, loadHistory]);
```

**Bug 2 — No reconciliation after send:**
```tsx
// Composer.tsx:119-144
} else if (msg.type === 'conversation:complete') {
  const batch = pendingBlocksRef.current.splice(0);
  const finalTiming = payload.timing ?? pendingTimingRef.current;
  setStreaming(false);
  // BUG: Creates synthetic message from buffered blocks instead of loadHistory()
  setMessages((prev) => [
    ...prev,
    { id: `stream-${Date.now()}`, role: 'assistant', content: '', blocks: ... }
  ]);
}
```

**Bug 3 — Dark mode broken:**
```tsx
// ThemeProvider.tsx:63-78
useEffect(() => {
  const tokens = resolveTokens(pref, systemDark);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(k, v);
  }
  root.dataset.theme = pref.mode;
  root.dataset.accent = pref.accent;
  // BUG: Missing toggles for dark/light mode:
  // root.classList.toggle('dark', dark);
  // root.classList.toggle('light', !dark);
  // root.style.colorScheme = dark ? 'dark' : 'light';
}, [pref, systemDark]);
```

---

## Missing Features

### High Priority (Phase 0-3)

| Feature | Current State | Target |
|---------|---------------|--------|
| Component tests | ❌ No tests in `frontend/tests/` | 6+ tests for Composer |
| Dark mode activation | ❌ CSS vars set but `.dark` class not toggled | Toggle `.dark` + `.light` + `colorScheme` |
| Loading skeletons | ⚠️ Basic pulse in ConversationList | Dedicated skeleton components for all loading states |
| Error recovery | ⚠️ Basic retry in Composer | `useRetry` hook with spinner + countdown |
| Offline indicator | ❌ Does not exist | `navigator.onLine` listener + UI badge |
| `@ts-nocheck` removal | ⚠️ StreamingIndicator has it | Remove and fix types |

### Medium Priority (Phase 4-5)

| Feature | Current State | Target |
|---------|---------------|--------|
| Virtual scrolling | ❌ No `@tanstack/react-virtual` | Install + wrap ConversationList + message list |
| Keyboard nav (lists) | ❌ No arrow keys in ConversationList | Arrow keys + Enter + Home/End |
| Focus trapping (modals) | ❌ CommandPalette + ThemeSettings lack it | Focus trap + Esc to close |
| Live region (streaming) | ❌ No `aria-live` announcements | `aria-live="polite"` for streaming blocks |
| Undo/redo | ⚠️ CommandStack exists but not wired | Wire to delete conversation + capability execute |

### Low Priority (Phase 6-10)

| Feature | Current State | Target |
|---------|---------------|--------|
| Responsive layout | ❌ Fixed widths | Mobile breakpoints for sidebar/overlay |
| CSS transitions | ⚠️ CSS animations exist in `globals.css` | Wire to component state changes |
| Moment formatting | ❌ Raw ISO timestamps | "2 minutes ago", "Yesterday" |
| Onboarding tour | ⚠️ `OnboardingTour` exists but not wired | First-run experience |
| Accessibility audit | ❌ No aria labels on most components | WCAG 2.1 AA compliance |

---

## Architecture Notes

### File Inventory
- **48 UI primitives** (Radix-based) in `components/ui/`
- **41 canvas components** in `components/canvas/`
- **17 chat components** in `components/chat/`
- **9 hooks** in `hooks/`
- **20 source directories** in `src/`

### Key Dependencies
- Next.js 16, React 19, Tailwind CSS 4, Zustand, Zod, Lucide
- Radix UI (48 primitives), Framer Motion, Recharts
- `@tanstack/react-query` (installed but unused in components)
- `vitest` in devDeps but **no config file**

### Slot System
- 13 slots defined in `ui/slots.ts`
- Resolution: `resolveSlot(slotId, { providerSlug, capabilitySlug })`
- Precedence: capabilitySlug > providerSlug > default

### API Layer
- `sdk/backend-client.ts` — Zod-validated fetch (deprecated, use `useUnifiedIO`)
- `components/canvas/UnifiedIOProvider.tsx` — New unified IO layer
- `hooks/useWebSocket.ts` — WS hook with auto-reconnect

---

## Execution Order

| Phase | Priority | Effort | Status | Files |
|-------|----------|--------|--------|-------|
| **0: Multi-Turn Robustness** | CRITICAL | 15 min | ✅ Ready | `Composer.tsx` — clear lastError + use loadHistory |
| **1: Dark Mode Fix** | CRITICAL | 5 min | ✅ Ready | `ThemeProvider.tsx` — toggle .dark/.light class |
| **2: Remove @ts-nocheck** | HIGH | 2 min | ✅ Ready | `StreamingIndicator.tsx` — remove line |
| **3: Deprecated API cleanup** | MEDIUM | 10 min | ✅ Ready | `CapabilityCatalog.tsx` — replace getApiUrl+fetch with useIO() |
| **4: Loading Skeletons** | MEDIUM | 1 day | ⚠️ 20% done | New skeleton components |
| **5: Error Recovery** | MEDIUM | 1-2 days | ⚠️ 30% done | New `useRetry` hook |
| **6: Virtual Scrolling** | MEDIUM | 2-3 days | ❌ Not started | Install + wrap components |
| **7: Accessibility** | MEDIUM | 3-4 days | ❌ Not started | All components |
| **8: Responsive Layout** | LOW | 2-3 days | ❌ Not started | Breakpoints |
| **9: CSS Transitions** | LOW | 1 day | ⚠️ CSS ready | Wire animations |
| **10: Undo/Redo** | LOW | 2-3 days | ⚠️ Stack exists | Wire to actions |
| **11: Moment Formatting** | LOW | 0.5 days | ❌ Not started | `lib/utils.ts` |

**Current batch (Phase 0-3):** ~30 min total

---

## Verification Checklist (per phase)

- [ ] `bun run typecheck` — 0 errors
- [ ] `bun run build` — 0 errors
- [ ] `bun run lint` — 0 errors
- [ ] `bun test tests/` — all pass
- [ ] `bun run devops verify-cross-surface` — green
- [ ] No `if (slug===...)` conditionals added (FRONTEND=BACKEND)
- [ ] All new components registered in `UIComponentRegistry`
- [ ] All actions go through `ActionRegistry` (B8)
- [ ] Dark mode toggles correctly (light ↔ dark ↔ auto)
- [ ] No `@ts-nocheck` annotations remain
