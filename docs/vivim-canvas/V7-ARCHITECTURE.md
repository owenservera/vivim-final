# V7 Architecture Spec — Living Canvas (fullstack evolution of `dev-poc/canvas/V6`)

**Status:** Proposed | **Author:** vivim runtime | **Date:** 2026-07-18
**Supersedes:** `dev-poc/canvas/V6` (standalone POC) | **Extends:** `docs/prd-canvas-unified-surface.md` (G1–G6)
**Repo root:** `C:\0-BlackBoxProject-0\vivim-final`

---

## 0. TL;DR

`dev-poc/canvas/V6` is a **Next.js 16 full-stack "Universal Canvas" POC** built independently to the *same* vision as `web/ui`: slot-based, hot-swappable, DB-driven UI ("the interface is data, not code"). It is richer and more ambitious than `web/ui` (~290 src files vs 37) and already implements the resolution model described in `prd-canvas-unified-surface.md`.

**The gap:** V6 has **zero backend integration** — every API route reads its own in-memory `Memory*` stores seeded from hardcoded code. The real backend (`src/server/*`, `src/engines/conceptual-model-service.ts`) already exposes the exact analogues (`/api/conceptual/surface`, `/api/conceptual/resolve`, `/api/canvas/*`). Slot IDs are **byte-identical** to `web/ui/src/ui/slots.ts`.

**V7 = V6 frontend + SDK + contract types, re-pointed at the real vivim-final backend (:9420).** V6's `Memory*` stores and toy engines are replaced by a `vivimBackendClient` that implements V6's `RouteSyncDeps` interface by calling the live API.

---

## 1. Inspection Findings (evidence)

### 1.1 What V6 gets right (reusable as-is)
| Asset | Path | Verdict |
|---|---|---|
| Engine-bag DI | `src/lib/canvas-engine-bootstrap.ts` | Clean singleton, phased (P1→P4), swappable via contracts. **Keep.** |
| Store contracts | `src/storage/contracts/*` (32 stores) | Engines never import impls — matches B2 invariant. **Keep as the bridge interface.** |
| routeSync engine | `src/engines/route-sync.ts` | 6-level resolution tree, decoupled event-bus emit. **Port, but delegate to backend.** |
| Author SDK | `src/sdk/canvas/*` (`defineComponent`/`publish`/`CapabilityBus`/`createUnifiedIO`) | Framework-agnostic, traceId/retry/SSE. **Keep — this is the V7 plugin story.** |
| Shared contracts | `src/shared/{ui-component,canvas-types,route-context}.ts` | `UiComponent`, `SandboxPolicy` (`allowInlineScript:false` P8), `ResolvedSurface`. **Align with backend `shared/`.** |
| Living Canvas | `src/components/canvas/LivingCanvas.tsx` (+ cards, command palette, streaming, HUD) | Rich React. **This is the V7 surface.** |
| SSE forwarder | `src/app/api/canvas/events/route.ts` | WS-substitute for live re-resolve. **Map to backend `canvas-ws.ts`.** |

### 1.2 What must change
1. **No backend calls.** All routes hit `Memory*` stores seeded by `seedCanvasModel()` (hardcoded families/providers in `src/lib/seed-canvas-model.ts`). Prisma schema is the default `User`/`Post` scaffold — **not** the real schema.
2. **Toy engine replicas.** `routeSync` reimplements capability resolution that already exists in backend `ConceptualModelService` (`src/engines/conceptual-model-service.ts:42` `resolveSurface`) + `CapabilitySnapshot`.
3. **Next.js vs Vite boundary.** V6 *is* a server (port 3000, `output: standalone`). Harness (`scripts/start-*.ps1`) expects a static SPA proxied to `:9420`.
4. **`ignoreBuildErrors: true`** in `next.config.ts` — not yet through a real typecheck/lint gate.

### 1.3 Backend parity (already present — the bridge is cheap)
| V6 concept | Real backend | Location |
|---|---|---|
| `resolveSurface(providerId, familyId)` | `GET /api/conceptual/surface?providerId=` | `src/server/conceptual-router.ts:54` → `ConceptualModelService.resolveSurface` |
| `resolveSlot(providerId, familyId, primitiveId, variant)` | `GET /api/conceptual/resolve?...` | `conceptual-router.ts:34` |
| `UiComponent` resolution (4-tier) | `UiComponentStore.resolve(ctx)` | `ConceptualModelService.ts:66` (tier: provider/family/cross-type/system) |
| `cap:canvas:*` plane | `POST /api/canvas/spawn`, `/definitions`, `/instance/:id/mutate`, `/instance/:id` DELETE | `src/server/canvas-router.ts` |
| Live events | `src/server/canvas-ws.ts` | SSE/WS forwarder analogue |
| Slot catalog | `SLOT_IDS` in `web/ui/src/ui/slots.ts` **==** V6 `allSlots` in `seed-canvas-model.ts` | identical 13 slots |

