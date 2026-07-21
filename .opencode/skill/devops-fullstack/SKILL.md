---
name: devops-fullstack
description: >-
  LLM-driven full-stack dev loop for vivim-final. The agent IS the runtime: launch the
  stack once via PowerShell, then drive backend engines, API routes, DB, and the React
  frontend to a goal — probe via CLI subcommands, verify through the UI last. Use when
  implementing a feature, fixing a bug, or extending a capability across the full stack
  (backend engine + API route + DB + React UI), or for "build X", "add capability Y",
  "fix the broken Z button", "make a new engine".
---

# devops-fullstack — LLM-Driven Full-Stack Dev Loop

**Purpose:** You (the LLM agent) ARE the runtime of the full-stack dev loop for vivim-final.
Launch the stack once via PowerShell, then drive backend engines, API routes, database, and the
React frontend to a goal — interacting through CLI subcommands first, and verifying through the
frontend UI last. Iterate until the goal is met or the budget is exhausted.

> MENTAL MODEL — read this first.
> This is NOT a headless automation script. The `loop` subcommand is only a thin orchestration
> scaffold; the real loop is *you* making decisions between steps. The CLI subcommands are your
> hands; the running servers are your workbench; the browser is your final proof. Servers stay up
> across cycles — launch once, stop once.
>
> This skill is the merger of the former `vivim-runtime` and `devops-fullstack` skills. The name
> `vivim-runtime` implied black-box automation; that model is retired. If you find a `vivim-runtime`
> skill, treat it as a redirect to this one.

## ANTI-HANGUP RULES (never violate)

These rules exist because the dev loop has repeatedly hung the agent in PowerShell. Follow them
literally; each one was learned from a concrete failure.

1. **NEVER start servers in the bash tool.** Always use the non-blocking PS1 launcher:
   - `pwsh scripts/start-bg.ps1` (full stack, returns immediately — no wait loop)
   The bash tool blocks until the command returns; a foreground `bun run serve` never returns and
   burns the whole tool timeout. `start-bg.ps1` uses `Start-Process` internally and exits at
   once — the real launcher runs as a child process. After launching, poll until healthy:
   ```powershell
   pwsh scripts/start-bg.ps1
   # returns immediately; poll later:
   try { Invoke-RestMethod http://localhost:9420/health } catch { sleep 2; retry }
   ```

2. **NEVER invoke PS1 scripts by pipe, -c, -Command, or call-operator.** These methods set
   `$PSScriptRoot` to `$null`, which collapses `Split-Path -Parent $PSScriptRoot` to `$null`,
   making `$projectRoot` empty and breaking ALL downstream paths. Specifically:
   ```powershell
   Get-Content scripts/start-all.ps1 | pwsh -           # BROKEN — $PSScriptRoot = $null
   pwsh -c "scripts/start-all.ps1"                     # BROKEN
   pwsh -Command ".\scripts\start-all.ps1"             # BROKEN
   & "scripts/start-all.ps1"                           # BROKEN (call-operator)
   Start-Process pwsh -ArgumentList "scripts/start-all.ps1"  # BROKEN (nested pwsh)
   pwsh -File scripts/start-all.ps1                    # BROKEN — -File from wrong CWD
   ```
   The ONLY correct invocations are:
   ```powershell
   pwsh scripts/start-bg.ps1           # NON-BLOCKING — returns immediately (recommended)
   pwsh scripts/start-all.ps1          # blocks until services are bound
   ```

3. **NEVER use `bun -e "..."` in PowerShell.** Quoting mangles the JavaScript (PowerShell strips or
   rewrites quotes). Write a `.ts` file and `bun run` it instead.

4. **NEVER use `bun run dev` as a server.** It blocks the tool. Use `start-backend.ps1`.

5. **NEVER hardcode port 9420.** Always resolve the live port via `.runtime/backend.port` →
   `CAP_STORE_PORT` env → default 9420. The launcher auto-falls back to a free port when 9420 is
   held by a zombie socket (a dead PID still LISTENING that `Stop-Process` cannot kill). After launch,
   read `.runtime/backend.port` to learn the real port. The shared resolver is
   `devops/runtime-test/port.ts` (`resolveBackendPort()` / `backendBaseUrl()`); TypeScript clients use
   `getServerPort()` from `src/config.ts`.

6. **NEVER assume the server is on 9420 after launch.** Check `.runtime/backend.port`.

7. **ALWAYS verify before test-driving features:** `bun run devops runtime-test health` (expects
   `database:OK` and `server:OK`).

8. **ALWAYS tear down with `pwsh scripts/stop-all.ps1`** — never kill processes manually.

9. **If the backend won't bind, check `.runtime/backend-out.log`.** A zombie-held port makes
   `bun run serve` fail silently; the launcher reports the fallback port in `.runtime/backend.port`.

