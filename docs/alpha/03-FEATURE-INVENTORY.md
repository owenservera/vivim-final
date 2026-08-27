# Vivim Feature Inventory — Code-Grounded Status

> Verified against source 2026-08-26. Every entry cites its code home.
> Status legend: **WORKING** · **CONDITIONAL** (needs setup/config) · **EXPERIMENTAL** · **GAP**

This is the master reference the Codex wiki articles project from (see [01-THE-CODEX-WIKI-SPEC.md](01-THE-CODEX-WIKI-SPEC.md)).

---

## 1. Desktop Shell & Install

| Feature | Status | Evidence |
|---|---|---|
| NSIS installer, per-user, no admin | WORKING | `src-tauri/tauri.conf.json:52-57` (`installMode: currentUser`) |
| Sidecar backend, loopback-only | WORKING | `src/desktop/sidecar-entry.ts` (127.0.0.1:9421) |
| First-boot DB bootstrap from embedded snapshot | WORKING | `sidecar-entry.ts:99` → `%LOCALAPPDATA%\vivim\cap-store\cap-store.sqlite` |
| Hidden-until-ready window reveal | WORKING | `tauri.conf.json:21` (`visible:false`) + `/readyz` gate |
| UPX-compressed binary (~46 MB lvl-3) | WORKING | AGENTS build pipeline; `scripts/tauri/compile-sidecar.ts` |
| Auto-update | GAP | updater plugin removed in Tauri V2 upgrade — manual reinstall only |
| macOS / Linux builds | GAP | NSIS is sole bundle target |

## 2. Backend Core

| Feature | Status | Evidence |
|---|---|---|
| Phased boot graph (config→stores→engines→caps→routes) | WORKING | `src/server/bootstrap/orchestrator.ts`; invariant-checked (B13) |
| ~30 route families mounted | WORKING | `src/server/index.ts:987-1120` |
| Health/readiness/openapi/swagger | WORKING | `/health`, `/readyz`, `/docs`, `/api/openapi.json` (`index.ts:937-956, 388-424` minimal twin) |
| Trace-ID correlation on every response | WORKING | `index.ts:891-913` |
| WebSocket hub + event forwarders | WORKING | `src/server/websocket.ts`; forwarders registered `index.ts:769-771` |
| Auth gate | CONDITIONAL | `CAP_STORE_AUTH_TOKEN` empty by default = open localhost (fine for alpha; document it) |
| Graceful shutdown hooks | WORKING | `index.ts:157-172` |

## 3. Capability System (the heart)

| Feature | Status | Evidence |
|---|---|---|
| Unified registry, cross-surface (cli/api/ui/mcp) | WORKING | `src/engines/unified-registry.ts` |
| **39 real-handled capabilities** | WORKING | `src/engines/capability-bootstrap/default-caps.ts` — domains: conversation(4), knowledge(3), memory(4), admin(5), system(2), provider-health(1), telemetry(2), agent(1), opencode(8), storage(5), ai-gateway(3+) |
| Generated catalog: 3,548 specs registered | WORKING (as catalog) | `capability-bootstrap-generated.ts:276-330` — every spec discoverable/listable |
| …of which executable | GAP | ~15 handlers in generated map + 39 defaults ≈ **~54 real**; rest return graceful `not_implemented` (`:257-268`) |
| NL interpret endpoint (`POST /api/interpret`) | WORKING | `index.ts:995-997`; NLCL deterministic parser |
| Universal apiEndpoint dispatcher (path→cap fallback) | WORKING | `index.ts:1127-1154` |
| MCP surface bindings declared | PARTIAL | tool names in taxonomy; dedicated MCP server runtime thin |

## 4. Conversations & Streaming

| Feature | Status | Evidence |
|---|---|---|
| Conversation CRUD | WORKING | `src/server/conversation-router.ts` |
| WS message streaming, RAF-batched UI blocks | WORKING | frontend `Composer.tsx`/`MessageBlock.tsx`; forwarder `websocket.ts` |
| Auto-capture as knowledge Nodes (+fork links) | WORKING | `captureAsNode()` in ConversationManager (node-layer v2) |
| Conversation sync endpoints | WORKING | `/api/conversations/sync/*` |

## 5. Provider Chat (CDP browser automation)

| Provider | Parser (DB-seeded) | Status |
|---|---|---|
| Claude | `claude/001_streaming_sse` | CONDITIONAL — needs Chrome + login profile |
| Gemini | `gemini/001_batchexecute` + `002_ai_studio` + generic | CONDITIONAL — Quill composer needs send-button click |
| DeepSeek | `deepseek/001_reasoning_sse` | CONDITIONAL |
| ChatGPT | `chatgpt/001_openai_delta` | GAP — parser targets API format, unvalidated vs live UI wire |
| Qwen / Grok | none | GAP — no parser rows |

Setup cost per tester: install Chrome → log into provider → point Vivim at profile dir
(`chrome-profiles/<provider>/<account>` is canonical source of truth for auth state).
**Recommendation: position as "advanced track", not day-one.**

## 6. Local Agent & AI Gateway