---

## 2. V7 Topology Decision

**Decision: Next.js-on-:3000 + HTTP-to-:9420 (two cooperating servers).**

```
┌─────────────────────────────┐         HTTP (X-Source: canvas)          ┌──────────────────────────┐
│  V7 Canvas (Next.js :3000)   │  ─────────────────────────────────────▶  │  vivim-final backend      │
│  - LivingCanvas UI           │   /api/conceptual/surface                │  (Bun :9420)              │
│  - @vivim/canvas-sdk         │   /api/conceptual/resolve                │  - ConceptualModelService │
│  - routeSync (client mode)   │   /api/canvas/*                          │  - CapabilityResolution    │
│  - vivimBackendClient        │   /api/capabilities/:id/execute          │  - 13 engines              │
│  - SSE ← canvas-ws           │  ◀─────────────────────────────────────  │                           │
└─────────────────────────────┘         SSE / WebSocket events            └──────────────────────────┘
```

**Rationale**
- Preserves V6's fullstack, agent-evolvable nature — an agent iterates on `dev-poc/canvas/V7` without touching `src/engines/`.
- Backend stays the single source of truth (FRONTEND=BACKEND invariant). No second capability engine.
- `next.config.ts` proxy (not Vite) points `/api` → `http://localhost:9420`. No code changes to backend.
- **Alternative rejected:** fold canvas routes into Bun server — would destroy the isolated agent-evolution loop and fight Next's App Router.

**Env wiring (V7)**
```env
# dev-poc/canvas/V7/.env
VIVIM_BACKEND_URL=http://localhost:9420
NEXT_PUBLIC_VIVIM_BACKEND_URL=http://localhost:9420
# DATABASE_URL no longer needed — backend owns the DB
```
```ts
// next.config.ts — add rewrites (replaces Vite proxy)
const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [{ source: '/api/backend/:path*', destination: `${process.env.VIVIM_BACKEND_URL}/api/:path*` }]
  },
}
```

---

## 3. The Contract Bridge (`vivimBackendClient`)

V6's `routeSync` consumes a `RouteSyncDeps` interface (`src/engines/route-sync.ts:40`). V7 implements that **same interface** as a thin HTTP client. Zero changes to `routeSync` call sites.

```ts
// src/lib/vivim-backend-client.ts — implements V6 RouteSyncDeps
import { createUnifiedIO } from '@/sdk/canvas/unified-io-client'

export function createVivimBackendClient(baseUrl: string) {
  const io = createUnifiedIO()
  return {
    // ConceptualModelService analogues
    async resolveSurface(providerId: string, familyId: string) {
      const { data } = await io.get(`${baseUrl}/api/conceptual/surface?providerId=${providerId}`)
      return data.slots as ResolvedSlot[]   // backend ResolvedSlot shape == V6 ResolvedSlot
    },
    async resolveSlot(providerId: string, familyId: string, primitiveId: string, variant?: string) {
      const { data } = await io.get(`${baseUrl}/api/conceptual/resolve`, { query: { providerId, familyId, primitiveId, variant: variant ?? '' } })
      return data.component
    },
    // Capability execution (replaces Memory* stub stores)
    async executeCapability(capabilityId: string, input: Record<string, unknown>) {
      const { data } = await io.post(`${baseUrl}/api/capabilities/${capabilityId}/execute`, input)
      return data
    },
    // Canvas plane
    canvas: {
      list:    () => io.get(`${baseUrl}/api/canvas/definitions`),
      spawn:   (d) => io.post(`${baseUrl}/api/canvas/spawn`, d),
      mutate:  (id, s) => io.post(`${baseUrl}/api/canvas/instance/${id}/mutate`, s),
      dismiss: (id) => io.request(`${baseUrl}/api/canvas/instance/${id}`, { method: 'DELETE' }),
    },
    // SSE subscription (replaces in-process eventBus for cross-tab live updates)
    subscribeEvents: (workspaceId: string) => io.subscribeSSE(`${baseUrl}/api/canvas/events?workspaceId=${workspaceId}`, onEvent),
  }
}
```