10. **Never use `-RedirectStandardOutput`/`-RedirectStandardError` in `Start-Process`.**
    `bun.exe` writing >4KB to a redirected pipe deadlocks the backend launch. Remove the
    redirect — output goes to the terminal directly.

11. **Use `Write-Output` for Log functions, not `Write-Host`.** `Write-Host` goes to stream 6
    which `2>&1 | Select-Object` does not capture. Agent-visible log output must use `Write-Output`.

12. **All shared PS1 helpers live in `scripts/_shared.ps1`.** Dot-source it:
    `. (Join-Path $PSScriptRoot '_shared.ps1')`.

13. **Smoke tests must have client-side timeouts.** `/api/conversations/:id/send` blocks forever
    waiting for CDP. Wrap `fetch` calls with `AbortController` + timeout.

## The Operating Procedure (playbook)

Run these phases in order. Each phase is an agent action, not an automated step.

0. **Acquire the goal (interview-first).** If the user has not stated a concrete goal, use the
   `question` tool to interview: what to build/fix, scope, and mode (autonomous vs. mitm).
   NEVER build without a goal. Never fall back to a hollow placeholder like `hello` — if goal
   interpretation fails, reuse the user's raw goal text or fail loud.
 1. **Launch the stack (once) — non-blocking.** `pwsh scripts/start-bg.ps1`
    - Returns immediately (does NOT wait for servers to bind).
    - Internally calls `start-all.ps1` as a detached child process.
    - After launch, poll `/health` until green, or run `bun run devops runtime-test health`:
      ```powershell
      pwsh scripts/start-bg.ps1
      # Then poll:
      bun run devops runtime-test health
      ```
    - If health fails, read `.runtime/backend-out.log` and fix before continuing.
2. **Preflight.** `bun run devops runtime-test health`
   - Expects `database:OK` and `server:OK`. If not, debug the launch.
3. **Discover the surface.** `bun run devops runtime-test discover`
   - Returns `backendCapabilities[]`, `frontendUrl`, `schemaTables`. Understand what exists
     before changing it. FRONTEND=BACKEND: capabilities are linked to UI by `slug`.
4. **Plan.** Probe the NL resolver: `bun run devops runtime-test test --nl="<restated goal>"`.
   - A 200/ok means the capability already resolves — you may only need UI wiring. A clarification
     or failure tells you what to build. Map the goal to a `cap:<category>:<action>` id + `slug`.
5. **Build (do the real work as the LLM).** See Recipe A/B/C below:
   - Backend: engine → Store Contract → `makeCapability(..., handler)` with `surfaces: ALL_SURFACES`
     → API route (if not covered by `/api/nlcl/interpret` or `/api/capabilities/:id/execute`).
    - Frontend: use the `vivi-frontend` skill — contract-first, generic-first renderer; promote to
      bespoke only on merit. Never hardcode feature logic; render from `ResolvedCapability`.
      For any new region/provider-family UI, prefer the **unified canvas + conceptual model** path
      (see Recipe E) over a new `ChatPage` slot.
   - Database: edit `prisma/schema.prisma` → `bunx prisma migrate dev --name <x>` → update store
     contracts → update seeds if needed.
    - Complete ALL code edits first, then run typecheck/lint/tests once.
      Do NOT run `bun run typecheck` incrementally — later edits will
      invalidate earlier passes. The single gate at the end is faster and
      more reliable.
6. **Verify (CLI).** `bun run devops runtime-test test --nl="..."`, `engage` to drive the adopted
   browser, `debug` to capture console/screenshot. `verify` writes a DOM render-proof to
   `.runtime/screenshots/verify-0.html`. `test-cap --slug=... [--input=JSON]` executes a capability
   deterministically by slug (more precise than NL `test`).
7. **Verify (UI).** Use the project's own CDP automation tools: `engage`, `verify`, `debug` CLI
   commands from `bun run devops runtime-test`. These drive the browser via CDP natively —
   no third-party browser automation needed. Confirm the feature visually. This is the
   final gate — a green API test is not enough.

   **INVARIANT: Do NOT use Playwright.** The project has its own CDP-based browser
   automation (`engage`/`verify`/`debug`). Playwright is explicitly excluded.
8. **Gate.** `bun run typecheck` → `bun run lint` → `bun test` → `bun run devops audit-code standard`
   (P0/P1 findings block). Fix until clean.
   **IMPORTANT:** This gate is the ONLY verification pass — do NOT run
   typecheck/lint/tests during earlier build steps. All edits must be
   complete before this step.
9. **Stop (always).** `bun run devops runtime-test stop` (or `pwsh scripts/stop-all.ps1`) — never
   leave orphan processes. Use `status` to confirm teardown; use `report` to recall the last loop
   outcome across turns.

