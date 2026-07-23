# Feature Spec: V8 Canvas UI Vision — Gap Closure

**Created:** 2026-07-22
**Priority:** P0 (Critical)
**Category:** Frontend / Canvas

---

## Problem Statement

The V8 harvested source (`web/ui-backup/src/features/canvas/`) contains 25 working files with real UI implementations. The current frontend (`web/ui/src/components/canvas/`) was partially migrated but has **ALL 13 slot defaults returning `null`** — zero usable chat UI exists. Additionally, 10 major V8 features were dropped during migration, and 7 backend API endpoints are missing.

## Goals

1. **Restore visible UI:** Port V8's `StreamingSlot.tsx` and `ResultSlot.tsx` to fill the 13 null defaults
2. **Restore dropped features:** MinimapNode, ErrorBoundary, onboarding flow, frontend designer, useUiSlots
3. **Close backend gaps:** Add missing API endpoints (manifest, stream-blocks, capability claims)
4. **Restore event system:** Wire node-level WS events (spawned, dismissed, moved)
5. **Maintain invariants:** All work must satisfy B1-B10, P1-P9

## Non-Goals

- Rewrite the entire canvas from scratch
- Change the backend architecture
- Modify the Prisma schema
- Add new providers

## Requirements

### R1: Slot Content (Critical)
- **As a user** I want to see actual content in chat slots, not empty shells
- **Current:** All 13 `chat.*` slot defaults return `null`
- **Target:** Each slot renders its content via `StreamingSlot` or `ResultSlot`
- **Acceptance:** User sees chat messages, composer, sidebar — not blank canvas

### R2: Minimap (Important)
- **As a user** I want a minimap showing all canvas layers with viewport tracking
- **Current:** No minimap exists
- **Target:** Scaled-down view with click-to-jump, auto-hide at zoom > 50%
- **Acceptance:** Minimap visible at zoom < 0.5, click navigates

### R3: ErrorBoundary (Important)
- **As a user** I want graceful error states when a layer fails
- **Current:** No error boundary — broken layers crash the canvas
- **Target:** ErrorBoundary wraps each layer, shows "Reload Component" button
- **Acceptance:** Broken layer shows error state, not white screen

### R4: Onboarding (Important)
- **As a new user** I want a guided first-run experience
- **Current:** No onboarding
- **Target:** WelcomeOverlay → FirstRunWizard → FeatureTour
- **Acceptance:** First-time user sees wizard, can skip

### R5: Capability Slot Claims (Important)
- **As a capability** I want to claim UI slots for rendering
- **Current:** No `useUiSlots` equivalent
- **Target:** Capabilities can declare `uiSlots` claims, applied to registry on mount
- **Acceptance:** Capability with `uiSlots` overrides default component

### R6: Frontend Designer (Nice-to-have)
- **As a power user** I want to design new layers from within the canvas
- **Current:** Backend `CanvasDesigner` exists but no frontend UI
- **Target:** HTML/CSS/scriptUrl editor with live preview
- **Acceptance:** User can create and publish a layer from the canvas

### R7: Live Manifest (Nice-to-have)
- **As an oracle** I want a live manifest of what's mounted
- **Current:** `useManifest` dropped, no API endpoint
- **Target:** `GET /api/canvas/manifest` + `useManifest` hook
- **Acceptance:** Manifest reflects current canvas state in real-time

## Constraints

- Must use existing `UIComponentRegistry` (universal-registry.ts)
- Must use existing `ContentBlock` types (stream-blocks.ts)
- Must use existing `useStreamSlot` for streaming (not V8's polling)
- Must use SSE for events (not V8's WS — current architecture)
- Must satisfy all invariants (B1-B10, P1-P9)

## Out of Scope

- Changing the backend canvas engine
- Modifying the conceptual model service
- Adding new providers or capabilities
- Changing the WebSocket transport
