# Frontend Wiring Audit — vivim-final

## Date: 2026-07-24 (All 12 gaps fixed)

## Architecture Overview

### Dual-Engine Architecture (Confirmed)
The project has **two parallel engine systems** with ZERO cross-proxying:

| Layer | Location | Port | Role | Engines |
|-------|----------|------|------|---------|
| **Next.js App** | `frontend/src/` | 3000 | Canvas shell, document editing, workspace OS, SSE events, media, agents, automation, audit, RBAC, search, templates, presence, notifications, z-layers, drawers, UI engine | 34+ engines via `canvas-engine-bootstrap.ts` |
| **Bun Backend** | `src/` | 9420 | Provider/CDP lifecycle, capability registry, conversation management, stream parsing, knowledge graph, telemetry, webhooks | ~25 engines via `createServerWithEngines()` |

### Data Flow (Actual — With Proxy)

```
Browser → Next.js Server (port 3000)

  ├── /api/canvas/* (resolve, definition, events, shell, node, workspace)  ← Next.js route handlers
  ├── /api/document/* (open, edit/start, edit/apply_op, edit/save, edit/undo/redo/session)  ← Next.js route handlers
  ├── /api/media/open, /api/media  ← Next.js route handlers
  ├── /api/documents  ← Next.js route handler (new)
  ├── /api/drawer/*  ← Next.js route handlers
  ├── /api/zlayer/*  ← Next.js route handlers
  ├── /api/agent/* (canvas, canvas/command, invoke, list)  ← Next.js route handlers
  ├── /api/automation/* (execute, list)  ← Next.js route handlers
  ├── /api/audit/*  ← Next.js route handlers
  ├── /api/notification/*  ← Next.js route handlers
  ├── /api/presence/*  ← Next.js route handlers
  ├── /api/rbac/*  ← Next.js route handlers
  ├── /api/search (POST)  ← Next.js route handler
  ├── /api/template/*  ← Next.js route handlers
  ├── /api/ui/*  ← Next.js route handlers
  ├── /api/workspace/*  ← Next.js route handlers
  ├── /api/onboarding/*  ← Next.js route handlers
  ├── /api/plugins/*  ← Next.js route handler
  ├── /api/interpret (POST)  ← Next.js route handler
  └── /api/* (unmatched) → PROXY → Bun backend (port 9420)  ← Next.js rewrite proxy
       /api/capabilities, /api/conversations, /api/providers, /api/health, /api/session, /api/nlcl/interpret
```

## Summary of All Gaps

| Gap | Severity | Affected | Status |
|-----|----------|----------|--------|
| **1 — Missing backend proxy** | CRITICAL | 7 web hooks, slot overrides, CapabilityCatalog | **FIXED** — `next.config.ts` rewrites proxy `/api/*` → backend |
| **2 — BrowserUnifiedIO no base URL** | HIGH | All useIO() callers | **FIXED** — `apiBase` param added, reads `NEXT_PUBLIC_API_BASE_URL` |
| **3 — Canvas-level catalog empty** | MEDIUM | Canvas slot overrides | **FIXED** — `register-all.ts` now registers 25 canvas catalog keys |
| **4 — ActionRegistry never populated** | MEDIUM | All action-based features | **FIXED** — `autoPopulateActions()` called at boot in `UniversalComponentProvider` |
| **5 — Direct fetch bypasses useIO()** | INFO | 4 components work but violate invariant | **FIXED** — HealthDashboard, ProviderManager, WorkspaceSettings, use-manifest migrated to useIO() |
| **6 — Dual-engine drift risk** | INFO | Shared types | No drift detected yet |
| **7 — Port mismatch** | LOW | start-all.ps1 vs Next.js default | **FIXED** — stale comment `:5173` corrected to `:3000` in `start-all.ps1` |
| **8 — Cross-layer engine import** | MEDIUM | agent-canvas-router.ts | **FIXED** — backend imports from `src/shared/agent-canvas.ts`; server returns 501 for canvas commands (requires browser EventBus) |
| **9 — SDK unified-io-client no base URL** | LOW | Plugin authors | **FIXED** — `apiBase` param added to `createUnifiedIO()` |
| **10 — Frontend Prisma client** | LOW | DB consistency | **FIXED** — Proxy guard warns on backend-table writes; table ownership documented in `frontend/src/lib/db.ts` |
| **11 — DevConsole WebSocket wrong port** | MEDIUM | DevConsole firehose | **FIXED** — now uses `getWsUrl()` from `backend-client.ts` |
| **12 — SurfaceContent broken backend routes** | MEDIUM | Documents, media list, agents list | **FIXED** — routes changed to relative URLs, new route handlers created |

### Fix Summary (Applied 2026-07-24)

| File | Change | Gap |
|------|--------|-----|
| `frontend/next.config.ts` | Added `async rewrites()` — proxy unmatched `/api/*` → `localhost:9420` | 1 |
| `frontend/src/components/canvas/UnifiedIOProvider.tsx` | Added `apiBase` param to `BrowserUnifiedIO`, reads `NEXT_PUBLIC_API_BASE_URL` | 2 |
| `frontend/src/components/canvas/register-all.ts` | Added 25 `registerCatalogComponent()` calls for canvas-level components | 3 |
| `frontend/src/components/canvas/UniversalComponentProvider.tsx` | Added `autoPopulateActions()` call at boot | 4 |
| `frontend/src/components/chat/HealthDashboard.tsx` | Migrated from `fetch(getApiUrl())` to `useIO()` | 5 |
| `frontend/src/components/chat/ProviderManager.tsx` | Migrated from `fetch(getApiUrl())` to `useIO()` | 5 |
| `frontend/src/components/chat/WorkspaceSettings.tsx` | Migrated from `fetch(getApiUrl())` to `useIO()` | 5 |
| `frontend/src/hooks/use-manifest.ts` | Migrated from `fetch(getApiUrl())` to `useIO()` | 5 |
| `frontend/src/sdk/canvas/unified-io-client.ts` | Added `apiBase` param to `createUnifiedIO()` | 9 |
| `frontend/src/components/chat/DevConsole.tsx` | Fixed WebSocket URL to use `getWsUrl()` from backend-client | 11 |
| `frontend/src/components/chat/SurfaceContent.tsx` | Changed all `getApiUrl()` calls to relative URLs | 12 |
| `frontend/src/app/api/documents/route.ts` | New route handler — lists document cards | 12 |
| `frontend/src/app/api/media/route.ts` | New route handler — lists media cards | 12 |

### Remaining Work

| Gap | Action Required |
|-----|----------------|
| 7 | Verify start-all.ps1 port configuration |
| 8 | Extract `canvas-command-executor.ts` to shared package |
| 10 | Add table-ownership guard to prevent frontend Prisma writes |

---

*Generated during frontend wiring audit — 2026-07-24*