### Decision points
- Goal ambiguous? → interview again (Phase 0), don't guess.
- Capability already exists? → only wire UI (Phase 7), skip backend build.
- Test fails? → `debug`, read the error, fix in Phase 5, re-verify. Don't loop blindly.
- UI wrong but API green? → frontend renderer issue; use `vivi-frontend` skill, re-verify UI.

## Command Catalog (your hands)

PowerShell launchers (run from repo root):
- `pwsh scripts/start-bg.ps1`                     — NON-BLOCKING: launch backend+frontend, adopt Chrome, return immediately (poll health after)
- `pwsh scripts/start-all.ps1`                    — BLOCKING: launch backend+frontend, adopt Chrome, health-wait
- `pwsh scripts/stop-all.ps1`                     — stop both via PID files + port scan (infallible)
- `pwsh scripts/health-check.ps1 [-Interval 30] [-Once]`  — health monitor (use `-Once` for single check, safe for agent sessions)
- `pwsh scripts/test-selectors.ps1`               — provider selector health (optional, needs Chrome)

CLI harness (`bun run devops runtime-test <subcmd>`):
- `health`            — DB + server preflight, prints `{ok, checks}`
- `preflight`         — raw preflight JSON
- `discover [--offline]` — caps + frontendUrl + schemaTables; `--offline` reads the static
  catalog (no server needed) so you can PLAN before building (closes the chicken-egg)
- `discover-backend` / `discover-frontend` — individual probes
- `discover-cdp [--port=9222]` — CDP protocol methods from live Chrome or catalog fallback
- `discover-protocol <url> [--hint=name]` — **auto-discover read/write protocol** for any provider URL: composer selectors, composer type, send buttons, capture patterns, DOM response selectors, response format. Generates a complete manifest draft. Uses live Chrome CDP. Also available as `bun run devops discover-protocol <url>` (top-level).
- `catalog-gen`       — regenerate the static capability catalog from `capability-bootstrap.ts`
- `test --nl="..."`   — drive one NL command through `POST /api/nlcl/interpret`
- `test-cap <slug> [--input=JSON]` — execute a capability by slug via `/api/capabilities/:id/execute`
- `engage [--provider= --account= --url=]` — attach adopted Chrome, navigate
- `verify [--url=]`   — render-proof to `.runtime/screenshots/verify-0.html`
- `verify-pipeline`   — bootstrap→preflight→discover→verify report
- `selectors`         — run provider selector unit tests
- `debug`             — capture console/errors
- `build [frontend|backend] [--cap=<slug>]` — `build backend --cap=<slug>` emits a compilable
  `makeCapability` skeleton (exact shape) into `src/engines/generated/<slug>.ts`; register it
  in `registerDefaultCapabilities`, then `catalog-gen`
- `migrate --name=<x> [--timeout=ms]` — non-interactive `prisma migrate dev --name <x>` under a
  hard timeout (never blocks on the stdin name prompt)
- `loop --goal= --max-cycles=N --mitm [--force]` — single-pass orchestration; enforces the
  goal-resolution gate (vague goal → halt & ask); always tears down servers in `finally`
- `loop --objective="..."` — **start an iterative improve→test→debug loop**: writes a persisted
  ledger (`.runtime/loop-state.json`), runs typecheck + backend probe, proposes step 1
- `loop --resume` — evaluate the step the LLM just implemented, record pass/fail in the ledger,
  propose the next bounded step (or conclude `done`/`blocked`); hard `maxCycles` cap
- `loop --reset` — clear the ledger
- `setup --provider= --account=` — first-time provider Chrome login wizard (requires email).
  **Prefer** `devops agentic adopt --provider=<slug>` when a profile already exists on disk with cookies
  (it restores → launches → verifies → completes in one bounded call).
- `ensure-browser`    — deterministic `{ok, source:'adopted'|'spawned'|'none'}` precheck; if not
  `adopted`/`spawned`, do NOT spin `engage` — verify via API + flag UI-unverified
- `watchdog --pid=<n>` — detached reaper: polls parent pid, runs `stop` on agent death (no orphans)
- `guard`             — lefthook check: fails if `.runtime/*.pid` present or `prisma migrate status`
  is pending (run by pre-commit; blocks commits in bad state)
