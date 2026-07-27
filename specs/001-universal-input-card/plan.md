# Implementation Plan: Universal Atomic TextEntryBox + Pluggable Add-On System

**Branch**: `001-universal-input-card` | **Date**: 2026-07-27 | **Spec**: `specs/001-universal-input-card/spec.md`

**Input**: Feature specification from `specs/001-universal-input-card/spec.md`

## Summary

Replace the monolithic `Composer.tsx` input area with a pluggable `ComposerShell` architecture: an atomic `TextEntryBox` (auto-resizing textarea), a `SendButton`, and a system of registered add-ons (model selector, capability chips, streaming bar) toggled via a gear menu. Each shell instance knows its workspace/surface/Z-layer identity via `ComposerInstanceScope`. No backend changes required — all work is frontend-only React.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: React 18/19, existing `Composer.tsx` (parent), `MessageBlock.tsx`, styled-components or inline CSS variables
**Storage**: localStorage (`vivim:composer-addons:{instanceId}`) — no backend/DB for add-on config
**Testing**: Bun test runner (`bun test`) + React Testing Library for component tests
**Target Platform**: Windows (PowerShell 7+), frontend served by Next.js dev server
**Project Type**: Frontend-only React feature (backend untouched)
**Linter/Formatter**: Biome
**Build**: Next.js (frontend) / tsup (backend)

**Performance Goals**:
- TextEntryBox + SendButton render in under 100ms cold mount (SC-001)
- Add-on toggles must not trigger full shell re-render (SC-002)
- No regressions in existing send flow (SC-003)

**Constraints**:
- FR-008: CSS variables + inline styles only — no Tailwind
- FR-005: localStorage keys scoped to `instanceId` per shell instance
- FR-009: ContentPart normalization from backend → legacy `{kind, content, index}` for MessageBlock
- FR-010: ML prerouter `classify()` called on every submit before sending
- Frontend dir is `frontend/` (not `web/`)

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: no engine imports BunCdpClient (frontend-only feature — N/A)
- [x] Store Contracts: no new storage contracts needed (localStorage-only)
- [x] One Entry Point: no new operations needed (UI-only enhancement)
- [x] Custom errors: no engine code involved
- [ ] TypeScript strict: no `any`, `type` imports, `.js` extensions
- [ ] Tests: unit + integration + typecheck + lint gates
- [x] FRONTEND = BACKEND: new add-ons use capability slugs, not hardcoded conditionals
- [x] No provider conditionals in UI code (CSS variables only)

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., raw SQL] | [performance-critical path] | [why Prisma query insufficient] |
