# OPENCODE.md — Agent Context: opencode × vivim

**Purpose.** This is the single source of context for any agent that works on — or runs against —
the opencode integration inside vivim. It is **code-grounded**: every claim was verified against
source and/or the installed binary (opencode **v1.18.4**) in the 2026-08-08 session. If this file
disagrees with a skill, doc, or memory block, this file wins until the code changes.

**Scope.** How vivim launches opencode, keeps its free-model list fresh, exposes it as
capabilities, and how you (the agent) should interact with opencode *through* vivim.

---

## 1. The three execution paths

vivim talks to opencode in exactly three ways. Never invent a fourth without touching this doc.

| Path | Engine / surface | What it does |
|------|------------------|--------------|
| **1. One-shot run** | `LocalAgentProviderExecutor` (`src/engines/local-agent/local-agent-executor.ts`) | Spawns `opencode run --auto --model <m> --format json <prompt>`; parses NDJSON. Drives `cap:agent:run` / `cap:opencode:send`. |
| **2. Long-lived serve** | `OpenCodeClient` + `OpenCodeIngest` (`src/engines/opencode/`) | Talks to `opencode serve` over HTTP/SSE; sessions, permission responses, ingest of streamed blocks. Drives `cap:opencode:session.*` + `cap:opencode:permission.respond`. Env-gated. |
| **3. Model discovery** | `OpenCodeModelSync` (`src/engines/local-agent/opencode-model-sync.ts`) | Spawns `opencode models opencode --verbose [--refresh]`; parses the free tier; persists the allow-list. Drives `cap:opencode:models` / `cap:opencode:model.sync` / `cap:opencode:model.set_default`. |

**Invariant (Governor Canon):** the executor and sync engine spawn the opencode binary directly.
They must never import `BunCdpClient` / touch CDP — that belongs to `ChromeGovernor` only.

---

## 2. Verified binary facts (opencode v1.18.4, 2026-08-08)

These were captured live; trust them over stale docs.

- `opencode --help` writes to **stderr**, not stdout — capturing stdout alone yields empty output.
- `opencode run` is the one-shot runner. Verified invocation (do NOT change):
  `opencode run --auto --model <slug> --format json <prompt>`
  - `-m/--model` is **required** to pass explicitly — it neutralizes a repo `default_agent:build`
    that would otherwise silently select an unauthorized model (e.g. sonnet).
  - `--auto` = non-interactive; `--format json` = NDJSON (one JSON object per line).
  - Resume: `--session <id>` (NOT `--continue`).
- `opencode models [provider]` lists models. Flags:
  - `--verbose` / `-v` → per-model JSON metadata (cost, context, capabilities, release_date).
  - `--refresh` → re-pull the models cache from **models.dev** instead of the local cache.
  - `--pure`, `--print-logs`, `--log-level <DEBUG|INFO|WARN|ERROR>` also exist.
- **Verbose output format:** per model, one bare `opencode/<slug>` line followed by one
  pretty-printed JSON object. The slug line never contains `{`; the JSON block is the next chunk
  of lines. Parse with `parseOpencodeModelsVerbose` in `opencode-model-sync.ts`.
- **Free-tier detection is cost-based**, not name-based: `cost.input === 0 && cost.output === 0`.
  The `-free` suffix alone misses zero-cost models like `big-pickle` (no `-free` in the name).

### 2.1 Serve HTTP API — full contract is live at `GET /doc`

The serve exposes its **entire OpenAPI 3.1 contract at `GET /doc`** (measured 2026-08-08:
**478 KB, 162 paths, 89 event variants**, ~1.1 MB pretty-printed). This is the authoritative
source for every endpoint `OpenCodeClient` depends on — trust it over any hardcoded shape.
A committed snapshot lives at `devops/opencode/contract-snapshot.json` (see ADR-016).

**Dependency surface (what vivim actually calls):**