| Feature | Status | Evidence |
|---|---|---|
| Local agent provider (`cap:agent:run`) | WORKING | seeded idempotently at boot (`capability-bootstrap/seed.ts`); route `POST /api/agent/run` (`index.ts:1000`) |
| OpenCode sessions/permissions/models | CONDITIONAL | requires `opencode` CLI present; serve layer off by default (`OPENCODE_SERVE_ENABLED=0`) |
| Daily free-model allow-list sync | CONDITIONAL | `OPENCODE_MODEL_SYNC_ENABLED=1` default on |
| AI Gateway execution layer | EXPERIMENTAL | ships disabled (`AI_GATEWAY_ENABLED=0`); simulator adapter only — no real cloud inference without keys |

## 7. Knowledge, Memory & Graph

| Feature | Status | Evidence |
|---|---|---|
| Knowledge ingestion (multi-source import) | WORKING | `knowledge-router.ts` + KnowledgeIngestionEngine |
| Semantic search | WORKING | SemanticSearchEngine wired in full boot |
| Cross-conversation synthesis | WORKING | synthesizer engine in ctx |
| Memory facts (assert/recall/forget/query) | WORKING | 4 memory caps + `/api/memory/*` viz |
| FSRS-6 spaced-repetition memory nodes | WORKING | recordMemory() emits `cap-store.memory` Nodes |
| Universal node graph (versions, aliases, typed edges, weights) | WORKING | `/api/nodes/*`; NodeVersion/NodeAlias/edge.weight migrations |

## 8. Frontend Experience (Canvas V10)

| Feature | Status | Evidence |
|---|---|---|
| Canvas-first chrome: LivingCanvas + floating panels only | WORKING | `frontend/src/app/page.tsx:1-18` |
| UnifiedEntry single input | WORKING | page.tsx imports; handles palette search (Cmd+K routed here, R2-P2-3) |
| 3 layers: chat / build / admin (`Cmd+1..3`) | WORKING | page.tsx:137-145 |
| Panels dock toggle (`Cmd+.`), DevConsole (`Cmd+`` ` ``), assistant (`Cmd+Shift+H`) | WORKING | page.tsx:122-135 |
| TabBar / SlidePanel / PanelPalette / DrawerSystem | WORKING | components/canvas barrel |
| Themes | WORKING | ThemeSettings |
| Mobile nav + quick-action dock | WORKING | MobileNav, QuickActionDock |
| Stream status pill, update notification banner | WORKING | StreamStatusPill, UpdateNotification |
| Error/loading/not-found boundaries | WORKING | app/error.tsx etc. |

## 9. Onboarding & Help (exists today)

| Feature | Status | Evidence |
|---|---|---|
| First-run detection → GuidedLanding auto-open | WORKING | page.tsx:109-119; `features/guided-landing.tsx` |
| OnboardingTour (returning users) | WORKING | component mounted from canvas barrel |
| Onboarding state API (complete/reset/dismiss/tour/analytics) | WORKING | `app/api/onboarding/*` (7 routes) |
| Help widget: Search / Chat / Tours / Actions tabs | WORKING | `features/help-system/HelpPanel.tsx:35-40` |
| Help search API | WORKING | `app/api/help/search/route.ts` |
| Setup wizard APIs (workspace/profiles/verify/launch-visible) | WORKING | `src/server/setup-router.ts` |

## 10. Experimental Surfaces

| Feature | Status | Notes |
|---|---|---|
| Automation orchestrator (`/api/automate`) | EXPERIMENTAL | wired; recipe authoring UX thin |
| Autonomous execution + policy engine (`/api/autonomous`) | EXPERIMENTAL | routes gated on engines present |
| Canvas engine v7 (layers, oracle visibility, cap executor) | EXPERIMENTAL | in-memory store — resets each boot |
| Generative tasks | EXPERIMENTAL | in-memory store |
| Entity layer: containers/content/notifications/contacts/media/collections | EXPERIMENTAL | store-backed CRUD, light UI exposure |
| RBAC (grant/revoke/check/roles/members) | EXPERIMENTAL | frontend routes exist; backend enforcement partial |
| Plugins (builder routes + sample/demo plugins) | EXPERIMENTAL | plugin-builder-router; frontend/plugins |
| P2P sync / tunnel / ledger (libp2p stack) | EXPERIMENTAL | deps bundled, config-heavy (`VIVIM_P2P_*`, `VIVIM_TUNNEL_*`); do NOT promise to testers yet |

## 11. Known Gaps (say these out loud)

1. **Sandbox hardening mid-migration** — QuickJS spike exists (`.runtime/qjs-spike.ts`), parser sandbox still runs legacy VM path. Not user-visible in alpha scope.
2. **Catalog ≠ product:** 3,548 listed caps vs ~54 executable. The catalog gracefully explains itself (`not_implemented` response includes guidance). Frame to testers as "the map is drawn; roads are being paved."
3. **No telemetry home** — OTEL sink exists but off; feedback is manual (by design for stealth).
4. **Static-analysis debt:** 87 open findings (quality-tier; none alpha-blocking; secrets finding declined by owner).
5. **ChatGPT/Qwen/Grok unusable** this cycle.

## 12. Self-Diagnostics (give to technical testers)

```powershell
# Is the sidecar up?
curl http://127.0.0.1:9421/readyz
# Interactive API docs
start http://127.0.0.1:9421/docs
# Logs
Get-Content "$env:LOCALAPPDATA\vivim\vivim-server.log" -Tail 50
```
