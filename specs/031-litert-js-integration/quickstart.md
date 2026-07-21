# Quickstart: LiteRT.js In-Browser ML Substrate

**Feature**: 031-litert-js-integration
**Prerequisites**:
- `web/ui` dev server running (`pwsh scripts/start-frontend.ps1`)
- Chromium with WebGPU (or any modern browser for Wasm fallback)
- `.tflite` weights present in `web/ui/public/ml/` (run `bun run ml:fetch` if missing)

## Validation Scenarios

### V1 — Embedding runtime initializes (host canvas, not sandbox)
1. Open a canvas node.
2. Open devtools console; confirm `createEmbedRuntime` logs `backend: webgpu` (or `wasm` fallback).
3. **Assert**: no `@litertjs/core` import in any `sandbox/` bundle (grep `SandboxedNode` network for `/ml/` → none).

### V2 — RelatedNodes re-ranks locally
1. Focus a node with existing knowledge-graph links.
2. **Assert**: `canvas.related` slot renders top-K with `source: 'local'` badges.
3. **Assert**: zero `/api/knowledge/search` re-calls after first fetch (re-rank is client-side).
4. Kill WebGPU (force `wasm`): slot still renders using `server` order (silent fallback).

### V3 — NL pre-router (heuristic v1)
1. In `Composer`, type a recognized local action (e.g. "switch model").
2. **Assert**: `prerouter.classify()` returns `route: 'local'`, `localActionHits` increments; remote `interpret` is NOT called.
3. Type an ambiguous phrase (e.g. "summarize this").
4. **Assert**: `route: 'remote'`, falls through to `useInterpret()`.

### V4 — Media local caption
1. Select an image in `MediaCard`.
2. **Assert**: "local caption" badge appears with MobileNetV2 labels; no server upload for labeling.

### V5 — Capability surface (sandbox consumption)
1. From a `SandboxedNode`, dispatch `cap:ml:embed` via `CapabilityBus`.
2. **Assert**: response `{ vector: number[] }` returned; no direct `@litertjs/core` import in sandbox.

## Commands
```powershell
pwsh scripts/start-frontend.ps1
bun run ml:fetch            # fetch .tflite weights into public/ml
bun test tests/unit/ml      # cosine/embed utils + fallback
# E2E:
bunx playwright test tests/e2e/litert-js.spec.ts
```

## Exit Criteria
- V1–V5 pass; `next build` succeeds; no `tsc`/`lint` regressions in `web/ui`; no server-side `@litertjs/core` import.