- `status`            — running server state from `.runtime/*.pid` + health endpoints
- `status --provider=<slug>` — provider-specific capability status: seed presence, profile cookies, live slave, capability registration, selector confidence, UI frontend test status, canonical verdict + recommended action
- `stop`              — tear down all services (canonical PS1 stopper); single correct teardown
- `report`            — recall the last persisted loop `LoopReport` (survives the child-process loop)
- `onboard run --goal= --provider= --url= --from= --resume --min-confidence=` — full provider onboarding cycle (PRD-12). Auto-resolves CDP from live Chrome matching the provider slug — never manually inject CDP.
- `onboard discover --provider= --url=` — CDP discovery (DOM, selectors, structure). CDP auto-injected from context probe — no manual setup needed.
- `onboard infer --provider=` — infer parser (data paths, transforms, confidence)
- `onboard test-selectors --provider=` — validate selectors against live DOM. CDP auto-injected.
- `onboard test-parse --provider=` — verify parser correctness (≥0.7 confidence)
- `onboard test-cap --provider=` — test capability registration + invocation
- `onboard test-frontend --provider=` — E2E frontend: canvas mount + capability invoke + DOM assert. Auto-records into UiTestRegistry with timestamps + notes.
- `onboard verify --provider=` — final verification gate
- `onboard converge --provider= --feature-dir=` — append convergence tasks to ledger

Top-level devops CLI (outside `runtime-test`):
- `bun run devops discover-protocol <url> [--hint=name]` — auto-discover a provider's write/read protocol (composer, send button, DOM responses). Also available under `runtime-test` as an alias.
- `bun run devops agentic adopt --provider=<slug>` — restore a cookie-bearing on-disk profile → launch visible Chrome → verify login → complete DB registration. One bounded call for the "you launch chrome, I log in, you register" flow.
- `bun run devops agentic preflight` — full preflight context: accounts, live Chrome, profiles, restore candidates, untested capabilities, gaps, suggested action.
- `bun run devops ui-test list|status|record` — query/record the UI frontend test registry (tracks which capabilities have been verified in the browser, with timestamps and notes).

Backend API (for manual probing):
- `POST /api/nlcl/interpret`       body `{input, surface?}` → NLCL engine result
- `GET  /api/capabilities?surface=ui` → capability list (id/slug)
- `GET  /api/health`               → 200 when backend up
- `POST /api/fleet/start`          body `{providerId, accountId, visible}` → adopts/spawns Chrome slave

Agent-safety guarantees:
- Every CLI command is bounded (timeouts on all fetches) and returns structured JSON.
- `loop` enforces a **goal-resolution gate**: a goal that maps to no capability returns
  `needsClarification` and halts — the agent interviews instead of building wrong.
- A **process-guard** is installed at the top of every `runtime-test` command: SIGINT/SIGTERM/
  uncaughtException/unhandledRejection always run `stop` before exit. The loop also reaps servers
  in a `finally`. This is the "hook that intercepts context just in case" — no orphan can survive.
- `migrate` is non-interactive (always `--name`) with a hard spawn timeout — no stdin hang.
- Launchers write PID files so `stop` / `stop-all.ps1` / `watchdog` can always reclaim processes.
- **Iterative loop** (`--objective`/`--resume`): the LLM is the *implementer*; the loop is the
  *coordinator + evaluator*. A persisted ledger records every step + its real-world test result, so
  a flexible LLM stays on-task and shows progress across cycles and interruptions. Hard `maxCycles`
  cap + `finally` teardown prevent hangs/orphans.

### Recipe D2 — Check UI frontend test status and direct next steps

After any onboarding or capability work, check what has and hasn't been tested in the UI:

1. `bun run devops agentic preflight` — shows untested capabilities per ready provider and a suggested next action.
2. `bun run devops runtime-test status --provider=<slug>` — full provider status including UI test registry data.
3. `bun run devops ui-test status --provider=<slug>` — specifically query UI test history.
4. If there are untested capabilities, the `suggestedAction` in preflight tells you what to run next.
5. To manually record a UI test result (e.g. after human-driven verification):
   `bun run devops ui-test record --provider=gemini --cap=send_message --result=pass --detail="human verified in browser" --tested-by=human`

The UiTestRegistry persists to `.runtime/ui-test-registry.json` and answers "has this been tested in the frontend?" with timestamps and notes.

### Recipe D — Iterative improve → real-world-test → debug → improve
Gives the LLM freedom to implement each step however it chooses, while guaranteeing on-task progress.
1. `bun run devops runtime-test loop --objective="add conversation summarize capability"`
   → writes `.runtime/loop-state.json`, runs typecheck + backend probe, prints `nextStep`.
2. The LLM implements that step (edit code / register capability / fix test — any approach).
3. `bun run devops runtime-test loop --resume`
   → evaluates the change (typecheck + backend health), records pass/fail in the ledger, and either
   proposes the next bounded step or concludes `done`/`blocked`.
4. Repeat until `status: "done"`. Then `bun run devops runtime-test stop` to tear down.
The ledger is the single source of truth: resume works after an interruption, and the agent can
always read where it is. A vague objective still hits the goal-gate and halts with `needsClarification`.

## Build Recipes

Repo root = `C:\0-BlackBoxProject-0\vivim-final`. Follow the invariants below.

### Recipe A — Add a new capability (most common)
Goal: "add conversation rename capability".
1. Define the engine work in `src/engines/` (one file per engine). If it touches storage, define/extend
   a Store Contract in `src/storage/contracts/` (never the impl).
