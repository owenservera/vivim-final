# CLI vs Actual Codebase — Deep Inspection Gap Report (v2)

**Date:** 2026-08-10 (session updated under compaction risk)
**Scope:** Identify major areas where the CLI has not been upgraded relative to the actual codebase.
**Contract under test:** "This platform is intended to be completely runnable via CLI, as capable as via frontend and vice versa." (One Entry Point / v10 invariant: every operation is a `UnifiedCapability`; CLI + frontend are thin shells over `POST /api/interpret` -> `POST /api/capabilities/:id/execute`.)

---

## Method

1. Read the CLI implementation (`src/cli/index.ts`, `command-registry.ts`, `registry-bridge.ts`, `builtins.ts`).
2. Booted the real engine layer (`bootstrapEngines`) and dumped the **true runtime registry** — 114 capabilities.
3. Enumerated every server router + `routes/*` subrouter endpoint tree (~29 routers, ~130+ endpoints).
4. Diffed router endpoints against the 114 registered capabilities' `apiEndpoint` declarations.
5. Empirically verified the taxonomy-pool loader path in `capability-bootstrap-generated.ts`.
6. Dump artifacts: `.runtime/registry-dump.json`, `.runtime/registry-cli.json`, `.runtime/registry-noncli.json`.

---

## Verdict (one line)

The CLI is a faithful thin shell over the *runtime* registry (114/114 CLI-visible), so the invariant holds for what actually registers — **but the platform's own declared capability surface (3548 pool nodes) and the router/frontend-route subsystem operations are almost entirely NOT registered as capabilities, and therefore NOT reachable via CLI, API, UI, or MCP.** Effective CLI coverage of the declared catalog ≈ **3.2%**. The CLI has not been "upgraded" because the backend surfaces it would expose were never wired into the capability registry.

---

## Ground truth (verified this session)

- **Runtime registry:** 114 caps; ALL on `cli`+`ui`+`api`+`mcp`; `workflow` 106. Categories: cdp 57, agent 9, testing 8, memory 7, llm 6, admin 6, storage 5, conversation 4, ai 3, knowledge 3, telemetry 2, system 2, provider 1, nlcl 1.
- **Declared catalog (pool):** `seeds/taxonomy/pool.taxonomy.json` = 3921 nodes = 3548 capabilities (all `cli`+`ui`+`api`+`mcp`, 3365 `workflow`) + 343 taxonomy terms + 12 tech stack + 11 parsers + 7 protocols.
- **Pool vs registry divergence:** only **2 of 114 runtime slugs exist in the pool** (`conversation_*`/`knowledge_*` names). The pool uses a different id scheme (`cap-001`, `capId: cap:send:message`) and **every pool node has `category: undefined`** — the two catalogs are essentially disjoint.
- **Generated registration:** `registerGeneratedCapabilities()` is called at boot (`src/server/bootstrap/phases/capabilities.ts:323`, comment says "196 caps") but **registers 0** because the pool path is wrong.
- **Boot log:** `[bootstrap-generated] Registered 0 capabilities from taxonomy pool`; `[boot] CDP capabilities: registered=57`; NLCL engine initialized (pattern count disputed, see F6).

---

## F0 — Boot-blocking parse error (already fixed in this session)

`src/server/bootstrap/phases/capabilities.ts` had a working-tree edit adding **trailing commas inside `import(...)` type expressions** (lines ~508-510 and ~545-547) that Bun's parser rejects. This blocked *all* server boots (which is why the registry could not be introspected). Reverted those two lines to the committed form. This is a formatting regression (likely a biome auto-fix applied to `import()` *type* expressions, which do not accept trailing commas in Bun's parser).

---

## F1 — [P0] Taxonomy-pool generated capabilities NEVER register (path bug) — CONFIRMED in code

File: `src/engines/capability-bootstrap-generated.ts:52-60`