| Endpoint | Client method | Notes |
|----------|---------------|-------|
| `GET /doc` | `ready()` | readiness; the spec endpoint itself is NOT listed inside its own paths |
| `POST /session` | `createSession()` | body `{ model: {id, providerID} }` → `{ id }` (`^ses`) |
| `GET /session` | `listSessions()` | array of `Session`; `model: {id, providerID, variant}` |
| `GET /session/:id/message` | `getSessionMessages()` | array of `{ info, parts }` (authoritative transcript) |
| `POST /session/:id/prompt_async` | `sendPrompt()` | body `{ parts: [{type:'text', text}] }` |
| `POST /session/:id/message` | `sendMessage()` | body `{ parts }` → `{ info: AssistantMessage, parts: Part[] }` |
| `GET /event?session=:id` | `subscribe()` | SSE; frames are `{id, type, properties}` |
| `POST /session/:id/permissions/:permissionID` | `respondPermission()` | body `{ response: 'once'|'always'|'reject' }` |
| `GET /session/:id/diff` | `getDiff()` | array of `SnapshotFileDiff` |

**Verified schema facts (v1.18.4):**
- `PermissionRequest` / `permission.asked` event: `{ id: ^evt_, type: 'permission.asked', properties: { id: ^per, sessionID, permission, patterns, metadata, always, tool } }`. The `^per` request ID is at **`properties.id`**; top-level `id` is the `^evt_` event ID.
- `permission.respond` / `permission.reply` request body is **`{ response: 'once'|'always'|'reject' }`** — NOT `{ decision }`. The internal Governor vocabulary (`allow`/`deny`/`allow_always`) maps via `mapDecisionToResponse` in `opencode-client.ts`.
- `Message` = `UserMessage` | `AssistantMessage`. `AssistantMessage` has `parentID`, `modelID`, `providerID`, `time.created/completed`; **`UserMessage` has none of those** (only `time.created`). Ingest reading `info.modelID` on a user message gets `undefined` — expected.
- `TextPart`: `{ id: ^prt, sessionID, messageID, type: 'text', text, synthetic?, ignored?, time }`.
- v1 `/event` stream is the `Event` union (89 variants). Relevant to vivim: `message.part.delta`,
  `session.next.text.delta`, `session.idle`, `session.status`, `permission.asked`,
  `permission.replied`, `session.error`, `file.edited`. A separate **v2 API** (`/api/session/*`,
  `/api/event`, `PermissionV2*`) exists but vivim targets the v1 surface.
- `/session` `POST` create body is strictly `additionalProperties:false` — sending `cwd`/`message`
  is ignored (accepted but not part of the schema); only `model` matters for our use.

---

## 3. Current free-model list (as of 2026-08-08, 8 models)

`opencode models opencode` (all 8 are free / zero-cost):

```
big-pickle             Big Pickle              ctx 200000
deepseek-v4-flash-free DeepSeek V4 Flash Free  ctx 200000   ← seed + sync default
laguna-s-2.1-free      Laguna S 2.1 Free       ctx 256000
ling-3.0-tiny-free     Ling-3.0-tiny Free      ctx 262144
longcat-2.0-free       LongCat-2.0 Free        ctx 1000000
mimo-v2.5-free         MiMo V2.5 Free          ctx 200000
nemotron-3-ultra-free  Nemotron 3 Ultra Free   ctx 1000000
north-mini-code-free   North Mini Code Free    ctx 256000
```

- The **seed** (`src/engines/capability-bootstrap/seed.ts`, `LOCAL_AGENT_FREE_MODELS`) is a
  hand-maintained bootstrap of 4 models and goes **stale** (still lists `hy3-free`, which the CLI
  no longer reports). The daily sync is the live source of truth and reconciles this automatically
  (removes `hy3-free`, adds `big-pickle`, `laguna-s-2.1-free`, `ling-3.0-tiny-free`,
  `longcat-2.0-free`, `nemotron-3-ultra-free`).
- `nemotron-3-ultra-free` was deliberately excluded from the old seed (>5 min cold timeout), but
  the sync includes it — it is available for users to select explicitly.

---

## 4. Model sync (the daily refresh)

**Files:** `src/engines/local-agent/opencode-model-sync.ts` (engine),
`src/storage/contracts/local-agent-store.ts` + `src/storage/impl/local-agent-store-impl.ts` (store).

**Flow:** boot → `OpenCodeModelSync.start()` → `syncWhenStale()` (immediate, skips if last sync
< `intervalMs`) → then `setInterval(intervalMs)`. Each sync:
discover (spawn CLI) → filter free → `store.syncAgentModels('opencode', rows)` →
records `models_last_synced_at` in `provider_config`.

