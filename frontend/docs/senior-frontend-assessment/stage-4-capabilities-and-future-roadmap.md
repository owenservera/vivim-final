# Stage 4: Capabilities Preservation & Future Implementation Roadmap

**Location**: `frontend/docs/senior-frontend-assessment/stage-4-capabilities-and-future-roadmap.md`  
**Focus**: Verification matrix ensuring zero capability degradation across 16 providers, MCP tools, living canvas slots, and desktop sidecar packaging + future execution roadmap.

---

## 1. Zero Capability Degradation Verification Matrix

The Vivim platform supports **16 registered providers**, **living canvas slot routing**, **Yjs CRDT state sync**, **MCP tool calling**, and **desktop Tauri sidecar binaries**. All proposed frontend refactorings must pass 100% of the following verification checks:

| Capability Surface | Key Verification Criteria | Pass Criteria |
| :--- | :--- | :--- |
| **Provider Streaming** | `chatgpt`, `claude`, `gemini`, `deepseek`, `qwen`, `grok` SSE & batchexecute streams | SSE deltas render character-by-character without UI freeze |
| **Living Canvas Slots** | Dynamic slot resolution for `chat.header`, `chat.thread`, `chat.composer`, `chat.sidebar` | `routeSync` resolves exact node tree without layout collapse |
| **SSOA Layer Switching** | Seamless switching between `chat`, `build`, `admin` layers via UI tab or keyboard | `SessionState` updates `activeLayer` and swaps slot configurations cleanly |
| **DevConsole & Logs** | Full visibility into WebSocket messages, network requests, and system diagnostics | Cmd+` toggles floating console overlay without disrupting active prompt |
| **Desktop Packaging** | Next.js static export for Tauri NSIS installer (`build:tauri`) | `out/` directory generates without SSR dynamic path errors |

---

## 2. Automated & Verification Suite Commands

To verify that the frontend changes retain complete functionality, execute the following commands in sequence:

```bash
# 1. Run unit and route sync test suite
bun test tests/unit/ tests/route-sync.test.ts

# 2. Verify Next.js static export build (Tauri desktop compatibility)
bun run build:tauri

# 3. Verify cross-surface provider registration & CLI/API sync
bun run devops:verify-cross-surface
```

---

## 3. Phased Future Work Roadmap

The future work is structured into **3 execution phases**:

### Phase 1: Core Refactoring & UI State Simplification (Immediate - Week 1)
- Apply `use-canvas-ui-state.ts` to `app/page.tsx`.
- Update `UnifiedEntry.tsx` with integrated layer tabs and contextual action hints.
- Deploy `StreamStatusPill.tsx` to provide visual streaming feedback.

### Phase 2: Canvas Micro-Interactions & Quick Action Dock (Week 2)
- Integrate `QuickActionDock.tsx` into `LivingCanvas.tsx`.
- Refactor `globals.css` visual glassmorphism tokens.
- Add accessible keyboard shortcut indicators across all floating modals.

### Phase 3: Enterprise Surface Polish & Desktop Optimizations (Week 3)
- Optimize `LivingCanvas` quad-tree spatial indexing for large node counts (>500 nodes).
- Enhance offline mode indicator when sidecar process detaches.
- Run complete Playwright E2E suite (`bun run test:e2e`).

---

## Summary of Assessment Artifacts
All assessment reports and specs are saved under `frontend/docs/senior-frontend-assessment/`:
1. [00-master-review-plan.md](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/docs/senior-frontend-assessment/00-master-review-plan.md)
2. [stage-1-architecture-and-ux-audit.md](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/docs/senior-frontend-assessment/stage-1-architecture-and-ux-audit.md)
3. [stage-2-verbatim-refactoring-spec.md](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/docs/senior-frontend-assessment/stage-2-verbatim-refactoring-spec.md)
4. [stage-3-intuitive-interaction-blueprint.md](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/docs/senior-frontend-assessment/stage-3-intuitive-interaction-blueprint.md)
5. [stage-4-capabilities-and-future-roadmap.md](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/docs/senior-frontend-assessment/stage-4-capabilities-and-future-roadmap.md)
