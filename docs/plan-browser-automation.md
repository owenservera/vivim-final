# Plan: Full Browser Automation — Provider-Free, NL-Driven

## Goal
Agentic browser automation driven purely by natural-language commands, executed by the CLI (thin client) and interpreted by our NLP engines (`/api/interpret`). The browser must be **not provider-bound**: a standalone Chrome instance launched on demand, independent of any provider account/session.

## Current State (Research)
- `BrowserExecutor` (`src/engines/nlcl/executors/browser-executor.ts`) only acts when `ctx.slaveId` is set — i.e. a **provider-bound** slave. Without a provider/session it either fails (`browser.extract`/`screenshot`) or just `openExternal`s a URL (no real automation).
- `src/automation/ui-automator.ts` + `src/automation/automation-router.ts` already implement the full agentic verb set (navigate, click, type, clear, press, text, value, exists, screenshot, page) — BUT they import `BunCdpClient` directly, **violating the Governor Canon** (only `ChromeGovernor` may touch CDP), and are **not mounted** in `src/server/index.ts`. They also assume a Chrome already running on a fixed debug port (default 9222) — they never spawn one.
- The `ChromeGovernor` already supports spawning a provider-free slave: `governor.spawn(providerSlug, accountId, opts)`. A neutral `providerSlug: 'generic'` (account `'default'`) gives us a standalone fleet slave. `CdpTransportImpl` lazily connects to any spawned slave by `slaveId`.
- NLCL catalog (`src/engines/nlcl/catalog.ts`) has browser intents `browser.navigate / search / open / extract / screenshot` with regex patterns — deterministic, no AI needed. Composite/multi-step ("go to X and summarize") already supported via `detectComposite`.

## Decisions (from user)
- **Scope:** Standalone generic slave (provider-free).
- **Surface:** CLI thin-client **and** `POST /api/interpret`.
- **Verb breadth:** Full agentic set — navigate, search, click, type, fill form, extract, screenshot, scroll, wait, open/close tab, read DOM — plus multi-step NL.

## Architecture / Approach
Introduce a **`GenericBrowserExecutor`** that drives a standalone Governor-managed Chrome slave. Keep the Governor Canon intact: all CDP goes through `governor.cdp` / `governor.evaluate`, never `BunCdpClient` directly. Reuse `UIAutomator`'s interaction semantics (selector/text/aria/placeholder resolution, `Input.dispatch*` clicks, char-by-char typing) but re-implement them over the Governor's `CDPTransport` so the canon holds. The generic slave is spawned lazily on first browser command and reused for the session/CLI invocation.

### 1. Generic slave lifecycle (provider-free)
- Add `ChromeGovernor.ensureGenericBrowser(opts?)` → spawns `providerSlug: 'generic'`, `accountId: 'default'` via `fleetSupervisor.spawn`, returns `{ slaveId }`. Memoize the generic `slaveId` on the governor (global singleton) so repeated NL commands reuse the same tab.
- The generic slave should **not** navigate to a provider URL (unlike provider slaves). Leave `about:blank` and let each command navigate.

### 2. New executor — `src/engines/nlcl/executors/generic-browser-executor.ts`
Implements `CommandExecutor` (`id: 'generic-browser'`). Holds a `ChromeGovernor` ref. On each call:
- `await governor.ensureGenericBrowser()` → `slaveId`
- Use `governor.cdp.send(slaveId, ...)` / `governor.evaluate(slaveId, ...)` / `governor.cdp.captureScreenshot(slaveId)` for all page-domain ops.
- Verbs: `navigate`, `search` (build query URL + navigate), `click` (resolve element by selector/text/aria/placeholder → `Input.dispatchMouseEvent`), `type`/`fill` (focus + char-by-char `Input.dispatchKeyEvent`), `clear`, `pressKey`, `scroll` (`Runtime.evaluate` window.scrollBy), `wait` (fixed/selector), `extract`/`read` (DOM innerText/innerHTML via `governor.evaluate`), `screenshot` (return base64 + save file for CLI), `openTab`/`closeTab` (`Target.createTarget`/`Target.closeTarget`), `title`/`url`.
- Keep `ElementSelector` resolution logic (ported from `UIAutomator.buildSelectorExpression`), governor-mediated.

### 3. NL catalog expansion — `src/engines/nlcl/catalog.ts`
Add a new `genericBrowserPatterns` group (category `'browser'`) with deterministic regex intents:
- `browser.open` (already exists but requires provider; keep existing provider path and add generic fallback — see §5)
- `browser.click` — `"click the login button"`, `"click 'Sign in'"`, `"click #submit"`
- `browser.type` / `browser.fill` — `"type hello into the search box"`, `"fill email with me@x.com"`
- `browser.clear`, `browser.press` (e.g. `"press Enter"`)
- `browser.scroll` — `"scroll down"`
- `browser.wait` — `"wait 3 seconds"` / `"wait for the results"`
- `browser.tab.open` / `browser.tab.close`
- `browser.read` / `browser.dom` — `"read the page"`, `"what's the title"`
- Keep existing `browser.navigate / search / extract / screenshot`.
All point `executor: 'generic-browser'`. Examples + aliases per pattern.

