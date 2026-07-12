# Phase 4: Workspace & Agent UI

**Status:** PROPOSED
**Units:** 11
**Depends on:** Phase 3
**Produces:** The user-facing shell that hosts canvases, surfaces the agent's state, and provides the typical local-tool UX (settings, providers panel, memory browser, etc.).

---

## Goal

Phase 3 makes canvases possible; Phase 4 makes them usable. After Phase 4, the user opens vivim and sees a workspace: a flexible layout of panels containing canvases and built-in surfaces. The agent has its own visible surface showing plans, progress, and HITL gates. All the standard local-AI-tool surfaces (conversation list, provider settings, capability palette, memory browser, telemetry dashboard) exist as built-in canvases the user can arrange.

This phase delivers the **PLUS THE TYPICAL UI/UX** portion of the user's objective: a real, usable local tool, not just an agentic sandbox.

---

## Units

### 4.1 WorkspaceManager engine
**Source:** v3 Overview §1.7
**Depends on:** 3.3
**Produces:** `workspace_layout` + `workspace_panel` tables; `WorkspaceManager.{getLayout, setLayout, openPanel, closePanel, rearrange}`.

Layout = ordered tree of panels. Each panel references either a `canvasInstanceId` or a `builtinSurfaceId` (e.g., `conversation-list`, `memory-browser`). Persisted per user. Manager emits `workspace:layout_changed` events.

### 4.2 Workspace default layouts + presets
**Source:** v3 Overview §1.7
**Depends on:** 4.1
**Produces:** 5 layout presets; first-run default.

Presets: `chat` (single conversation), `dual` (two canvases side-by-side), `dashboard` (grid of 4), `agent-monitor` (agent frontend + canvas), `memory-workbench` (memory browser + conversation + canvas). User can save custom presets.

### 4.3 Workspace frontend host (`web/workspace/`)
**Source:** v3 Overview §3
**Depends on:** 4.1, 3.9
**Produces:** The shell React app that hosts panels + iframes for canvases.

Lightweight React (Vite + Zustand). Responsibilities: (a) render layout tree, (b) host built-in surfaces as React components, (c) render canvases in sandboxed iframes with the canvas-runtime injected, (d) drag-and-drop panel rearrangement, (e) WebSocket subscription for layout + canvas events.

### 4.4 Built-in surface: ConversationSurface
**Source:** v3 Overview §3
**Depends on:** 4.3
**Produces:** Conversation list + active conversation view + composer.

Lists conversations grouped by project/topic (from Phase 6). Composer supports text + file upload + capability quick-actions. Integrates with `AgenticConversationLoop` for live progress display.

### 4.5 Built-in surface: AgentFrontendSurface
**Source:** v3 Overview §1.8
**Depends on:** 4.3, 2.11
**Produces:** The agent's visible UI.

Renders: current task/goal header, plan DAG as collapsible tree (per-node status, started/completed timestamps, error), live action log (scrolling), HITL gate prompts with inline buttons (approve/deny/skip), cost/token budget bar, cancel/pause/replay controls. Subscribes to `agent:state_changed`.

### 4.6 Built-in surface: CapabilityPaletteSurface
**Source:** v3 Overview §3
**Depends on:** 4.3, 1.3
**Produces:** Visual capability browser grouped by category and surface.

Lists all registered capabilities (compiled + live + composite) with their metadata. Click to invoke (with input schema form); drag onto canvas to create binding. Search by name, alias, or category.

### 4.7 Built-in surface: MemoryBrowserSurface
**Source:** v3 Overview §3
**Depends on:** 4.3, Phase 6
**Produces:** Browse episodic/semantic/procedural memory; curate facts; trigger consolidation.

Three tabs: Episodes (timeline), Facts (subject-predicate-object table with confidence), Rules (condition-action with success/fail counts). User can pin/verify/hide facts; manually trigger `minePatterns` and `consolidate`.

### 4.8 Built-in surface: ProviderSettingsSurface
**Source:** v3 Overview §3
**Depends on:** 4.3, Phase 5
**Produces:** Manage provider accounts, login state, consent.

Per-provider card: login status, account switcher, consent toggle (for cloud providers in local-first mode), debug port, profile dir, health score, model list with capability flags. "Log in" button spawns visible Chrome via Setup flow.

### 4.9 Built-in surface: TelemetryDashboardSurface
**Source:** v3 Overview §3
**Depends on:** 4.3, Phase 8
**Produces:** Real-time system health + provenance graphs.

Charts: provider health over time, capability success rates, selector drift events, cost burn-down, latency percentiles, agent-loop completion rates. All read-only; drilling down opens ProvenanceInspectorSurface.

### 4.10 Built-in surface: DevopsConsoleSurface
**Source:** v3 Overview §3
**Depends on:** 4.3
**Produces:** In-app devops console.

Read-only view of `bun run devops report` + `devops invariants check` + `devops truth scan`. Shows current unit being worked on (if any), gate status, coverage numbers. Useful for dogfooding.

### 4.11 Workspace agent actions
**Source:** v3 Overview §1.7
**Depends on:** 4.1, 3.13
**Produces:** Agent can open/close/rearrange workspace panels via capability calls.

Capabilities: `workspace_open_canvas`, `workspace_close_panel`, `workspace_set_layout`, `workspace_focus_panel`. Enables Scenario A from the overview (agent says "build me a dashboard" → opens 2 canvases + arranges them).

---

## Acceptance

- First-run experience: user sees a sensible default layout within 2 seconds.
- User can drag panels to rearrange; layout persists across restarts.
- AgentFrontendSurface shows live progress of an autonomous task with sub-second latency.
- CapabilityPaletteSurface lists all registered capabilities (20+ defaults + any live caps from Phase 2).
- All seven built-in surfaces render without errors against a seeded DB.
