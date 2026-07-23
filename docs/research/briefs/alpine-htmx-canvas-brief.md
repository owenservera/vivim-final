# Alpine.js + HTMX for Canvas UI — Brief

**Source:** [full report](../reports/alpine-htmx-canvas-sota-2026.md)
**Confidence:** Medium | **Sources:** 18 | **Date:** 2026-07-23

## TL;DR

Alpine.js (~15KB) + HTMX (~14KB) is a proven ~31KB stack for server-rendered interactive UIs with SSE streaming. Real-world migrations show 76% faster TTI and 95% smaller bundles vs React SPAs. **However, vivim-final's chat canvas is too complex for a full migration** — bidirectional WebSocket, RAF-batched rendering, 25+ Radix UI components, Zustand/TanStack state, and Chrome layer integration all resist HTMX patterns. The realistic path is **hybrid islands**: HTMX for admin/CRUD surfaces, keep React for the chat canvas.

## Key Decisions

1. **Do NOT migrate the chat canvas to HTMX+Alpine.** The canvas uses bidirectional WebSocket streaming, RAF-batched rendering at 60fps, provider-specific DOM selectors, and deep React component integration. HTMX SSE is unidirectional and cannot replace this without a full rewrite with significant regression risk.

2. **DO consider HTMX for admin surfaces.** Health dashboard, provider management, settings, and conversation list are CRUD-heavy, server-rendered, low-interactivity pages — perfect HTMX candidates.

3. **Alpine.js is viable for lightweight UI state anywhere.** Theme toggle, sidebar, modals, dropdowns — these work in both React and Alpine. Could be used in HTMX admin pages.

4. **The Bun backend can serve HTML fragments.** Add `text/html` responses alongside existing JSON APIs. No architectural conflict with the 13-engine system.

## Evidence Summary

- **Botmonster (2026):** HTMX+Alpine totals 31KB gzipped vs React's 200-500KB typical bundle. No build step required.
- **Markaicode benchmark (2025):** HTMX FCP 0.8s vs React 1.2s; TTI 1.1s vs 2.3s; memory 24MB vs 56MB.
- **Yogeshkrishnanseeniraj (2026):** Three Django+React → HTMX+Alpine migrations: 76% faster TTI, 53-59% code reduction, 47-55% velocity gains.
- **Etienne (2025):** Complete ChatGPT clone with HTMX SSE streaming in <200 LoC using FastAPI.
- **Hugo (2026):** Production Alpine.js state machine pattern for LLM streaming with cancel support, RAF buffering, thinking states.
- **Abrarqasim (2026):** "If the page is a live editor, a chat surface, a canvas, or anything with a lot of client state, keep using React."
- **mpiorowski (2025):** Complete HTMX+Alpine+SSE component library (modals, drawers, toasts, SSE) with Go/Templ.

## Open Questions

1. **Bun SSE support:** Does Bun's HTTP server support `response.flush()` for SSE streaming? Need to verify with a spike.
2. **HTMX WS extension for Chrome layer:** Could the HTMX WebSocket extension (`htmx-ws`) replace the raw WebSocket connection to ChromeGovernor? Unlikely — the WS protocol is custom binary, not HTML-over-wire.
3. **Partial migration scope:** Which specific admin pages would benefit most from HTMX? Need to audit `web/ui/src/` for CRUD-heavy pages vs interactive canvas components.

## Integration Assessment (Full Audit)

**Source:** [integration assessment](../reports/alpine-htmx-integration-assessment-2026.md)

### Component Compatibility Summary

| Compatibility | Count | Components |
|--------------|-------|------------|
| **HIGH** | 4 | ConversationList, HealthDashboard, ProviderManager, WorkspaceSettings |
| **MEDIUM** | 4 | CapabilityCatalog, ChatSidebar, SurfaceTabs, ChatHeader |
| **LOW** | 8 | Composer, MessageBlock, DevConsole, LatencyBreakdown, StreamingIndicator, CommandPalette, OnboardingTour, QuickActionsMenu |
| **NONE** | 56+ | LivingCanvas, CanvasNode, ConnectionLayer, AgentOverlay, all 48 Radix UI primitives |

### Critical Blockers

1. **`useWebSocket` hook** — Bidirectional WS with topic subscriptions. HTMX SSE is unidirectional. No equivalent.
2. **48 Radix UI primitives** — No HTMX/Alpine equivalent. Would need full rebuild.
3. **RAF-batched streaming** — `Composer.tsx` uses `requestAnimationFrame` for 60fps block flushing. HTMX has no equivalent.
4. **JSON API contract** — Backend returns JSON validated by Zod. HTMX needs HTML fragments.

### Recommended Path

**Hybrid islands architecture:**
- **Phase 1 (6 days):** Migrate HealthDashboard, ProviderManager, WorkspaceSettings, ConversationList to HTMX+Alpine
- **Phase 2 (3 days):** Migrate CapabilityCatalog
- **Phase 3:** DO NOT migrate chat canvas (Composer, DevConsole, LivingCanvas)
- **Phase 4:** Add HTML fragment endpoints to Bun server

### Cost-Benefit

| Metric | Current | After Hybrid |
|--------|---------|-------------|
| Admin page TTI | ~2.3s | ~0.9s (76% faster) |
| Chat page TTI | ~2.3s | ~2.3s (unchanged) |
| Migration effort | 0 | ~9 days |
| Risk | None | Low |

## Used In

- Potential future ADR for frontend architecture evolution
- Canvas UI refinement decisions (frontend-ux-refinement skill)