### 4. Executor registration — `src/engines/nlcl/nlcl-engine.ts`
- Construct `new GenericBrowserExecutor(governor)` and register it in `registerExecutors()` (only when `governor` present). Add `'generic-browser'` to `ExecutorId` union in `types.ts`. Export from `executors/index.ts`.

### 5. Routing: generic vs provider-bound (non-breaking)
- In `GenericBrowserExecutor`, when `ctx.slaveId` is present (a real provider session is active) **and** it's a provider slave, we can still operate on it; but the new NL verbs are meant for the generic browser. Cleanest: generic browser intents always target the standalone generic slave (spawned on demand). The existing `BrowserExecutor` remains for the provider-bound `extract`/`screenshot` in-session path. To avoid confusion, route the *new* intents (`click/type/fill/scroll/wait/tab`) exclusively to `generic-browser`; keep `navigate/search/open/extract/screenshot` on `generic-browser` too (provider path becomes optional fallback only when a slaveId is explicitly in ctx). Document the split.

### 6. Server wiring — `src/server/index.ts`
- Mount `createAutomationRouter()`? **No** — it bypasses the canon. Instead, the generic browser is reachable entirely through `/api/interpret` (NL) and the CLI. (Optionally mount `/api/automate/*` later behind the governor, but out of scope to keep canon clean. We keep `automate` CLI builtin as-is or repoint it to NL interpret.)
- No new transport needed: NL commands already flow `cli → POST /api/interpret → NLCLEngine.interpret → executor`. Ensure `createServerWithEngines` passes `governor` into `NLCLEngine` (it already does).

### 7. CLI surfacing
- NL commands are interpreted server-side; the CLI thin-client already forwards unknown commands to `/api/interpret` via `matchCapability`/`executeRemote` (`src/cli/commands/registry-bridge.ts`). Verify `browser.*` intents resolve there. Add `browser` to the default surfaces of new patterns (`surfaces: ['cli','ui','api','mcp','frontend']`) so the CLI bridge picks them up.
- For `screenshot` from CLI: executor writes PNG to cwd and prints path (mirrors existing `automate` behavior).

### 8. Tests
- Unit (`tests/unit/engines/nlcl/generic-browser-executor.test.ts`): mock `ChromeGovernor` (stub `cdp.send`/`evaluate`/`ensureGenericBrowser`/`captureScreenshot`) → assert correct CDP methods/params for each verb, and selector resolution.
- Unit: catalog patterns (`tests/unit/engines/nlcl/catalog.test.ts`) — assert intents parse from sample NL ("click the Sign in button", "type hello into search", "scroll down").
- Integration: spawn a real headless Chrome (guarded, skippable in CI without Chrome) end-to-end navigate→extract.

### 9. Verification
- `bun run typecheck`, `bun run lint`, `bun test`.
- Manual: `bun run serve` then `bun run cli` → `open chrome`, `go to example.com`, `click the more info link`, `screenshot`, `read the page`. Also `curl -XPOST localhost:9421/api/interpret -d '{"text":"type hello into the search box on example.com"}'`.

## Files Touched
- **New:** `src/engines/nlcl/executors/generic-browser-executor.ts`
- **Edit:** `src/engines/chrome-governor.ts` (add `ensureGenericBrowser`)
- **Edit:** `src/engines/nlcl/types.ts` (add `'generic-browser'` to `ExecutorId`)
- **Edit:** `src/engines/nlcl/executors/index.ts` (export)
- **Edit:** `src/engines/nlcl/nlcl-engine.ts` (register executor)
- **Edit:** `src/engines/nlcl/catalog.ts` (new `genericBrowserPatterns` + export in `getDefaultCommandPatterns`)
- **Tests:** `tests/unit/engines/nlcl/*.test.ts`

## Risks / Invariants
- **Governor Canon:** never import `BunCdpClient` outside governor/executor layer. All CDP via `governor.cdp`/`governor.evaluate`.
- Generic slave must be tracked by `FleetSupervisor` so shutdown `killAll()` cleans it up (it will, since it's a normal spawn).
- Headless vs headed: default headless (`mode: 'headless-new'`); allow `--visible`/CLI flag for debugging.
- Idempotency: memoize generic slaveId so a single session reuses one tab; provide implicit tab reuse and explicit open/close tab verbs.
