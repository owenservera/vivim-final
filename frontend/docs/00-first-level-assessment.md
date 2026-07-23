# First-Level Assessment: Replacing `web/ui` with `frontend/`

**Date:** 2026-07-22
**Author:** opencode-agent
**Status:** Baseline assessment — pre-implementation

---

## TL;DR

**`frontend/` is NOT `web/ui` — they are two different projects sharing ~70% DNA with significant divergence.**

`frontend/` at root is a canvas-first architecture with 30 engines, 19 API routes, plugin system, own Prisma schema, and CLI tooling. `web/ui/` is the production UI with chat surface, WS streaming, ML inference, auth, memory browser, and 14 surface tabs.

The replacement requires careful 3-phase integration, not a swap.

---

## Dimension Comparison

| Dimension | `web/ui/` | `frontend/` |
|---|---|---|
| **package name** | `vivim-ui` | `nextjs_tailwind_shadcn_ts` |
| **Port** | 3000 (5173 in prod scripts) | 3000 |
| **Surfaces** | 14 (chat, docs, editor, media, automation, agents, shell, audit, rbac, templates, zlayers, health, capabilities, memory) | 11 (canvas, docs, editor, media, automation, agents, shell, audit, rbac, templates, zlayers) |
| **Custom engines** | 0 | 30 (adaptive-workspace, agents-builder, annotation, audit, automation, canvas-registry, capability-event-bus, capability-resolution, plugin-hot-reload, plugin-system, etc.) |
| **SDK** | `backend-client.ts` + `sdk/canvas/` (9) + `sdk/web/` (8) | `sdk/canvas/` (11, +2: `hot-reload.ts`, `index.ts`) |
| **Prisma** | None (uses main project's) | Own `prisma/schema.prisma` |
| **Plugin system** | None | `plugins/demo-plugin/`, `plugins/sample-plugin/` + engine files |
| **Hot reload** | None | `sdk/canvas/hot-reload.ts` + `engines/plugin-hot-reload.ts` |
| **API routes** | None (`app/api/` empty) | 19 route directories |
| **CLI** | None | `cli/canvas-scaffold.ts` + `cli/commands/shell.ts` |
| **Actions** | `actions/registry.ts`, `actions/agent-bridge.ts`, `actions/auto-populate.ts` | None |
| **ML** | `ml/` (7 files: capabilities, embed-runtime, media-runtime, ml-boot, ml-store, prerouter) | None |
| **Auth** | `components/auth/LoginPanel.tsx` | None |
| **Memory** | `components/memory/MemoryBrowser.tsx` | None |
| **Canvas components** | 40 files | 36 files (missing 5, extra: `Icon.tsx`) |
| **Chat components** | 16 files (Composer, MessageBlock, CapabilityCatalog, ConversationList, DevConsole, HealthDashboard, etc.) | 0 files |
| **UI primitives** | 48 shadcn files | 48 shadcn files (identical) |
| **Shared types** | 34 files | 33 files (missing `api-config.ts`) |
| **Tests** | vitest + RTL, comprehensive | bun test, route-sync focused |
| **Tauri** | `src-tauri/tauri.conf.json` → `web/ui/dist` | Not configured |

---

## What `web/ui` Has That `frontend` Does NOT

1. **Chat components** — `Composer.tsx`, `MessageBlock.tsx`, `CapabilityCatalog.tsx`, `ConversationList.tsx`, `DevConsole.tsx`, `HealthDashboard.tsx`, `LatencyBreakdown.tsx`, `ProviderManager.tsx`, `SurfaceContent.tsx`, `SurfaceTabs.tsx`, `WorkspaceSettings.tsx` — core frontend UX: WS streaming, conversation management, provider health.
2. **Actions system** — `actions/registry.ts`, `actions/agent-bridge.ts` (agent-addressable UI layer, referenced in invariants).
3. **ML layer** — `ml/` (on-device ML inference with LiteRT).
4. **Auth** — `LoginPanel.tsx`.
5. **Memory** — `MemoryBrowser.tsx`.
6. **Test infrastructure** — vitest, RTL, comprehensive test coverage.

## What `frontend` Has That `web/ui` Does NOT

1. **30 custom engines** — Near-duplicate of `src/engines/` for the frontend domain (canvas layer mounter, registry, capability resolution, plugin system, etc.).
2. **19 API route handlers** — Duplicate/shadow main `src/server/` API. Expose agent/audit/automation/canvas/document/drawer/interpret/media/notification/onboarding/plugins/presence/rbac/search/template/ui/workspace/zlayer endpoints.
3. **Plugin system** — Plugin manifest + hot-reload architecture.
4. **Own Prisma schema** — standalone DB schema.
5. **CLI tooling** — `canvas-scaffold.ts`.

---

## Overlap Analysis

### Identical / Near-Identical (can copy verbatim)

- `components/ui/` — 48 shadcn primitives (byte-for-byte identical)
- `shared/` — 33 of 34 type files identical (missing `api-config.ts`)
- `sdk/canvas/` — 9 of 11 files identical
- `hooks/` — `use-mobile.ts`, `use-toast.ts` identical
- `lib/` — `ulid.ts`, `utils.ts` identical
- `globals.css` — identical
- `layout.tsx` — identical
- `tsconfig.json`, `postcss.config.mjs`, `tailwind.config.ts` — near-identical

### Drifted (need reconciliation)

- `components/canvas/` — 36 vs 40 files. `frontend/` has `Icon.tsx`, missing `CapabilityBar.tsx`, `ErrorBoundary.tsx`, `MinimapNode.tsx`, `RelatedNodes.tsx`, `StreamingIndicator.tsx`
- `shared/` — `web/ui/` has `api-config.ts`, `frontend/` does not
- `sdk/canvas/` — `frontend/` has `hot-reload.ts` + `index.ts` (barrel), `web/ui/` does not
- `lib/` — `frontend/` has 3 extra files (`canvas-engine-bootstrap.ts`, `seed-canvas-model*.ts`)

### Unique to `web/ui/` (must be ported)

- 16 chat components
- 3 action files
- 7 ML files
- 1 auth component
- 1 memory component
- vitest/RTL test setup

### Unique to `frontend/` (must be retained)

- 30 engine files
- 19 API route directories
- Plugin system (manifest + 2 plugins + engine)
- Prisma schema
- CLI tooling
- Seeds

---

## Config References to `web/ui` (Must Be Updated)

| File | Reference | Count |
|------|-----------|-------|
| `scripts/start-frontend.ps1` | `web\ui` | ~8 |
| `scripts/start-all.ps1` | `web\ui` | ~12 |
| `scripts/stop-all.ps1` | "frontend" service | ~2 |
| `scripts/health-check.ps1` | `Test-FrontendHealth` | ~3 |
| `package.json` (root) | `web:build` → `web/ui` | 1 |
| `src-tauri/tauri.conf.json` | `frontendDist: ../web/ui/dist` | 1 |
| `devops/runtime-test/build-frontend.ts` | `UI_ROOT = 'web/ui'` | ~5 |
| `devops/runtime-test/supervisor.ts` | `'web/ui'` cwd | 1 |
| `devops/invariants.ts` | `web/ui/src/actions/*` | 2 |
| `devops/agentic/decomposer.ts` | `web/ui/src/*` | ~20 |
| `devops/audit-code/checks/architecture.ts` | `web/ui/src/actions/registry.ts` | 1 |
| `devops/audit-arch/passes/commands.ts` | `web/ui/src/actions/` | 1 |
| **Total** | | **~61+** |

---

## Complexity Assessment

**Overall Score: 8/10 (High complexity)**

### Risk Factors

1. **Loss of chat surface** — `frontend/` has zero chat components. These must be ported.
2. **Engine duplication** — Both `src/engines/` and `frontend/engines/` exist but serve different domains. Must not collide.
3. **Script hardcoding** — 61+ references to `web/ui` across project config, devops, Tauri.
4. **Divergent shared layer** — Shared types have drifted. `api-config.ts` missing from `frontend/`.
5. **Tauri integration** — Must be reconfigured.

### Mitigations

1. Both are Next.js 16, same deps, same React 19, same shadcn, same Radix.
2. UI primitives are identical — zero risk.
3. Canvas layer is ~90% same code — low risk.
4. Both use `@/` path aliases — no import rewrites needed for shared code.
5. Chat components are self-contained in `components/chat/` — clean port.

---

## Phased Integration Plan (Summary)

| Phase | Scope | Risk | Duration |
|-------|-------|------|----------|
| **Phase 1: Core Convergence** | UI primitives, shared types, canvas layer, config wiring | Low | 2-3 hours |
| **Phase 2: Feature Porting** | Chat surface, actions, ML, auth, memory | Medium | 4-6 hours |
| **Phase 3: Wiring & Cleanup** | Script migration, Tauri, test migration, old dir cleanup | Medium | 3-4 hours |

**Total estimated effort: 9-13 hours**