2. Register the capability in `src/engines/capability-bootstrap.ts` inside `registerDefaultCapabilities`,
   using `makeCapability`:
   ```ts
   makeCapability(
     {
       id: 'cap:conversation:rename',
       slug: 'conversation_rename',          // FRONTEND=BACKEND link
       name: 'Rename Conversation',
       description: 'Rename a conversation by id.',
       category: 'conversation',
       inputSchema: { type: 'object',
         properties: { conversationId: { type: 'string' }, title: { type: 'string' } },
         required: ['conversationId', 'title'] },
       outputSchema: { type: 'object' },
       cliCommand: { name: 'conversations rename', aliases: ['cr'],
         examples: ['cr <id> --title "New"'] },
       ui: { component: 'action-button', position: 'sidebar', order: 3 },
       mcpToolName: 'conversation_rename',
       apiEndpoint: { method: 'POST', path: '/api/conversations/{id}/rename' },
     },
     async (input) => services.conversationStore.rename(
       String(input.conversationId), String(input.title)),
   )
   ```
   `surfaces` defaults to `ALL_SURFACES` (cli/ui/api/mcp/workflow) — cross-surface parity, no second
   transport.
3. API route (only if not covered by `/api/nlcl/interpret` or `/api/capabilities/:id/execute`): add a handler
   in `src/server/` following the existing router pattern.
4. Frontend: invoke the `vivi-frontend` skill. Generic-first — a new `slug` often renders via the
   GenericCapabilityRenderer with zero new code. Promote to a bespoke renderer only on merit (custom
   layout / rich input / ≥2-surface reuse) and register it in `CapabilityRegistry`.
5. Tests: unit (mock the Store Contract), integration (hit the API), e2e if it drives Chrome.
6. Verify: `bun run devops runtime-test test --nl="rename conversation <id> to X"` then UI.

### Recipe B — Fix a bug
Goal: "fix the broken send button".
1. `discover` + `debug` to capture the failure (console/errors/screenshot).
2. Reproduce via `test --nl="..."` or `engage` to the broken UI.
3. Locate root cause (frontend renderer vs backend capability vs store contract).
4. Fix minimally, keep invariants. Re-run the failing test + UI verify.
5. Add a regression test so it stays fixed.

### Recipe C — Database / schema change
1. Edit `prisma/schema.prisma`.
2. `bunx prisma migrate dev --name <description>`.
3. Update the relevant Store Contract in `src/storage/contracts/`.
4. Update seeds in `seeds/` if the change affects seeded data.
5. `bunx prisma studio` to eyeball; re-run `discover` (schemaTables count updates).

### Recipe E — Canvas layer / conceptual-model surface (the primary frontend surface)

The primary frontend surface is now the **unified infinite canvas** (`web/ui/src/features/canvas/CanvasSurface.tsx`),
not just the per-provider `ChatPage`. Surfaces are generated from a **DB-backed provider-type conceptual
model** — not from in-repo provider docs. When a frontend change is "add a surface / region / UI for a
provider family", prefer the canvas + conceptual-model path over a new `ChatPage` slot.

Source of truth: `docs/roadmap/prds/PRD-VIVIM-CANVAS-UNIFIED-SURFACE.md`.

Backend pieces (seeded at **server boot** from `seeds/conceptual-model/seed.ts`):
- `ProviderType` + `UiComponent` tables drive all surfaces. `UiComponent` holds 4 resolution tiers via a
  unique `(scope, ownerId, variant)` key. Precedence: provider+variant > provider > family+variant >
  family > cross-type > system default. Resolved by `src/engines/conceptual-model-service.ts`.
- `GET /api/conversations/:id/stream-blocks` → `{ ok, conversationId, blocks, streaming }` for
  progressive result rendering (blocks are `ContentBlock` union in `shared/stream-blocks.ts`, each with `index`).
- Live layer events `canvas:layer:spawned` / `canvas:layer:dismissed` on `CapabilityEventBus`;
  `registerCanvasLayerForwarder` (`/ws/canvas`) in `src/server/websocket.ts`; thin emitter
  `CanvasLayerMounter` (`src/engines/canvas-layer-mounter.ts`).

Frontend pieces (`web/ui/src/features/canvas/`):
- `CanvasSurface.tsx` (mounted as a tab in `App.tsx`), `BrowserLayerHost.tsx`, `SandboxedLayer.tsx`,
  `useManifest.ts`, `useNodeTypes.tsx`, `useStreamBlocks.ts`, `useConceptualModel.ts`, `useCanvasEvents.ts`.
- `shared/canvas-types.ts` — `CanvasDefinition`, `LayerHost`, `SandboxPolicy`, `LayerCategory`.