**`syncAgentModels` semantics (important — idempotent):**
- Upserts every incoming model row.
- **Deactivates** (`isActive=0`) models the CLI no longer reports — rows are not deleted.
- **Preserves the current default** when it is still present; else falls back to
  `opts.defaultModel ?? first incoming`.
- Rewrites `allowed_models`, `default_model`, and `models_last_synced_at` config keys.
- Because deactivated rows persist, a re-sync after a removal re-reports that slug as `removed`
  again — that is expected, not a bug. Active count is what matters.

**Store methods on `LocalAgentStore` (contract):**
`getAgentProvider`, `getAgentConfig`, `upsertAgentProvider` (seed path), `syncAgentModels`,
`setAgentDefaultModel`, `getAgentModelSyncState`, `isModelAllowed`.

**Config / env:**
| Env | Default | Meaning |
|-----|---------|---------|
| `OPENCODE_MODEL_SYNC_ENABLED` | `1` | `0` disables the background daemon |
| `OPENCODE_MODEL_SYNC_INTERVAL_HOURS` | `24` | daemon cadence |
| `OPENCODE_MODEL_SYNC_REFRESH` | `0` | force `--refresh` (models.dev re-pull) each sync |
| `OPENCODE_SERVE_ENABLED` | `0` | enable the serve/session layer (feature 029) |
| `OPENCODE_SERVE_PORT` | auto | serve HTTP port |
| `OPENCODE_SERVER_PASSWORD` / `OPENCODE_SERVER_USERNAME` | `''` / `opencode` | serve API auth |

Also live in `src/config.ts` under the same names (`config.opencodeModelSyncEnabled`, etc.).

---

## 5. Capabilities (all surfaces: CLI / API / MCP / UI / workflow / NLCL)

Every operation is a `UnifiedCapability`. All opencode/agent caps:

| id | cli | api | mcp | ui |
|----|-----|-----|-----|----|
| `cap:agent:run` | `agent run [--model]` | `POST /api/agent/run` *declared, route TBD* | `agent_run` | `text_input` composer 1 |
| `cap:opencode:send` | `opencode send` | `POST /api/opencode/send` | `opencode_send` | `text_input` composer 2 |
| `cap:opencode:session.create` | `opencode session create [--model]` | `POST /api/opencode/session` | `opencode_session_create` | `action-button` sidebar 4 |
| `cap:opencode:session.list` | `opencode session list` | `GET /api/opencode/sessions` | `opencode_session_list` | `action-button` sidebar 5 |
| `cap:opencode:permission.respond` | `opencode permission --session --permission --decision` | `POST /api/opencode/permission/:id` | `opencode_permission_respond` | `action-button` sidebar 6 |
| `cap:opencode:models` | `opencode models` | `GET /api/opencode/models` | `opencode_models` | `model-list` sidebar 7 |
| `cap:opencode:model.sync` | `opencode models sync [--refresh]` | `POST /api/opencode/models/sync` | `opencode_model_sync` | `action-button` sidebar 8 |
| `cap:opencode:model.set_default` | `opencode model set-default <model>` | `POST /api/opencode/model/default` | `opencode_model_set_default` | `action-button` sidebar 9 |

**Universal execute route (preferred transport for every cap):**
`POST /api/capabilities/:id/execute` with body `{ input: {...}, ctx?: {...} }` →
`src/server/capability-router.ts`. This is the single execution transport; the `apiEndpoint`
column is declarative metadata.

**NLCL:** patterns live in `src/engines/nlcl/categories/opencode.ts` (6 patterns as of
2026-08-08): `opencode.send`, `opencode.session.create`, `opencode.session.list`,
`opencode.models`, `opencode.model.sync`, `opencode.model.set_default`. `permission.respond`
has no NLCL pattern yet.

---

## 6. Handler wiring facts (read before editing capabilities)

- Capabilities are registered in `src/engines/capability-bootstrap/default.ts`
  (`registerDefaultCapabilities`) and gated on `BootstrapServices` fields
  (`src/engines/capability-bootstrap/types.ts`):
  - `cap:agent:run` + the model caps require `localAgentStore`; `agent:run` also needs
    `localAgentExecutor`.
  - `cap:opencode:model.sync` additionally needs `opencodeModelSync`.
  - The serve caps read a **global** handle: `(globalThis as ...).__opencodeServe`
    (set in `src/server/bootstrap/phases/capabilities.ts` when `OPENCODE_SERVE_ENABLED=1`).
