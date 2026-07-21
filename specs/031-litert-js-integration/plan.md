# Implementation Plan: LiteRT.js In-Browser ML Substrate

**Branch**: `031-litert-js-integration` | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/031-litert-js-integration/spec.md`

## Summary

Add a **host-canvas ML substrate** powered by Google LiteRT.js (`@litertjs/core`) that runs `.tflite` models in-browser (Wasm/WebGPU) for three local tasks: (1) re-ranking knowledge-graph search results via local embeddings (RelatedNodes slot), (2) a natural-language pre-router in `Composer`, (3) client-side media captioning in `MediaCard`. LiteRT.js is **forbidden inside `SandboxedNode`** (opaque-origin iframe breaks WebGPU + watchdog leaks tensors); it runs in the host canvas and is exposed to sandboxes only via `CapabilityBus` as `cap:ml:*` capabilities.

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / React 19 (Next.js 16 app)
**Primary Dependencies**: `@litertjs/core@0.2.1`, Zustand, React Query (`@tanstack/react-query`), existing `web/ui` canvas SDK
**Storage**: Client-only (Zustand) — no Prisma writes; embeddings computed in-browser
**Testing**: `bun test` (unit for cosine/embed utils), Playwright/Chromatic for UI; frontend lint via Biome/Next
**Target Platform**: Browser (Chromium WebGPU preferred; Wasm fallback). Server runs on Bun but must NOT import `@litertjs/core`.
**Project Type**: Frontend-only feature in `web/ui` (host canvas). No backend engine changes.
**Linter/Formatter**: Biome (repo) + Next/ESLint for `web/ui`
**Build**: `next build` (web/ui); `tsup` for SDK packages

**Performance Goals**:
- RelatedNodes re-rank < 1s on WebGPU after model warm (lazy init + 5s timeout)
- Embedding call < 50ms for a short phrase on WebGPU
- Zero server round-trips for re-ranking / captioning

**Constraints**:
- **No server import**: `@litertjs/core` loaded via `dynamic(import, { ssr:false })` ONLY
- **No sandbox execution**: LiteRT.js runs in host canvas; sandboxes reach ML only via `CapabilityBus` (`cap:ml:*`)
- **One Entry Point**: ML ops are `UnifiedCapability` with `surfaces:['ui']`
- **Slot IDs namespaced**: new slot uses `canvas.related` (per `web/ui/src/ui/slots.ts`)
- **Privacy**: raw text for re-ranking never leaves browser

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] Governor Canon: N/A — frontend-only, no CDP/engine touches. No engine imports BunCdpClient.
- [x] Store Contracts: N/A — no Prisma writes; ML state is client-only Zustand.
- [x] One Entry Point: ML ops registered as `UnifiedCapability` with `surfaces:['ui']`; sandboxes consume via `CapabilityBus` only.
- [x] Custom errors: frontend uses typed error classes / Result; no raw `new Error()` in ML runtime.
- [x] TypeScript strict: no `any`; `type` imports; `.js` extensions where ESM required.
- [x] Tests: unit for `cosine`/`embed` utils + capability registry; typecheck + lint gates in `web/ui`.

## Constitution Check — Post-Design (re-validated)

- All four invariants hold. No Prisma/schema change → no migration. No new engine → no Store Contract surface. New slot `canvas.related` follows the namespaced convention. `cap:ml:*` capabilities follow the existing `surfaces:['ui']` pattern documented in AGENTS.md Unit 24.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (frontend-only additions)

```text
web/
├── ui/
│   ├── public/ml/                       # .tflite weights (embeddinggemma, prerouter, mobilenet)
│   └── src/
│       ├── ml/
│       │   ├── embed-runtime.ts         # createEmbedRuntime / loadModel / embed / cosine (R1-R3,R10)
│       │   ├── media-runtime.ts         # local caption/label runtime (R7)
│       │   ├── prerouter.ts             # NL classification (R6)
│       │   └── ml-store.ts              # Zustand runtime state (R9)
│       ├── sdk/canvas/
│       │   ├── register-slot.ts         # registerSlot('canvas.related', ...) (R4)
│       │   └── capability-bus.ts        # cap:ml:* surface for sandboxes (R8)
│       ├── components/
│       │   ├── canvas/RelatedNodes.tsx  # RelatedNodes slot (R4)
│       │   ├── chat/Composer.tsx        # NL prerouter seam (R6) — EDIT existing
│       │   └── media/MediaCard.tsx      # local caption badge (R7) — EDIT existing
│       └── features/...
└── sandbox/src/                         # consumes cap:ml:* via CapabilityBus (no direct import)

tests/
├── unit/ml/embed-runtime.test.ts        # cosine + embed + fallback
└── e2e/litert-js.spec.ts                # Playwright: RelatedNodes renders re-ranked
```

**Structure Decision**: Frontend-only additions to `web/ui`. No `src/engines`, `storage`, or `server` changes. Model weights in `public/ml/`; runtime code dynamic-imported with `ssr:false`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., raw SQL] | [performance-critical path] | [why Prisma query insufficient] |
