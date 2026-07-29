# Frontend Centralization Protocol

**Version:** 1.0
**Date:** 2026-07-28
**Objective:** Eliminate duplicate conceptual components, scattered types, and repeated inline patterns across the frontend codebase.

---

## Protocol Phases

### Phase 0: Inventory (DONE)
- Scan codebase for repeated patterns
- Classify by: frequency, files affected, line savings
- Produce `CENTRALIZATION-AUDIT-2026-07-28.md`

### Phase 1: Quick Wins (DONE)
| Refactoring | Target | Impact |
|-------------|--------|--------|
| `--font-mono` CSS variable | 48 occurrences in 27 files | Single source of truth for monospace font |
| `@keyframes spin` in globals.css | LivingCanvas inline `<style>` | Shared animation keyframe |
| `<Spinner>` component | 2 inline spinners | Reusable loading indicator |
| `<PanelShell>` component | 8 panel containers | Consistent panel layout |
| `<ErrorBanner>` component | 5 error toast patterns | Consistent error UI |
| `ErrorBoundary` dedup | SlidePanel duplicate class | Single error boundary implementation |

### Phase 2: Hook Consolidation (THIS ITERATION)
| Refactoring | Target | Impact |
|-------------|--------|--------|
| `useAsyncOperation` adoption | 15+ loading/error patterns | Eliminate try/catch/finally boilerplate |
| `ComposerBehavior` type merge | 2 duplicate definitions | Single canonical type |
| `useIO` re-export | 20+ internal import paths | Clean public API boundary |

### Phase 3: Visual Pattern Extraction (NEXT)
| Refactoring | Target | Impact |
|-------------|--------|--------|
| `<Card>` component | 10+ card/item containers | Consistent card styling |
| Button style primitives | 5+ button variants | Reusable button styles |
| Toast notification system | 3+ toast patterns | Unified notification UX |

### Phase 4: Structural Alignment (FUTURE)
| Refactoring | Target | Impact |
|-------------|--------|--------|
| shared/ directory consolidation | 36 files, some overlap | Clear module boundaries |
| types/ alignment | types/api.ts vs shared/ types | Single type source |
| barrel export cleanup | sdk/web/index.ts | Clean public imports |

---

## Inspection Protocol

### Before Each Refactoring
1. **Count** occurrences of the pattern (grep/rg)
2. **Map** all files affected
3. **Read** 3-5 representative instances to confirm exact match
4. **Create** shared component/hook with minimal API surface
5. **Replace** all instances (use `replaceAll` for bulk)
6. **Verify** build compiles clean
7. **Update** audit doc with results

### Quality Gates
- [ ] No new `any` types introduced
- [ ] All existing comments preserved
- [ ] CSS variables only (no Tailwind for inline styles)
- [ ] SDK hooks only (no hand-written fetch)
- [ ] Build passes with 0 errors
- [ ] No circular imports introduced

### Rollback Strategy
- Each refactoring is atomic (one commit per pattern)
- If build fails, revert that specific pattern replacement
- Shared components are additive (never break existing APIs)

---

## Iteration Log

### Iteration 1 (Completed)
- **Date:** 2026-07-28
- **Scope:** Phase 0 + Phase 1
- **Results:** 6 patterns centralized, 30+ files modified, build clean
- **Lines saved:** ~160 lines of inline styles

### Iteration 2 (Completed)
- **Date:** 2026-07-28
- **Scope:** Phase 2 + deep inspection
- **New files:** Toast.tsx, Button.tsx
- **Results:**
  - Toast component adopted in 5 files (AutomationLauncher, CanvasControlPanel, CapabilityCatalog, SessionControls, TaskManager)
  - Button component adopted in 4 files (AutomationLauncher, SessionControls, TaskManager, + existing)
  - `ComposerBehavior` type consolidated (dispatch-behavior.ts now imports from types/api.ts)
  - `useIO` re-exported from `sdk/web/index.ts`
- **Lines saved:** ~80 lines of inline button/toast styles
- **Build:** Clean (0 errors)