Build steps for a canvas-facing feature:
1. `discover` / `test --nl="..."` to confirm the capability resolves (FRONTEND=BACKEND still holds — `slug` links).
2. If it needs a new **region/component for a provider family**, add a `UiComponent` row (or seed) rather
   than a hardcoded React branch. Use `useConceptualModel.ts` to resolve components at runtime.
3. If it needs a **live canvas layer**, publish a `CanvasDefinition` draft and spawn it via
   `CanvasLayerMounter.spawn`; the spawn forwards to the browser over `/ws/canvas`. Verify the node appears.
4. Streaming results: wire `useStreamBlocks.ts` → `GET /api/conversations/:id/stream-blocks`.
5. Verify through the UI (canvas tab) last, per Phase 7. `ChatPage` is still valid as a secondary tab.

> The older `vivi-frontend` slot model (`UIComponentRegistry`, `chat.*` slots, `CapabilityRegistry`
> bespoke renderers) is **retained for fine-grained hot-swaps within a surface**. The canvas +
> conceptual model is the generative backbone; slots are a sub-mechanism. Do not assume
> `ChatPage` is the only surface.

### Recipe D — Taxonomy chain change (platform/capability expansion)
Goal: "add 10x more platforms", "expand taxonomy", "add capabilities for X".
1. **Expand skeleton:** `bun run taxonomy-gen expand` (writes `skeleton/platforms.json`).
2. **Enrich pool:** `bun run taxonomy-gen enrich` (merges new caps into pool, runs Round 3+4).
3. **Verify chain:** `bun run devops verify-cross-surface` — all capabilities must resolve
   across CLI/API/MCP/UI. If any fail, fix the taxonomy pipeline or pool before proceeding.
4. **Typecheck:** `bun run typecheck`.
5. **Audit:** `bun run devops audit-code standard` if significant changes.

**Gotchas:**
- `CATEGORY_POSITIONS` must use namespaced slot ids (`chat.actionBar`, not `actionBar`).
- Shared capability nodes may lack `category` — derive from `slug.split('_')[0]`.
- `Bun.spawn` exitCode is null until `await proc.exited`.

## Invariants (never violate)

- **Governor Canon (B1):** Only `ChromeGovernor` touches CDP. The executor/harness never imports CDP
  transport. `cdp-discovery.ts` / `discover-cdp.ts` are exempt (pure protocol descriptor).
- **Store Contracts (B2):** Engines depend on `src/storage/contracts/*`, never `src/storage/impl/*`.
- **One Entry Point (25.7):** Every operation is a `UnifiedCapability`. CLI/UI/API are thin shells over
  `POST /api/nlcl/interpret` and `/api/capabilities/:id/execute`.
- **FRONTEND=BACKEND (5.1):** The capability `slug` links backend and frontend.
- **Capability Registry always created** — never inside try/catch, so caps surface even if an engine
  fails to boot.
- **Agent-safety:** Every command is bounded and returns structured JSON; never hangs on I/O; never
  leaves orphan processes (use `stop`).
- **Edit-then-verify ordering:** Complete ALL code edits for the unit/task
  before running any verification (typecheck/lint/tests). Running verification
  mid-task wastes time and masks true errors — later edits will invalidate
  earlier passes. The single gate at the end is the only one that counts.
- **Type safety:** No `any` — use `unknown` + narrowing. Errors via custom classes, never swallowed.
- **DB-Driven Protocol (P1):** Provider-specific composer selectors, send methods, capture patterns, fetch URL patterns, and DOM selectors live in the DB (`ProviderEndpoint` rows, seeded from `seeds/providers/*.json`). NEVER hardcode these in TypeScript. The hardcoded maps in `provider-selectors.ts` and `conversation-manager.ts` are FALLBACKS only. New providers: write JSON → `bun run seed`. Use `bun run devops discover-protocol <url>` to auto-discover.
- **Chrome Slave Profile = Source of Truth:** Cookie files in profile directory determine "logged in" state — NOT DB loginState row. `isAuthenticated()` checks cookie files.
- **One Profile Per (Provider, Account):** ProfileAllocator enforces singleton — no duplicate profiles for same provider+account combination.
- **Lazy Startup:** Chrome slaves auto-launch when first needed, keep alive until `stop` command. No always-on requirement for dev loop.
- **No Runaway Creation:** FleetSupervisor limits (maxConcurrent, queue, timeout) + ProfileAllocator singleton + spawn guard prevent duplicate Chrome instances.
- **Triple-Layer State:** Profile + DB + runtime must stay consistent. Profile dir is canonical, DB and runtime are derived from profile state.
- **Relogin Ready:** Agent detects session expiry via `isAuthenticated()`, suggests relogin to user, user confirms, system executes relogin flow.

## Chrome Slave Lifecycle (Strategic Design)

