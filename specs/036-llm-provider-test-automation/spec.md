# Feature Specification: LLM-Driven Provider Testing & Frontend UX Refinement

**Feature Branch**: `036-llm-provider-test-automation`
**Created**: 2026-07-21
**Status**: Draft

## Problem Statement

vivim-final has 6 providers (gemini, chatgpt, claude, deepseek, qwen, grok) with 3 actively used. The 8-phase onboarding pipeline exists but requires manual agent cycles. The frontend UI has accumulated useful but poorly designed elements ("clobbered") — slot resolution works but renders collide, the setup wizard has no end-to-end test, and provider-specific streaming tests lack an automated LLM-driven loop.

Three distinct problems converge:
1. **Provider testing is manual** — each phase of the 8-phase pipeline requires agent decisions; no automated LLM orchestration ties them end-to-end
2. **Setup wizard untested** — the first-run onboarding flow has zero automated verification
3. **Frontend UI is clobbered** — components work but visual design, layout hierarchy, and slot-registry resolution create a messy UX

## User Stories

### US1 — LLM-Driven Provider Test Pipeline Automation (P1)
**As** a developer,
**I want** the LLM to autonomously drive the 8-phase provider testing pipeline for gemini, chatgpt, and claude,
**So that** provider onboarding and regression testing happens without manual agent cycling.

**Acceptance:**
1. LLM runs `discover-protocol` for all 3 providers — verifies selectors match live DOM
2. LLM runs `infer` parser from real streaming data for each — confidence >= 0.7
3. LLM runs `test-selectors` — every CDP selector validates against live page
4. LLM runs `test-parse` — all wire formats parse correctly (SSE for chatgpt/claude, batchexecute for gemini)
5. LLM runs `test-cap` — each provider's `send_message` capability resolves via `/api/capabilities/:id/execute`
6. LLM runs `test-frontend` — each provider renders correctly in the canvas UI
7. LLM runs `verify` — CLI/API/MCP/UI all resolve for each provider
8. LLM runs `converge` — no drift from spec
9. Full pipeline outputs a machine-readable report per provider with pass/fail per phase

### US2 — Setup Wizard End-to-End Test (P2)
**As** a developer,
**I want** the LLM to test the first-run setup wizard flow,
**So that** new users can onboard without hitting broken steps.

**Acceptance:**
1. LLM navigates to `localhost:5173` with no DB state
2. LLM identifies the setup wizard entry point
3. LLM steps through each wizard phase (provider selection, profile creation, account auth)
4. LLM verifies each step renders correct components via slot resolution
5. LLM verifies error states (network timeout, invalid URL, auth failure)
6. LLM verifies completion transitions correctly to main chat surface
7. All console errors captured and reported

### US3 — Frontend UI De-Clobber (P1)
**As** a user,
**I want** the frontend to have clean visual hierarchy, consistent spacing, and purposeful layout,
**So that** I can find and use features without visual noise.

**Acceptance:**
1. Every visible element has a defined slot in `web/ui/src/ui/slots.ts`
2. No inline `if (slug === 'x')` branching — all resolution goes through `UIComponentRegistry`
3. CSS variables (`var(--bg)`, `var(--text)`, `var(--border)`, `var(--accent)`) used consistently — no hardcoded colors
4. Layout grid is consistent (sidebar + main + optional overlay) — no absolute positioning leaks
5. Chat messages have proper spacing, alignment, and typography hierarchy
6. Loading/error/empty states exist for all data-driven components
7. Streaming text renders progressively with proper cursor behavior
8. Cross-surface parity: `bun run devops verify-cross-surface` passes with 0 gaps

### US4 — Streaming Test Verification (P2)
**As** a developer,
**I want** the LLM to verify streaming text renders progressively across all 3 providers,
**So that** users see real-time response output without visual jank.

**Acceptance:**
1. LLM sends a message to each provider (gemini, chatgpt, claude)
2. LLM captures screenshots at 500ms intervals during streaming
3. LLM verifies text appears incrementally (not all at once)
4. LLM verifies cursor/indicator shows during streaming
5. LLM verifies completion state (no spinner, no partial rendering artifacts)
6. All console errors during streaming captured

## Functional Requirements

### FR1 — Automated Pipeline Orchestrator
- System invokes each of the 8 phases sequentially for a given provider
- Each phase outputs structured JSON: `{ phase, provider, pass, output, error? }`
- Phase N+1 only runs if phase N passes (fail-fast)
- Full pipeline can be invoked: `bun run devops runtime-test onboard run --provider=<slug> --auto`
- Orchestrator uses the existing `devops/onboard-controller.ts` phases

### FR2 — Provider-Specific Test Fixtures
- Real captured wire-format bodies for all 3 providers in `tests/fixtures/capture/`
- Parser unit tests verify each fixture parses correctly
- Fixtures refreshed when provider HTML structure changes

### FR3 — Slot Audit & Resolution Test
- Every slot in `web/ui/src/ui/slots.ts` has a test verifying it resolves to a component
- Every page/surface has a test verifying its slot tree resolves without fallback gaps
- Audit script: `bun run devops ui-test audit-slots` — reports unresolved slots

### FR4 — Visual Regression Baseline
- Reference screenshots stored in `tests/fixtures/screenshots/`
- LLM-driven visual diff: LLM inspects screenshots and reports discrepancies
- Baseline updated on intentional design changes

### FR5 — Setup Wizard Flow Detection
- LLM detects if DB is empty (no seeded providers)
- LLM identifies the wizard rendering surface
- LLM automates: select provider → configure → launch → verify

## Success Criteria

1. All 3 providers (gemini, chatgpt, claude) pass the full 8-phase pipeline with automated LLM orchestration
2. Setup wizard flow verified end-to-end with screenshots at each step
3. Frontend UI has zero slot resolution gaps — every region resolves a component
4. Frontend UI passes visual inspection: consistent spacing, no hardcoded colors, no `if (slug)` branches
5. `bun run devops verify-cross-surface` passes with 0 gaps
6. Streaming renders progressively for all 3 providers with no console errors
7. `bun run typecheck` passes with 0 errors
8. `bun run lint` passes with 0 warnings
9. All tests pass: `bun test`
10. UI test registry updated for all providers: `bun run devops ui-test record`

## Key Entities

- `ProviderTestSession` — structured result of a full 8-phase pipeline run per provider
- `SlotAuditReport` — per-slot resolution status (resolved / fallback / gap)
- `VisualBaselineEntry` — screenshot + LLM assertion text per user moment
- `SetupWizardStep` — individual wizard phase with resolution and screenshot

## Assumptions

- Backend must be running at `localhost:9420` (default `CAP_STORE_PORT`)
- Frontend must be running at `localhost:5173`
- Provider profiles exist for gemini, chatgpt, claude with valid cookies
- Chrome is available for CDP-based testing (or Playwright bridge)
- The existing 8-phase pipeline (`devops/onboard-controller.ts`) works as-is
- Slot registry (`web/ui/src/ui/registry.ts`) is the single source of truth for UI composition