**Key mapping rules**
| V6 type | Backend type | Notes |
|---|---|---|
| `ResolvedSlot.tier` | `ResolvedSlot.tier` | identical enum: provider/family/cross-type/system |
| `UiComponent` | `shared/ui-component.js` | same shape; backend owns persistence |
| `RouteContext` | `ConceptualModelService` ctx | providerId+familyId+primitiveId+variant |
| `PlanTier` gating | `CapabilityTierStore` | backend `resolveActions` already does tier gating |
| `canvas:surface:resolved` event | `canvas-ws.ts` | SSE instead of in-process bus |

---

## 4. What Gets Deleted / Kept in V7

**DELETE (replaced by backend):**
- `src/storage/impl/*` (all `Memory*` stores) — backend owns state.
- `src/lib/seed-canvas-model.ts` + `seed-canvas-model-phase2.ts` — families/providers come from backend `ProviderStore`.
- Toy engines that duplicate backend: `conceptual-model-service` (keep as client wrapper only), the in-process `CapabilityEventBus` (replaced by SSE).
- `src/prisma/schema.prisma` (default scaffold) — no longer needed.

**KEEP (the V7 value):**
- `src/components/canvas/*` — LivingCanvas, cards, CommandPalette, DrawerSystem, ZLayerPanel, streaming, HUD, onboarding, RBAC/audit UIs.
- `src/sdk/canvas/*` — the author SDK (hot-swap, publish, CapabilityBus).
- `src/shared/*` — contract types (align field names with backend `shared/`).
- `src/engines/route-sync.ts` — keep engine, switch `RouteSyncDeps` to `vivimBackendClient`.
- `src/app/api/canvas/*` route handlers — keep as the **canvas surface API**, but they now proxy to backend (or are retired in favor of direct rewrite to `:9420`).

**RETIRE:** `web/ui` as the primary surface becomes optional — V7 is the unified surface per `prd-canvas-unified-surface.md` G1. Keep `web/ui` until V7 reaches parity on the chat surface.

---

## 5. Migration Phases (agent-evolvable, each independently shippable)

| Phase | Surface | V6 → V7 work | Backend dependency |
|---|---|---|---|
| **P0** | Topology | Next :3000 + rewrite to `:9420`; `.env`; kill Prisma/memory seed | none (read-only proxy) |
| **P1** | Chat | `vivimBackendClient.resolveSurface` → LivingCanvas renders `chat.*` slots from live backend; `useStreamSlot` → `/api/capabilities/:id/execute` streaming | `conceptual-router`, `capability-router` ✅ exist |
| **P2** | Canvas plane | `canvas/spawn`/`mutate`/`dismiss` proxy; SSE live re-resolve via `canvas-ws` | `canvas-router`, `canvas-ws` ✅ exist |
| **P3** | Docs + Media | Stream `DocumentEditor`/`MediaCard` from backend `document-*`/`media-*` capabilities | verify capability exists; else build |
| **P4** | Agents + Automation | `AgentCard`/`AutomationCard` → `agent:*`/`automation:*` execute | verify capability exists |
| **P5** | Workspace OS | RBAC / Audit / Presence / Templates / ZLayers / Drawers → backend equivalents | build where missing |
| **P6** | Author SDK live | `publish()` writes `CanvasDefinition` rows via `cap:canvas:define` (real persistence, not memory) | `cap:canvas:define` ✅ exists |

Each phase is a self-contained agent task: "Wire V7 `<surface>` to backend `<endpoint>`."

---

## 6. Invariants Preserved
- **FRONTEND = BACKEND** — V7 calls the same `/api/*` shapes as CLI/MCP/agent.
- **Store Contracts (B2)** — V7's `RouteSyncDeps` is satisfied by `vivimBackendClient`, never by impls.
- **One Entry Point** — all actions flow `interpret → capability → execute`.
- **Sandbox P8** — `SandboxPolicy.allowInlineScript` stays hard-coded `false`.
- **Cross-surface parity** — identical `SLOT_IDS` → `bun run devops verify-cross-surface` passes for canvas surface.

---

## 7. Open Questions (for human)
1. **Auth:** V6 has no auth; backend `auth-gate.ts` exists. Does V7 pass a `userId`/`session` from the browser, or run canvas as a trusted local surface?
2. **Where does V7 live?** `dev-poc/canvas/V7` (keeps POC separation) vs promoted to `web/canvas` (first-class surface). I recommend `web/canvas` once P1 ships.
3. **`web/ui` retirement** timing — keep both until P2, then cut over.

---

## 8. Next Agent Action
Start **P0 + P1**: create `dev-poc/canvas/V7` from V6, add `next.config.ts` rewrites to `:9420`, implement `vivimBackendClient`, and render `chat.*` slots from `GET /api/conceptual/surface`. This proves the bridge end-to-end with one surface before scaling.
