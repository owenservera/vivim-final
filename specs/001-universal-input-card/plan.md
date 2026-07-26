# Implementation Plan: Universal Atomic TextEntryBox + Pluggable Capability Drawer

**Branch**: `001-universal-input-card` | **Date**: 2026-07-26 | **Spec**: `specs/001-universal-input-card/spec.md`

---

## Summary

Replace the monolithic `Composer.tsx` input area with an atomic `TextEntryBox` + `SendButton` (the minimal unit), wrapped in a `ComposerShell` that accepts pluggable add-ons (model selector, capability chips, streaming bar, footer hints, quote bar, attachments). The shell receives a `ComposerInstanceScope` identifying its workspace/surface/region/Z-layer role context. Each instance persists add-on config per-instance in localStorage.

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: React 18/19, Next.js 16 (frontend)
**Storage**: localStorage (add-on config persistence)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Browser (frontend components)
**Linter/Formatter**: Biome
**Convention**: CSS variables (`var(--bg)`, `var(--accent)`, `var(--text)`, `var(--border)`) — no Tailwind

**NEEDS CLARIFICATION**:
1. Does `scope.behavior = 'search' | 'execute' | 'prompt' | 'command' | 'comment'` submit need real action dispatch (e.g. capability events) or just stub for now? → **Stub for now, real dispatch in follow-up.**
2. Should `ComposerInstanceScope` be passed from the parent `Composer` component's workspace context or read from a React context? → **Pass as prop from parent; React context for deeply nested add-ons.**
3. Are there existing `ZLayerId` usage patterns in the frontend that determine which layer a composer mounts in? → **Z-layer is determined by the parent slot's context; composer always mounts in the layer its region specifies.**

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: NO CDP code in this feature (pure frontend React components)
- [x] Store Contracts: No storage engines touched — add-on config via localStorage only
- [x] One Entry Point: New operations (text submit) go through existing `sendMessage()` API
- [x] Custom errors: No engine errors introduced; all errors are UI-level (empty text, failed send)
- [x] TypeScript strict: All interfaces typed with `interface`, no `any`
- [x] Tests: Unit tests for add-on registry + integration test for shell rendering
- [x] FRONTEND = BACKEND: `ComposerInstanceScope.behavior` maps to capability slugs at integration time
- [x] CSS variables: All styles use `style={{}}` + `var(--*)` — no Tailwind

## Project Structure

```
specs/001-universal-input-card/
├── plan.md                # This file
├── research.md            # Phase 0 — unknowns resolved
├── data-model.md          # Phase 1 — entity relationships
├── quickstart.md          # Phase 1 — validation guide
├── contracts/             # Phase 1 — interface contracts
├── spec.md                # Feature specification
└── tasks.md               # Phase 2 — implementation tasks
```

### Source Files to Create

```
frontend/src/components/chat/TextEntryBox.tsx           (~40 lines)
frontend/src/components/chat/SendButton.tsx              (~30 lines)
frontend/src/components/chat/ComposerShell.tsx           (~200 lines)
frontend/src/components/chat/addons/ModelSelectorPill.tsx
frontend/src/components/chat/addons/CapabilityChips.tsx
frontend/src/components/chat/addons/StreamingStatusBar.tsx
frontend/src/components/chat/addons/FooterHints.tsx
frontend/src/components/chat/addons/QuoteBar.tsx
frontend/src/components/chat/addons/AttachmentPreview.tsx
frontend/src/features/composer-addons/registry.ts        (~20 lines)
frontend/src/features/composer-addons/index.ts           (~5 lines)
```

### Source Files to Modify

```
frontend/src/types/api.ts                               Add 9 interfaces
frontend/src/components/chat/Composer.tsx               Wire ComposerShell
frontend/src/ml/ml-boot.ts                              Register new components
```

---

## Complexity Tracking

No constitution violations expected.