### Iteration 3 (Completed)
- **Date:** 2026-07-28
- **Scope:** useAsyncOperation adoption
- **Results:**
  - `useAsyncOperation` adopted in TaskManager and AutomationLauncher
  - Eliminated ~30 lines of try/catch/finally boilerplate
  - Simplified `handleExecute` and `handleRun` handlers
- **Lines saved:** ~30 lines
- **Build:** Clean (0 errors)

### Iteration 4 (Completed)
- **Date:** 2026-07-28
- **Scope:** EmptyState, TextArea, useToast adoption + barrel exports
- **New files:** EmptyState.tsx, TextArea.tsx, useToast.ts
- **Results:**
  - `EmptyState` adopted in ConversationsPanel, ProvidersPanel (4 inline patterns → 2 component calls)
  - `TextArea` adopted in AutomationLauncher, CapabilityCatalog, CanvasControlPanel (3 duplicate textarea styles → component calls)
  - `useToast` hook created and adopted in 5 canvas files (CanvasControlPanel, SessionControls, AutomationLauncher, TaskManager, CapabilityCatalog) — eliminated manual `useState` + `showToast` + `setTimeout` boilerplate
  - Removed `useRef` timer management from CapabilityCatalog
  - `useToast` exported from `sdk/web/index.ts` as public API
  - All shared primitives added to `canvas/index.ts` barrel exports
- **Lines saved:** ~60 lines of boilerplate
- **Build:** Clean (0 type errors)

### Iteration 5 (Completed)
- **Date:** 2026-07-28
- **Scope:** Cross-domain useAsyncOperation adoption + import path normalization
- **Results:**
  - `useAsyncOperation` adopted in 5 files: chat/CapabilityCatalog, builder/BuilderSurface, chrome/ResetToFactory, chat/AgentPlanCard, canvas/TimeMachinePanel
  - Eliminated all 8 remaining `e instanceof Error ? e.message : 'Network error'` patterns
  - Added `setError` to `useAsyncOperation` hook interface for manual error messages
  - Normalized 11 `useIO` import paths from `@/components/canvas/UnifiedIOProvider` → `@/sdk/web`
  - `useToast` adopted in chat/CapabilityCatalog (eliminated manual `setTimeout`)
- **Lines saved:** ~80 lines of try/catch/finally boilerplate
- **Build:** Clean (0 type errors)

### Remaining (Not Started)
- **stream-blocks.ts** — exported via barrel but `ContentBlock` never imported (dead code, optional cleanup)

---

### Iteration 6: Deep Pattern Extraction (Phase 0+1)

**Scope:** Remaining inline style patterns identified by deep scan.

| Pattern | Count | Files Affected |
|---------|-------|----------------|
| Truncate (`overflow:hidden, textOverflow:ellipsis, whiteSpace:nowrap`) | 15 | 11 files (SearchPanel, LivingCanvas, RelatedNodes, TabBar, StreamingNodeWrapper, DevConsole, CommandPalette, CapabilityCatalog, AgentOverlay, CanvasControlPanel, chat/DevConsole, QuoteBar, AttachmentPreview) |
| SectionLabel (`fontSize:11, fontWeight:600, textTransform:uppercase`) | 13 | 8 files (AutomationLauncher, CanvasControlPanel, AuditDashboard, CapabilityCatalog, DevConsole, FleetStatus, HealthDashboard, TaskManager, OnboardingTour, SearchPanel, TemplatesGallery) |
| InputField (`padding:'6px 10px', border, bg-elevated`) | 4 | 3 files (CapabilityCatalog, SessionControls, TaskManager) |
| StatusDot (`width:8, height:8, borderRadius:'50%'`) | 3 | 3 files (chat/HealthIndicator, HealthDashboard, TaskManager) |

**New Components:**
| Component | File | Purpose |
|-----------|------|---------|
| `Truncate` | `components/canvas/Truncate.tsx` | Single-line text truncation with ellipsis. Renders `span` by default, configurable `as` prop. |
| `SectionLabel` | `components/canvas/SectionLabel.tsx` | Uppercase section heading with `fontSize:11, fontWeight:600, letterSpacing:0.05em`. |
| `InputField` | `components/canvas/InputField.tsx` | Consistent text input styling. Wraps `<input>` with base styles. |
| `StatusDot` | `components/canvas/StatusDot.tsx` | Small colored circle for status indication. |