```ts
const poolPath = join(import.meta.dir, '..', '..', '..', 'seeds', 'taxonomy', 'pool.taxonomy.json')
```

`import.meta.dir` = `src/engines` → three `..` land in the **project parent**, resolving to `C:\0-BlackBoxProject-0\seeds\taxonomy\pool.taxonomy.json` (does NOT exist). Correct is **two** `..` → `C:\0-BlackBoxProject-0\vivim-final\seeds\taxonomy\pool.taxonomy.json` (exists).

**Impact:** the entire generated surface is dead. Zero generated caps reach CLI/UI/API/MCP.

**Fix:** change `'..'` count 3 → 2 (or resolve from repo root).

### F1b — Even with the path fixed, generated caps would throw
- The handler map in `createHandlerMap()` (lines 82-160) only wires **~15 slugs** (conversation_list/create/send/delete, knowledge_search/ingest/synthesize, memory_query/assert/forget, admin_seed, config_get/set, health_check, system_status).
- Everything else uses `createFallbackHandler()` which **throws `CapabilityNotFoundError`** at execution.
- `extendHandlerMap()` (the escape hatch for real handlers) is exported but **never called anywhere** — dead code.
- So fixing F1 alone surfaces ~196 caps that mostly throw.

---

## F2 — [P0] 139 of 145 router endpoints have NO capability backing → CLI-invisible

Measured: sampled 145 distinct router endpoints across `src/server/*-router.ts` + `src/server/routes/*.ts`. Only **6** are covered by registered cap `apiEndpoint`s (the `conversations`/`health`/`knowledge`/`memory`/`storage`/`admin`/`opencode`/`cdp` sets).

Router-only subsystems (each endpoint tree is unreachable from CLI, MCP, NLCL, and not bound to UI slots):

| Subsystem | Endpoints (examples) |
|---|---|
| Canvas v7 | `/api/canvas/definitions|spawn|resolve|events|observe|manifest|instance/:id|instance/:id/mutate` |
| Agent-Canvas | `/api/agent/canvas/command|policy|plan` |
| Automation | `/api/automate/recipes|roles|run` |
| Autonomous | `/api/autonomous/execute|tasks|gates|search` |
| Chrome | `/api/chrome/factory|reset` |
| Conceptual | `/api/conceptual/families|resolve|surface` |
| Kernel/Oracle | `/api/kernel/oracle/query|scan|heal|visibility|manifest|policy`, `/api/kernel/config/scopes|snapshot|rollback` |
| Mutation | `/api/mutation/apply|preview|history|status|undo|redo` |
| Mux | `/api/route/auto|mux|fanout|cost-report|preferences` |
| Plugins | `/api/plugins|install|:id|:id/upgrade` |
| Nodes | `/api/nodes|alias|rebuild-graph|count` |
| Setup | `/api/setup/workspace|launch-visible|verify|complete|restore|profiles|kill` |
| Template/Variant/Surface | `/api/template|schema|instantiate`, `/api/variant|:id`, `/api/surface|:id|:id/variants` |
| Version/Workspace/Provenance | `/api/version/diff`, `/api/workspace/backup|restore`, `/api/provenance/weights` |
| Storage | `/api/storage/status|progress|move|rollback|cleanup` |
| Webhook | `/api/webhook` (ingress) |
| LLM Harness | `/api/llm-harness/plan`, `/apply`, `/escalate` |
| NLCL | `/api/nlcl/patterns|interpret|session|categories` |
| Generative | `/api/generative/task|task/:id` |
| Conversation extras | `/api/providers|session|health/providers|config/governor|fleet/status|fleet/start|sandbox/debug` |
| Knowledge extras | `/api/knowledge/export|entities|decisions|topics|jobs` |
| Memory extras | `/api/memory/export|import` + memory-viz (`/graph|timeline|stats|curated|curate`) |
| routes/contacts | `/api/contacts|search|lookup|merge|merged|:id` |
| routes/containers | `/api/containers|:id|:id/members` |
| routes/content | `/api/content|search|:id` |
| routes/knowledge | `/api/knowledge/entities|entities/search|entities/:id|topics|topics/search|topics/:id|projects|projects/search|projects/:id|preferences` |
| routes/media | `/api/media|undownloaded|types/:type|:id|:id/download|:id/progress` |
| routes/notifications | `/api/notifications|unread-count|read-all|:id` |
| routes/sync | `/api/sync|pending|progress|error|:id` |
| routes/tunnel | `/api/tunnel/status|config|start|stop|health|p2p/peers|p2p/metrics` |
| routes/update | `/api/update/check|providers|download|install|apply|version|provider/:id` |
| routes/users | `/api/users|current|switch|role|:id` |