- The sync engine is constructed and the daemon started in
  `src/server/bootstrap/phases/capabilities.ts`:
  `new OpenCodeModelSync(localAgentStore, { intervalMs, refresh })` →
  `registerDefaultCapabilities(registry, { ..., opencodeModelSync })` →
  `if (config.opencodeModelSyncEnabled) opencodeModelSync.start()`.
- Seeds run inside `registerDefaultCapabilities`:
  `seedLocalAgentProvider(store)` (in `capability-bootstrap/seed.ts`).

---

## 7. Agent operational guidance

**"User wants to use opencode through vivim" — canonical flows:**
1. Verify state: `opencode models` (reads DB via `cap:opencode:models` — shows `lastSyncedAt`).
2. If stale / models missing: `opencode models sync` (or `--refresh` to force models.dev).
3. Run a task: `agent run "<prompt>" --model opencode/<slug>` (or via NLCL
   `ask opencode to ...` / `opencode: <prompt>`).
4. Pick a default: `opencode model set-default opencode/<slug>`.

**Do / Don't:**
- ✅ Prefer the universal execute route (`POST /api/capabilities/:id/execute`) over hand-written
  CLI/API paths. FRONTEND = BACKEND.
- ✅ Use the verified invocation flags (`--auto --model --format json`); never drop `-m`.
- ✅ Read API/JSON through a bun script (`.runtime/*.ts`), never PowerShell's
  `Invoke-RestMethod | Select-Object | Out-File` pipeline (it silently yields empty files).
- ✅ Await `proc.exited` before reading `proc.exitCode` (`Bun.spawn` returns `null` until then).
- ⛔ Don't hand-edit `LOCAL_AGENT_FREE_MODELS` to "fix" the stale list — the sync reconciles it.
  If you must seed it, derive it from the same discovered list.
- ⛔ Don't add a second model-persistence mechanism. `syncAgentModels` is the only write path.

---

## 8. Gotchas / known issues

**Fixed in the 2026-08-08 session:**
- `OpenCodeClient.respondPermission` body was `{ decision }` — v1.18.4 serve requires
  `{ response: 'once'|'always'|'reject' }`. Fixed via `mapDecisionToResponse` (see §2.1).
- `OpenCodeIngest` had **no `permission.asked` case** in its event switch — permission requests
  were never ingested. Fixed (see §2.1 for the `properties.id` / `^per` extraction).
- `appendDecisionRow` used `ev.id` (the `^evt_` event id) as the `^per` permission id — would 400
  the `^per` pattern. Fixed to `ev.properties?.id ?? ev.permissionID`.

**Still open:**
- `cap:agent:run` declares `POST /api/agent/run` but **no HTTP route serves it yet** (audit F1) —
  the universal execute route works; the convenience route is a known gap.
- `OpenCodePermissionDeniedError` is defined but not thrown (audit F3).
- Timeout skew: store default `120s` vs seed `180s` (audit F8). `OpenCodeModelSync` uses `60s`
  for the models CLI.
- Frontend has zero opencode-specific UI renderers (audit F6) — the `ui` blocks above are
  declared but not rendered; catalog display + composer wiring are pending work.
- **Model resolution gap:** serve `Session.model` is `undefined` when created without an explicit
  model (DB `AgentSession.model=null`). Needs local-agent `config.defaultModel` fallback
  (mirror `local-agent-executor.ts` `input.model ?? config.defaultModel`).
- **`opencode send --session "…"` flag does not map** in the CLI bridge — the flag is
  `--sessionId`. Either pass `--sessionId` or add the alias in `registry-bridge.ts`.
- **Contract drift check not yet implemented.** ADR-016 documents the intent (compare live
  `GET /doc` against `devops/opencode/contract-snapshot.json`, weekly, per-dependency-surface
  PASS/FAIL). No module or devops action exists yet.
- Never run `tsc`/`bun run typecheck` unless explicitly asked (repo guardrail).

---

## 9. Runtime / ops notes (verified live 2026-08-08)

**Boot blocks on the supervisor.** `src/server/bootstrap/phases/capabilities.ts:379` does
`await supervisor.start()` **inside** the boot sequence (nested in the memory-fabric `try`).
The HTTP server does NOT begin listening until opencode serve answers `GET /doc` (up to 90s).
So during a cold boot, `/health` + `/readyz` will time out for up to ~90s — that is expected,
not a hang. The supervisor start also lives *inside* the memory-fabric `try/catch`
(`:368`–`:398`): if any memory-fabric wiring throws before it, the serve layer silently never
starts, and the catch logs the misleading `'Memory fabric wiring skipped'`.