**Full design document:** `docs/designs/chrome-slave-system-design.md`

### Purpose & Role
- CDP bridge to manage registered providers (chatgpt.com, gemini.google.com, claude.ai)
- Stream responses back to the system with frontend rendering
- Already working — this is the core functionality

### Scale & Concurrency
- **Concurrent slaves:** 3-5 (gemini, chatgpt, claude + room for growth)
- **Enforcement:** FleetSupervisor limits exist and work properly
- **Admission control:** Bounded concurrency + queue + timeout (browserless pattern)

### Lifecycle Model
- **Type:** Stateful, dedicated slaves
- **Pattern:** Login once per provider + account, use indefinitely
- **Dev loop:** Lazy startup (auto-launch when first needed, keep alive until `stop`)

### State Management (Triple-Layer)
| Layer | Purpose |
|-------|---------|
| **Profile dirs** | Chrome's `--user-data-dir` — cookies, localStorage, session state |
| **DB (ProviderAccount)** | loginState, debugPort, profileDir, isDefault |
| **Runtime (.runtime/)** | Fast agent access, port files, PID files, health status |

### Crash Recovery
- **Transient failure:** Auto-restart with same profile (state preserved via cookies)
- **Persistent failure:** Manual intervention — agent must detect and decide
- **Circuit breaker:** Opens after 5 failures, resets after 60s

### Session Expiry & Relogin
- **Detection:** `isAuthenticated()` checks cookie files in profile dir
- **Alerting:** Flag in preflight, agent decides
- **Relogin sequence:** Hybrid — agent detects + suggests, user confirms, system executes

### Key Commands
```bash
# Check provider status
bun run devops runtime-test status --provider=gemini

# Engage browser (attach-first)
bun run devops runtime-test engage --provider=gemini

# Ensure browser is available
bun run devops runtime-test ensure-browser

# Profile cleanup
bun run devops profiles cleanup [--force] [--provider=<slug>]

# Relogin flow
bun run devops runtime-test setup --provider=gemini --account=gemini_owservera@gmail.com
```

## Preflight: Always Know the Current State

Before any operation, run:
```bash
bun run devops agentic preflight
```
Reports: which providers have accounts, which Chrome profiles exist (with cookies), which Chrome instances are live, what pages they're on, and what gaps exist. Never guess at what's available.

## Protocol Discovery: Auto-Discover Provider Interaction

For any new provider URL, auto-discover write/read protocols:
```bash
bun run devops discover-protocol https://newprovider.com --hint=name
```
Detects: composer selectors, composer type, send buttons, framework (ProseMirror/Quill/React), DOM response containers. Produces a `manifestDraft` for seeding. Uses existing Chrome profiles automatically via preflight context.

## CDP Connection Gotchas (CRITICAL)

These are hard-won lessons from debugging CDP issues. Read before touching any CDP code.

### 1. WebSocket URL must be the exact UUID-suffixed URL from `/json/version`
Chrome REJECTS the bare `ws://host:port/devtools/browser` path. You MUST fetch
`http://127.0.0.1:{port}/json/version` and use the `webSocketDebuggerUrl` field:
```typescript
// WRONG — Chrome rejects this:
const client = new BunCdpClient(`ws://127.0.0.1:${port}/devtools/browser`)

// CORRECT — resolve the exact URL first:
const ver = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json())
const client = new BunCdpClient(ver.webSocketDebuggerUrl)
```
This affects: `CdpTransportImpl.connect`, `FleetSupervisor.navigateToProvider`,
`FleetSupervisor.healthCheck`, `setup-router.ts` verify.

### 2. CDP commands require a page-target sessionId
Browser-level connection alone is insufficient. Most CDP domains (DOM, Input, Page, Network)
require attaching to a specific page target:
```typescript
const targets = await client.send('Target.getTargets')
const page = targets.targetInfos.find(t => t.type === 'page')
const { sessionId } = await client.send('Target.attachToTarget', {
  targetId: page.targetId, flatten: true
})
// Now route commands with sessionId:
await client.send('Input.dispatchKeyEvent', { ... }, { sessionId })
```

### 3. `--no-startup-window` Chrome has no page target
Chrome launched with `--no-startup-window` (headless-new) starts with NO page targets.
`/json/list` returns `[]`. You must create one via CDP:
```typescript
const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true })
```

### 4. Setup wizard verify must check ALL page targets
The first page target may be a chrome://signin-dice intercept (not the actual app tab).
Iterate all pages and OR the login results:
```typescript
for (const page of pages) {
  const { sessionId } = await client.send('Target.attachToTarget', { ... })
  // check cookies/DOM on this page
  if (loggedIn) break
}
```

### 5. CDPProxy must rebuild on every access
If `get cdp()` caches a static slave snapshot, freshly-spawned slaves cause "Slave not found":
```typescript
// WRONG — stale snapshot:
get cdp() { return new CDPProxy(this.slaves, ...) }