**Impact:** directly violates "as capable via CLI as via frontend".

---

## F8 — [P0] Desktop sidecar runs a SECOND routing surface FIRST — CONFIRMED

- `src/desktop/generated-frontend-routes.ts` = **72 frontend App Router paths** compiled to a static table.
- `src/desktop/frontend-route-mount.ts:dispatchFrontendRoute()` runs **FIRST** in the sidecar fetch chain (right after auth gate, `src/server/index.ts:922-932`), before every backend prefix router.
- Frontend-bag-only subsystems the CLI knows nothing about: **document editing** (`/api/document/edit/start|session|apply_op|save|undo|redo`, `/api/documents`, `/api/document/open|filetypes`), **canvas shell/node stream** (`/api/canvas/shell|node/stream|node/:id/execute|workspace/switch`), **drawer** (`/api/drawer/*`), **zlayer** (`/api/zlayer/*`), **rbac** (`/api/rbac/check|grant|revoke|roles|members|update_role`), **presence** (`/api/presence/cursors|list`), **onboarding** (`/api/onboarding/*`), **notification** (`/api/notification/*`), **audit** (`/api/audit/export|list|stats`), **automation** (`/api/automation/execute|list`), **help/agent+search**, **media/open**, **plugins/install**, **template/list|instantiate**, **ui/* (blueprint/extend/list/set_property/component/:id/spec)**, **workspace/list**, **search**.
- **Impact:** the desktop build serves real operations the CLI can never reach — a true "CLI not upgraded vs actual codebase" surface.

---

## F4 — [P1] No WebSocket / streaming path in the CLI — CONFIRMED (protocol enumerated)

`src/server/websocket.ts` + `canvas-ws.ts` implement a full WS ↔ EventBus bridge + Agent Command Router:
- `hello` / `hello:ack` (session identity, role `frontend`|`agent`)
- `agent:command` (route to target session), `agent:result`, `agent:discover`, `agent:subscribe` (event-bus subscription), `agent:query_state`, `agent:execute_workflow`
- `subscribe` / `unsubscribe` (entity or topic format)
- `dev:subscribe` / `dev:unsubscribe` (event firehose — SOTA DevConsole)
- `canvas:*` / `bridge:*` frames (CanvasEngine sandbox bridge — live canvas observe/mutate)

The CLI executes capabilities synchronously via HTTP POST and prints final JSON. **It has zero WS client, no SSE streaming, no live event timeline, no canvas observe.** The streaming chat experience (`Composer.tsx`, `MessageBlock.tsx`, `LatencyBreakdown.tsx`) and the DevConsole firehose are frontend-only. Real-time "as capable via CLI" is impossible.

---

## F5 — [P1] CLI bridge / dispatch weaknesses — CONFIRMED in code

File: `src/cli/commands/registry-bridge.ts`

- **`jsonSchemaToZod` (L27-53):** `array` → `z.array(z.any())`, `object` → `z.record(z.any())`. Nested/array inputs cannot be expressed from flags.
- **`argvToInput` (L150-178):** positional args fill required props then remaining props in declared order.
- **`coerce` (L219-225):** boolean = `val === 'true' || val === '1' || val === ''` — **empty string is `true`** (surprising/incorrect).
- **`stripMeta` (L181-188):** drops `json`, `remote`, `auth` flags — a capability input literally named `auth`/`json`/`remote` cannot be set.
- **`executeRemote` (L194-217):** re-fetches `/api/capabilities?surface=cli` on **every** invocation (extra round-trip).
- **`matchCapability` (L127-143):** only scans the **first 4 tokens** and only exact-matches full `cliCommand.name`/aliases — commands deeper than 4 tokens or with different casing cannot resolve.
- **`syncCliFromUnified` (L60-116):** maps `category → subsystem` lossily (conversation→cap-store, admin/system/user→backend, canvas/discovery→extension, everything else→cap-store); alias collisions silently skipped (warn-only).
- **`src/cli/index.ts parseArgs` (L23-56):** `--key value` and `--key=value` supported; a `--key` with no following value yields `''` (which then coerces to `true` for booleans).

### F5b — Concrete: 5 capabilities have nested inputs the CLI cannot express
All 114 runtime caps DO carry `inputSchema` (my v1 dump omitted the field). Exactly **5 caps** have `array`/`object` input props that flag-only string coercion cannot satisfy:
| Capability | Nested input |
|---|---|
| `llm_test_run` | `surfaces: string[]`, `providers: string[]` |
| `ai_execute` | `messages: {role,content}[]` |
| `config_set` | `patch: object` |
| `cdp_network_set_blocked_urls` | `urls: string[]` |
| `nl_interpret` | `ctx: object` |

---

## F6 — [P2] Discovery/parity tooling does not reflect runtime reality

- **NLCL catalog** (`src/engines/nlcl/catalog.ts` + 16 `categories/*.ts` modules): 163+ pattern-object declarations across 17 categories (ai 9, app 2, automation 10, browser 11, canvas 11, channel 8, conversation 6, email 3, file 11, llm 26, memory 4, opencode 16, provider-cap 21, session 6, system 15, workflow 4). The boot log claims "69 command patterns" (older count); a fresh `NLCLEngine({db}).listPatterns()` returned **0** at boot-dump time because the pattern source of truth is the static catalog, not the DB. Counts are inconsistent across boot log / static catalog / DB — this should be reconciled. The CLI `help` builtin does not surface NL patterns; `nl` (`cap:nlcl:interpret`) is the only NL front door.
- `cap:system:capabilities` / `cap:help` enumerate the **runtime registry only (114)** — they cannot see the 3548-node pool (F1) or router-only ops (F2/F8).
- **`scripts/verify-cross-surface.ts` verifies the pool statically, not the runtime registry** — the parity gate PASSES while the runtime is missing ~3500 caps and 139 router endpoints. Deep-scan `cross-surface.ts` scans only `src/engines/*caps.ts` + `capability-bootstrap.ts` with a single-line regex — also misses generated/registrar-registered caps.

---

## F3 — [P1] Runtime registry ≈ 3.2% of the declared catalog (quantified)

- 3548 pool nodes vs 114 registered. Only 2 runtime slugs exist in the pool — the catalogs are disjoint.
- Pool nodes all have `category: undefined`, `id` scheme `cap-001`, `capId: cap:<cat>:<action>`, `apiEndpoint` like `/api/send/send_message` (non-canonical vs runtime `/api/conversations`).
- Even after fixing F1, ~196 caps would register with throwing fallback handlers (F1b). The catalog is broad but shallow: **surface-completeness and handler-wiring are decoupled**. A CLI that exposes all 3548 would surface hundreds of throwing stubs (`createFallbackHandler` → `CapabilityNotFoundError`). CLI parity cannot be claimed until generated caps are both registered AND backed by handlers.

---

## F7 — [P2] Builtin commands are a legacy bypass of the invariant

- `src/cli/commands/builtins.ts` registers `automate`, `moments`, `seed`, `migrate` — raw handlers bypassing the UnifiedCapabilityRegistry.
- `seed`/`migrate` duplicate `cap:admin:seed` (`admin seed`) — two entry points for one op.
- The provider-onboarding UX (`moments *`) and `automate` live entirely in builtins, not capabilities — unavailable to API/UI/MCP surfaces.

---

## Server dispatch order (how the CLI loses)

1. WS upgrade check (`/ws`)
2. Auth gate
3. **Frontend route bag FIRST** (72 paths, desktop build only)
4. Dedicated backend prefix routers (`/api/route/*`, `/api/autonomous/*`, `/api/nlcl/*`, `/api/interpret`, `/api/agent/run` [hand-written, calls `cap:agent:run.handler` directly], `/api/opencode/*`, `/api/automate/*`, `/api/knowledge/*`, `/api/tunnel/*`, `/api/containers/*`, `/api/content/*`, `/api/notifications/*`, `/api/contacts/*`, `/api/sync/*`, `/api/media/*`, `/api/update/*`, `/api/nodes/*`, `/api/storage/*`, `/api/memory/*`, `/api/canvas/*`, `/api/agent/canvas/*`, `/api/capabilities/*`)
5. **Universal apiEndpoint dispatcher** (`src/server/index.ts:1070-1096`) — matches a registered cap's `apiEndpoint` path+method and routes through `registry.execute()`. **Only capabilities that registered with an `apiEndpoint` are reachable here.**
6. Static frontend file serving → conversationRouter fallback.

Consequence: a router-only endpoint (e.g. `/api/contacts/search`) resolves at step 4; a capability-only endpoint (e.g. `/api/ai/execute`) resolves at step 5; the frontend bag shadows both at step 3 in desktop builds. The CLI thin-client only knows step-5 endpoints declared as caps.

---

## Recommended next steps (priority order)

1. **Fix F1** — pool path `'..'` 3 → 2; boot; confirm generated caps register; then decide the catalog contract (runtime 114 vs pool 3548; they are disjoint today).
2. **Capability-ize F2 + F8 subsystems** — wrap the ~29 routers + 72 frontend-bag paths as `UnifiedCapability`s with `cliCommand` + `apiEndpoint` so the CLI thin-shell and universal dispatcher inherit them automatically.
3. **Add WS/streaming CLI path (F4)** — a `--stream`/`ws` mode or a streaming capability the CLI can consume.
4. **Harden `registry-bridge.ts` (F5)** — `--json-input` for nested payloads, correct boolean coercion, meta-flag collision handling, cached introspection, token-depth-unbounded `matchCapability`.
5. **Fix the parity gate (F6)** — verify the runtime registry vs the pool so F1/F2/F8 regressions fail CI.
6. **Retire or capability-wrap builtins (F7)** and unify `seed`/`migrate` behind `cap:admin:*`.

---

## Evidence artifacts

- `.runtime/registry-dump.json` — 114 registered caps (id, slug, category, surfaces, cliCommand, apiEndpoint, ui, uiAction, **inputSchema**, outputSchema, mcpToolName, workflowNodeType, isAsync, requiresConfirmation).
- `.runtime/registry-cli.json` — the 114 cli-surface caps.
- `.runtime/registry-noncli.json` — empty (all caps are cli-surface today).
- `.runtime/crosscheck2.ts` — 145 sampled endpoints → 6 covered / 139 router-only.
- `.runtime/froutesc3.ts` — 72 frontend route-bag paths.
- `.runtime/poolstat.ts` — pool node counts (3548 caps, category undefined, 2/114 overlap with runtime).
- `.runtime/newschema.ts` / `.runtime/nested.ts` — inputSchema coverage (114/114, 5 nested).
- `.runtime/regsamples.ts` — representative cap shapes (inputSchema confirmed present at runtime, dropped by v1 dump).
