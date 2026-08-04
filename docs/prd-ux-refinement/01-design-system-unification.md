# PRD #1: Design System Unification

## Problem Statement

The frontend has **two parallel design systems**: canvas primitives (`components/canvas/Button.tsx`, `InputField.tsx`, `Toast.tsx`, etc.) use **inline CSS styles** with CSS custom properties, while shadcn/ui primitives (`components/ui/button.tsx`, `input.tsx`, etc.) use **Tailwind classes** with `cn()` utility. This creates:

- Inconsistent visual language across panels
- Duplicate component definitions (two Buttons, two Inputs)
- No shared hover/focus/disabled state handling
- Missing accessibility features (focus-visible rings, aria-invalid) in canvas primitives
- Hardcoded color values in some canvas components (e.g., `#ef4444` in Button danger variant, `#3b82f6` in HelpWidget)

## Goals

1. **Single source of truth** for all UI primitives — one Button, one Input, one Toast, etc.
2. **CSS variable bridge** — shadcn/ui Tailwind classes already reference `var(--primary)`, `var(--accent)`, etc. from `globals.css`. Canvas components should use the same tokens.
3. **No visual regressions** — existing panels must look identical after migration.
4. **Backward-compatible exports** — `components/canvas/index.ts` re-exports remain valid; consumers don't break.

## Scope

| Area | Files | Action |
|------|-------|--------|
| Canvas primitives to retire | `Button.tsx`, `InputField.tsx`, `TextArea.tsx`, `Toast.tsx`, `Spinner.tsx`, `EmptyState.tsx`, `ErrorBanner.tsx`, `StatusDot.tsx`, `SectionLabel.tsx`, `Truncate.tsx` | Replace with shadcn/ui wrappers or new unified components |
| shadcn/ui primitives to extend | `button.tsx`, `input.tsx`, `textarea.tsx`, `toast.tsx` | Add missing variants (canvas `danger` → shadcn `destructive`, canvas `ghost` → shadcn `ghost`) |
| CSS tokens | `globals.css` | Add missing tokens: `--bg-elevated`, `--bg-subtle`, `--text-muted`, `--text-subtle` already exist — verify all canvas components use them instead of hardcoded hex |
| Barrel exports | `components/canvas/index.ts` | Re-export from `components/ui/` instead of local canvas files |
| HelpWidget, UpdateNotification | `features/help-system/HelpWidget.tsx`, `canvas/UpdateNotification.tsx` | Replace hardcoded colors with CSS variable references |

## Non-Goals

- Migrating all canvas components to Tailwind (only primitives)
- Changing the layout system (CSS Grid/Flexbox in canvas panels)
- Touching `components/ui/` shadcn/ui internals beyond adding variants

## Implementation Steps

### Step 1: Audit hardcoded colors

Grep all canvas components for hex colors (`#[0-9a-fA-F]`) and replace with CSS variable references.

### Step 2: Extend shadcn/ui primitives

- `button.tsx`: add `destructive` variant (maps to canvas `danger`)
- `input.tsx`: ensure `--bg-elevated` background is default
- Create `components/ui/spinner.tsx`, `components/ui/empty-state.tsx`, `components/ui/status-dot.tsx`, `components/ui/section-label.tsx`, `components/ui/truncate.tsx` if they don't exist

### Step 3: Create bridge re-exports

In `components/canvas/index.ts`, replace local imports with re-exports from `components/ui/`:

```ts
export { Button } from '@/components/ui/button'
export { Input } from '@/components/ui/input'
// etc.
```

### Step 4: Update consumers

Each canvas component that imports local `Button`/`InputField` etc. gets updated to import from the new source.

### Step 5: Remove old files

Delete retired canvas primitive files after all imports are updated.

## Acceptance Criteria

- [ ] Zero hardcoded hex colors in canvas components (grep `#[0-9a-fA-F]` returns 0 in `components/canvas/`)
- [ ] `npm run typecheck` passes (no import errors)
- [ ] `npm run build` succeeds
- [ ] Visual spot-check: HelpWidget, UpdateNotification, CapabilityCatalog, HealthDashboard render with correct colors
- [ ] All canvas primitive exports still resolve from `components/canvas/index.ts`

## Priority

**P0** — Foundation for all other UX work. Must complete before Area 2–10.

## Estimated Effort

~2–3 hours. Mostly mechanical find-and-replace with careful import rewiring.