// CORRECT — live snapshot:
get cdp() { return new CDPProxy(this.getAllInstances(), ...) }
```

### 6. DB loginState can be stale
The DB may say `loginState: 'logged_in'` while the browser session has expired.
Always verify the actual browser state (cookies, page URL) rather than trusting the DB:
```typescript
// Check actual cookies, not just DB state:
const cookieResult = await client.send('Network.getCookies', {}, { sessionId })
const hasAuth = cookieNames.has('SID') || cookieNames.has('HSID') || ...
```

### 7. Windows zombie sockets block port reuse
After `taskkill /F` or `stop-all.ps1`, Windows can leave a LISTENING socket in zombie state
with a dead PID. `netstat -ano | Select-String :PORT` shows the old PID but `Get-Process`
fails to find it. New servers CANNOT bind to the same port until the OS reclaims it.
**Workaround:** Wait 30-60 seconds. If persistent, reboot or change the port. There is no
reliable user-mode way to clear a zombie socket on Windows.

### 8. Provider sessions auto-created on first send
`POST /api/conversations` with `{ providerId }` auto-creates a `providerSession` row + a
`conversation`. The send route reads `body.message` (NOT `content`):
```typescript
// This auto-creates providerSession + conversation:
const res = await fetch('http://127.0.0.1:9420/api/conversations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ providerId: 'chatgpt' })
})
// Then send with body.message (not body.content):
await fetch(`http://127.0.0.1:9420/api/conversations/${convId}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'hello' })
})
```

### 9. Raw SQL tables need manual scripts
Tables created via raw SQL (not Prisma migrations) aren't tracked by Prisma. Create a
`.runtime/ensure-<table>.ts` script that checks existence via `SELECT` and creates via
`PRAGMA table_info` + `CREATE TABLE` if missing. Use `bun run .runtime/ensure-<table>.ts`.

### 10. PowerShell gotchas (use bun scripts instead)
- `$PID` is read-only — don't assign it
- `$_` in double-quoted strings fails — use single quotes or bun
- `$var=` after `&&` fails — separate into two commands
- For DB/HTTP operations, write bun scripts in `.runtime/` instead of inline PowerShell

### 11. Network capture regex must match real endpoint
The capture system intercepts network responses matching `CAPTURE_PATTERNS[provider]` regex.
If the regex doesn't match the real streaming endpoint, capture times out returning empty body
with `null` metadata. To debug, capture real requests:
```typescript
// Temporarily add this to observe real endpoint:
await client.send('Network.enable', {}, { sessionId })
client.on('Network.requestWillBeSent', (params) => {
  if (params.request.url.includes('/api/') || params.request.url.includes('/backend-api/'))
    console.log(`[NET] ${params.request.method} ${params.request.url}`)
})
```

## Anti-patterns (what NOT to do)

- Don't run a headless `loop` as a black box and call it "done" — you are the runtime.
- Don't build without a goal, and never substitute a placeholder (`hello`) for real intent.
- Don't spawn servers per cycle — launch once via PS1, stop once via `stop`.
- Don't import CDP transport outside `ChromeGovernor`.
- Don't hardcode feature logic in the frontend — render from the `ResolvedCapability` contract.
- Don't skip UI verification — a green API test is not a shipped feature.
- Don't leave orphan processes — always `stop`.
- Don't use bare `/devtools/browser` WS URLs — always resolve from `/json/version`.
- Don't trust DB `loginState` — verify actual browser cookies/state.
- Don't assume `pages[0]` is the auth tab — iterate all page targets.

---

## SpecKit Integration

When implementing a feature that has a SpecKit spec, follow this workflow:

### SpecKit-Driven Full Stack Workflow

1. **Check for spec**: Look for `specs/NNN-name/spec.md` and `plan.md`
2. **If spec exists**: Follow SpecKit pipeline (specify → plan → tasks → implement)
3. **Use devops-fullstack for implementation only**: After tasks are created, use this skill to execute the implementation
4. **Gate**: Use `bun run devops speckit gate --scope=feature` for unified quality checks
5. **Converge**: Use `bun run devops speckit converge <featureDir>` to run spec+code+arch analysis

### Bridge Commands

| Command | Purpose |
|---------|---------|
| `bun run devops speckit sync <featureDir>` | Sync tasks to tracker |
| `bun run devops speckit gate --scope=feature` | Unified gate for feature |
| `bun run devops speckit converge <featureDir>` | Run converge pipeline |

### Key Modules

| Module | Purpose |
|--------|---------|
| `devops/unified-gate.ts` | Unified quality gate |
| `devops/tracker-speckit-sync.ts` | Bidirectional state sync |
| `devops/speckit-converge-bridge.ts` | Converge pipeline |