---

### Iteration 7: Test Coverage (Phase 5)

**Scope:** Unit tests for all shared primitives and hooks.

**Test Infrastructure:**
- Created `frontend/bunfig.toml` with `[test] preload = ["./tests/setup.ts"]`
- Fixed `tests/setup.ts`: dynamic `require()` after globals (ES module hoisting issue), `afterEach(cleanup)` for DOM cleanup
- Resolved happy-dom compatibility: `fireEvent` instead of manual `dispatchEvent`, unique text strings per test file

**Test Files Created (11):**
| File | Tests | Covers |
|------|-------|--------|
| `Spinner.test.tsx` | 5 | size, animation, flex-shrink, style merge |
| `Button.test.tsx` | 7 | 4 variants (primary/secondary/danger/ghost), disabled, onClick |
| `EmptyState.test.tsx` | 4 | muted color, font size, custom style, padding prop |
| `ErrorBanner.test.tsx` | 4 | error rendering, empty error, custom style |
| `Toast.test.tsx` | 6 | ok/err styling, auto-dismiss, onDismiss callback, custom style |
| `SectionLabel.test.tsx` | 5 | uppercase rendering, muted prop, custom size, margin, style merge |
| `StatusDot.test.tsx` | 5 | div element, size/color, custom size, flex-shrink, style merge |
| `Truncate.test.tsx` | 6 | span/div/td rendering, truncation styles, title attribute, style merge |
| `InputField.test.tsx` | 5 | placeholder, base styles, style merge, input props, onChange |
| `useAsyncOperation.test.ts` | 9 | loading/error states, run/clearError, setError, error extraction |
| `useToast.test.ts` | 4 | initial state, showToast, clearToast, auto-dismiss |

**Results:** 62 tests, 0 failures, 104 assertions across 11 files.

---

### Iteration 8: Integration Tests (Phase 5)

**Scope:** Verify shared primitives compose correctly in realistic scenarios.

**Integration Test Files Created (3):**
| File | Tests | Covers |
|------|-------|--------|
| `form-composition.test.tsx` | 5 | InputField + Button + useAsyncOperation: render, disable, enable, loading spinner, error display |
| `status-panel.test.tsx` | 5 | StatusDot + SectionLabel + Truncate + EmptyState: section label, empty state, dot colors, truncation, multiple items |
| `notification-flow.test.tsx` | 5 | ErrorBanner + Toast + useToast: save toast, error toast, auto-dismiss, error rendering, empty error |

**Results:** 15 tests, 0 failures, 19 assertions across 3 files.

**Combined Test Coverage:** 77 tests (62 unit + 15 integration), 0 failures, 128 assertions across 14 files.

---

## Success Metrics

| Metric | Before | After (Current) | Target |
|--------|--------|-----------------|--------|
| Hardcoded monospace strings | 48 | 0 | 0 |
| Duplicate panel containers | 8 | 0 | 0 |
| Duplicate error toasts | 5 | 0 | 0 |
| Inline spinners | 2 | 0 | 0 |
| Duplicate ErrorBoundary | 2 | 1 | 1 |
| Duplicate toast notifications | 5 | 0 | 0 |
| Duplicate button styles | 4+ | 0 | 0 |
| Loading state boilerplate | 7+ files | 0 | 0 |
| Duplicate type definitions | 2 | 1 | 1 |
| Internal import path leaks | 22 | 0 | 0 |
| Duplicate textarea styles | 3 | 0 | 0 |
| Duplicate empty state patterns | 4 | 0 | 0 |
| Manual toast dismiss timers | 5 | 0 | 0 |
| `e instanceof Error` patterns | 8 | 0 | 0 |
| Truncate patterns (inline) | 15 | 0 | 0 |
| Section heading patterns (inline) | 13 | 0 | 0 |
| Input field styles (inline) | 4 | 0 | 0 |
| Status dot patterns (inline) | 3 | 0 | 0 |
