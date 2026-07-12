# vivim-canvas v7 — Atomic Tracker

> **Status:** ACTIVE — canonical plan for the vivim-home canvas rebuild.
> **Supersedes:** `docs/atomic-v3/phase-03-html-canvas/` (3.1–3.13), which is
> absorbed and *elevated* here into the oracle home + infinite composable layers.
> **Source of truth:** `docs/vivim-canvas/00-vision-and-philosophy.md`
> **Implementation root:** `src/canvas/` (barrel `src/canvas/index.ts`)
> **Design doc:** `docs/vivim-canvas/integration-source/` (read-only integration surface)

**Total units:** 12 | **Done:** 10 | **In progress:** 2 | **Blocked:** 0

## Principles (from the vision — non-negotiable)

| # | Principle | Guardian engine |
|---|-----------|------------------|
| P1 | Frontend is *data*, not *code* (published rows, no build step) | CanvasRegistry |
| P2 | Shell is dumb; layers are smart | LayerMounter / CanvasEngine |
| P3 | On-demand, never all-at-once | LayerMounter |
| P4 | Oracle mode: global access, global visibility | OracleReader |
| P5 | Agentic-native: every canvas op is a capability | CanvasAgentTools |
| P6 | Configurable by (closed) primitives | CorePrimitiveRegistry |
| P7 | Governor Canon holds (canvas never touches CDP) | SandboxBridge (executor contract) |
| P8 | Sandboxed by default (no inline script, postMessage bridge) | schema + SandboxBridge |
| P9 | Self-describing, self-modifying (living manifest) | OracleReader / CanvasDesigner |

## Phase v7.1: Core canvas engine (12 units)

- [x] v7.1 — CanvasDefinition model + CanvasStore contract + Prisma models `docs/atomic-v7/v7.1-canvas-store.md`
- [x] v7.2 — CanvasRegistry: describe/register/get/list/update/delete `docs/atomic-v7/v7.2-canvas-registry.md`
- [x] v7.3 — Core primitive set (closed, composable) `docs/atomic-v7/v7.3-core-primitives.md`
- [x] v7.4 — LayerMounter: spawn/mount/bind/dismiss lifecycle (P3) `docs/atomic-v7/v7.4-layer-mounter.md`
- [x] v7.5 — Sandboxed CapabilityBridge: postMessage capability bridge (P8) `docs/atomic-v7/v7.5-capability-bridge.md`
- [x] v7.6 — CanvasMirror: bidirectional optimistic live mirror (P2/SOTA-01) `docs/atomic-v7/v7.6-canvas-mirror.md`
- [x] v7.7 — OracleReader: global visibility + living manifest (P4/P9) `docs/atomic-v7/v7.7-oracle-reader.md`
- [x] v7.8 — CanvasDesigner: define layers from within the canvas (P9) `docs/atomic-v7/v7.8-canvas-designer.md`
- [x] v7.9 — CanvasAgentTools: canvas ops as UnifiedCapabilities (P5) `docs/atomic-v7/v7.9-canvas-agent-tools.md`
- [x] v7.10 — CanvasEngine orchestrator + core-layer seed `docs/atomic-v7/v7.10-canvas-engine.md`
- [x] v7.11 — Canvas security model: inline-script rejection + sandbox enforcement `docs/atomic-v7/v7.11-canvas-security.md`
- [x] v7.12 — Canvas attach points: HTTP router + WS protocol v2 (P2 attach) `docs/atomic-v7/v7.12-canvas-attach.md`

## How to read these units

Each `v7.N-*.md` follows the atomic format used across the repo:
**Source / Design Doc / Depends on / Produces**, then **Context**, **Existing
Baseline**, **Interface** (with exact file paths + signatures), **Acceptance
Criteria**, **Tests**, and **DevOps Verification**.

Implementation fidelity: every interface in these docs maps 1:1 to a file
under `src/canvas/`. The barrel `src/canvas/index.ts` re-exports all
public types + engines. No engine imports `BunCdpClient` / `chrome-governor`
directly (P7) — mutation flows through the `CapabilityExecutor` contract.

## Open questions carried from the vision (§9)

1. Layer coordinate model — **RESOLVED** in v7: absolute infinite plane (`CanvasLayout.{x,y,z,w,h}`), semantic-zoom threshold per layer.
2. Oracle read contract — **RESOLVED**: `OracleReadProvider.visibility()` aggregates from stores/engines; fanned by the engine.
3. Layer state persistence — **RESOLVED**: instances persist in `CanvasInstance`; dismissed rows keep `dismissedAt` and definition history.
4. Primitive boundary — **RESOLVED**: closed set in `PrimitiveKind` (`workspace|projects|knowledge|agents|providers|conversations`); amend only via `CorePrimitiveRegistry.register` (contract-stable).
5. Designer authoring UX — **PARTIAL**: `CanvasDesigner.publish(preview())` + capability `canvas_define`; visual drag-drop harness is a future harness layer.
6. Cross-layer composition — **RESOLVED**: a layer binds to primitives/capabilities only; scope never leaks because the bridge enforces per-instance sandbox + per-region bindings.
7. Multiplayer/oracle in a team — **DEFERRED**: out of v7 scope; the data model is team-ready (author scoping) but sync is not implemented.

## Next steps

- [x] Implement core engines (v7.1–v7.10) — `src/canvas/*`, tests green.
- [x] Wire `CanvasEngine` into `createServerWithEngines` (v7.12) — attach router + WS. Local-first `InMemoryCanvasStore`; Prisma backing is a follow-up to v7.1.
- [ ] Add Playwright/visual harness for the designer layer (open Q5).
- [ ] Team-oracle sync (open Q7).