**Orphaned `opencode serve` processes accumulate across sessions.** Multiple prior boots left
`opencode.exe serve --port <n>` processes running with no owning backend (observed ports 3480,
1419, 55221). The supervisor's restart loop spawns a fresh process without always killing the
old one. Before debugging serve, sweep strays:
```powershell
Get-CimInstance Win32_Process -Filter "Name='opencode.exe'" | Where-Object { $_.CommandLine -match 'serve' }
# kill each with taskkill /PID <id> /F
```

**⚠️ CRITICAL — NEVER blanket-kill `opencode.exe`.** `Stop-Process -Name opencode -Force`
(or `taskkill /IM opencode.exe /F`) also kills the **interactive opencode sessions the user and
the agent are running in** (this very conversation). Once experienced: a "cleanup" that ran
`Stop-Process opencode -Force` terminated the live session mid-work. Rules:
- Only ever kill a `bun` PID proven to be our backend (owns the serve port) and an `opencode`
  PID whose **CommandLine matches `serve`** and whose parent chain is our supervisor.
- Kill by PID (`taskkill /PID <pid> /F`), never by image name.
- To identify our serve instances: `Get-CimInstance Win32_Process -Filter "Name='opencode.exe'"`
  and inspect `CommandLine` for `serve` + our auto port; the supervisor handle is exposed
  in-process as `(globalThis as ...).__opencodeServe`.
- The serve picks a **fresh auto port each boot** (observed 14795 → 53409). Never cache a port
  across boots; resolve it from the live serve process or `__opencodeServe` in-process.

**`.runtime/backend.port` can be stale.** In this env the file pointed at `9423` while the live
backend actually listened on `9421`/`9422` (and eventually nothing). Always verify with
`netstat -ano | Select-String "94[0-9]{2}"` + a `/health` probe before trusting the port file.

**Stale backend instances hang health probes.** Two leftover backend processes (PID 9688/10940,
owned 9421/9422) were unreachable — they refused nothing but never answered `/health` either
(20s+ timeout). They also could not be found by `Get-Process`/`Get-CimInstance`, only by
`netstat`. Kill by TCP-listening PID via `taskkill /PID <pid> /F` (it may report "not found" for
zombie listeners — the kernel socket clears on its own).

**CLI/health discovery on Windows:** `opencode --version` → `1.18.4`; `opencode models opencode`
prints the 8 free models (slug line = `opencode/<slug>`, no `{`). All matches §2/§3.

**Restarting the backend cleanly (verified procedure):**
1. Find the backend PID: `netstat -ano -p tcp | Select-String "94[0-9]{2}"` → it owns the port.
2. Kill only that PID: `taskkill /PID <pid> /F`.
3. Sweep only our serve strays (CommandLine `serve`), never image-name opencode (see above).
4. Start with the serve layer enabled:
   ```powershell
   $env:OPENCODE_SERVE_ENABLED = "1"
   $env:OPENCODE_SERVER_PASSWORD = "opencode-test-pw"
   bun run src/server/index.ts
   ```
5. Wait for `/readyz` (serve boot can take up to ~90s — §9 boot note). Use a `bun` script in
   `.runtime/` to read API/JSON; never PowerShell's `Invoke-RestMethod | Select-Object`.
6. Live-verify: probe `GET /doc`, then exercise a permission flow and confirm the POST body is
   now `{ response: ... }` with the `^per` id (not `^evt_`).

**Regression tests for the serve layer (all pass, 2026-08-08):**
`bun test tests/integration/opencode/permission.test.ts tests/unit/engines/opencode-client.test.ts`
→ 11 pass, ~2s. The permission test covers both the legacy and v1.18.4 `permission.asked` shapes.

---

## 10. Related docs

- `docs/audits/local-ai-provider-discovery-2026-08-08.md` — F1–F8 findings this file inherits.
- `docs/plans/opencode-maximal-wiring-plan.md` — the 4-phase wiring plan (model-sync section is
  marked **done**).
- `AGENTS.md` — provider system, capability registry, devops toolkit, PowerShell gotchas.
