# PRD #8: Accessibility

## Problem Statement

Accessibility is inconsistently implemented across the frontend:

- **Good foundation** — skip link exists, reduced motion supported, some components have aria attributes
- **Gaps remain**:
  - No reusable focus trap hook — focus trap embedded only in SlidePanel
  - No reusable keyboard navigation hook — keyboard handlers scattered across components
  - No screen reader announcement hook — aria-live inline in components
  - No high contrast mode support — only `prefers-reduced-motion` implemented
  - Skip link exists but can be improved with better styling and positioning
  - Not all interactive elements have aria-labels
  - Focus restoration inconsistent (some components handle it, others don't)

## Goals

1. **Centralize focus management** — extract focus trap hook from SlidePanel, add focus restoration
2. **Centralize keyboard navigation** — extract keyboard handlers, support arrow keys for lists/tabs
3. **Centralize screen reader support** — create announcement hook for consistent live regions
4. **Add high contrast mode** — implement `prefers-contrast: high` CSS support
5. **Improve skip link** — enhance styling, positioning, and focus management

## Scope

| Area | Files | Action |
|------|-------|--------|
| Focus trap | `hooks/useFocusTrap.ts` (new) | Hook: traps focus, restores previous focus on unmount |
| Keyboard nav | `hooks/useKeyboardNav.ts` (new) | Hook: arrow keys for lists/tabs, Enter/Space for buttons |
| Screen reader | `hooks/useScreenReader.ts` (new) | Hook: `announce(message)` for aria-live regions |
| High contrast | `globals.css` | `@media (prefers-contrast: high)` overrides |
| Skip link | `components/ui/SkipLink.tsx` (new) | Enhanced skip link with better styling and focus |

## Non-Goals

- Full WCAG 2.1 AA audit (separate comprehensive audit)
- Custom screen reader testing tools
- Voice control integration

## Existing Code Assessment

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Skip link | `app/layout.tsx:54` | ✅ Exists | Good baseline, could be improved with better styling and positioning |
| Reduced motion | `app/layout.tsx:40` + others | ✅ Exists | Media query implemented in layout and multiple components |
| Focus trap | `components/canvas/SlidePanel.tsx:67` | ⚠️ Partial | Embedded implementation, not reusable |
| Screen reader live region | `features/guided-landing.tsx:960` + others | ✅ Exists | Inline aria-live, no announcement hook |
| Keyboard handlers | `components/canvas/SlidePanel.tsx:71` + many others | ⚠️ Partial | Scattered implementations, no shared hook |
| Keyboard navigation | `components/canvas/SlidePanel.tsx:71` | ✅ Exists | Focus trap handles Tab/Shift+Tab, Escape |
| ARIA attributes | Many components | ✅ Exists | Good usage, but not consistent across all interactive elements |
| Focus restoration | Some components (SlidePanel) | ⚠️ Partial | SlidePanel restores previous focus, not used elsewhere |
| High contrast | ❌ Missing | Media query only for reduced motion |
| Focus trap hook | ❌ Missing | Focus trap embedded in SlidePanel only |

## Implementation Steps

### Step 1: Focus trap hook
- Create `hooks/useFocusTrap.ts`:
  - Trap focus within container on mount
  - Auto-restore previous focus on unmount (like SlidePanel's implementation)
  - Exposed `setTrap()` / `clearTrap()` for conditional trapping

### Step 2: Keyboard navigation hook
- Create `hooks/useKeyboardNav.ts`:
  - Arrow keys for list navigation (up/down)
  - Tab/Shift+Tab for focus management (using focus trap)
  - Enter/Space for button-like elements
  - Escape for close actions
  - Returns ref to attach to container, optional onNavigate callback

### Step 3: Screen reader announcement hook
- Create `hooks/useScreenReader.ts`:
  - `announce(message: string, priority?: 'polite'|'assertive')`
  - Appends aria-live region, removes after announcement
  - Suitable for dynamic content changes (toast notifications, results)

### Step 4: High contrast mode
- Add to `globals.css`:
  - `@media (prefers-contrast: high)` rules for all components
  - Higher contrast colors for text, borders, backgrounds
  - Ensure icons and indicators remain visible

### Step 5: Enhanced skip link
- Create `components/ui/SkipLink.tsx`:
  - Better positioning (top-left with padding)
  - More prominent styling (button-like appearance)
  - Keyboard focus styling
  - Link text configurable (default "Skip to main content")
  - Placement before main content anchor

## Acceptance Criteria

- [ ] Focus trap hook reusable across components
- [ ] Keyboard navigation support for lists/tabs
- [ ] Screen reader announcement hook for dynamic content
- [ ] High contrast mode supported via media query
- [ ] Enhanced skip link with better styling and focus
- [ ] All interactive elements have aria-labels
- [ ] Focus restoration consistent across all dialogs/modals
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

## Priority

**P1** — Critical for inclusive design.

## Estimated Effort

~4–5 hours. Hook implementations + CSS media queries + enhanced skip link.
