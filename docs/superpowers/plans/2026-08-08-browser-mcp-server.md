# Vivim Browser Automation MCP Server — Implementation Plan

**Date:** 2026-08-08
**Status:** ✅ COMPLETE — all tasks T1–T7 done. Tests: **65 pass / 0 fail** across 6 files (269
expects). Biome: all `src/mcp/` production files clean (0 errors/warnings); test files show only
warn-level `noNonNullAssertion`. Live stdio smoke verified: handshake + 139 real tools after
in-process full stack boot. opencode.json `vivim-browser` entry added.

**Post-ship fixes (found via manual client round-trip):**
1. **stdout pollution (critical):** `getLogger` dev pino-pretty transport writes to **stdout**, which
   would corrupt the JSON-RPC stream. Added `VIVIM_LOG_STDERR=1` → `pino.destination(2)` in
   `src/lib/logger.ts`. Set via env when spawning the MCP server (smoke client + any real MCP host).
2. **`killChrome` fire-and-forget:** `launcher.ts` spawned `taskkill` without awaiting, so
   `browser_quit`/shutdown could exit before Chrome died (orphaned fleet). Now `await proc.exited`.
3. **`exit` notification deadlock + non-termination:** `exit` returned `null` but never exited the
   process (stdin stays open → orphaned server). Fixed in `browser-mcp.ts` — teardown runs *after*
   the tracked handler settles (a naive `drain()` inside the handler deadlocked on itself).
4. **New regression guard:** `tests/integration/mcp/browser-mcp.test.ts` spawns the real process,
   sends `initialize` + `exit`, asserts clean exit (code 0) + no stdout pollution. 16 tests in file.
**Spec:** `docs/superpowers/specs/2026-08-08-browser-automation-mcp-server-design.md` (approved)
**Mode:** Test-first (red-green-refactor), task-driven, bite-sized steps

## Context

Build a standalone stdio MCP server exposing vivim's full `ChromeGovernor` +
`BrowserCapabilityRegistry` browser-automation stack as MCP tools. Lazy-boot, persistent shared
Chrome via `ensureGenericBrowser()`, full access (no trust gates), results returned to the
calling agent only (nothing persisted to vivim's DB). No new npm dependencies — MCP JSON-RPC is
hand-rolled (repo pattern: `src/engines/mcp-server-adapter.ts`, `DiscoveryMcpServer`).

## Key API facts (verified against source)

- **Assembly pattern** to copy: `buildLocalDiscoveryStack` at `src/cli/discovery-stack.ts:37`:
  `getDb()` → `GovernorStoreImpl(db)` → `ChromeGovernor(govStore, config)` →
  `governor.setCdpTransport(new CdpTransportImpl())` → `new SemanticGroundingEngine(governor)` →
  `new BrowserCapabilityRegistry(governor, grounding)` → `registry.healer = new SelectorHealer(governor, grounding, store)`.
- **`ChromeGovernor` ctor** (`chrome-governor.ts:152`): `(store: GovernorStore, config: FleetConfig, eventBus?, transport?, fleetSupervisor?, stealthStore?)`.
  `config` is the engine's own `FleetConfig` (from `./chrome/types.js`): `portRange: [number, number]`
  tuple (NOT the executor/fleet-config.ts shape — the code reads `config.portRange[0]`), plus
  `healthProbeIntervalMs`, `healthProbeTimeoutMs`, `autoRestart`, `maxRestarts`,
  `circuitBreakerThreshold`, `circuitBreakerResetMs`, optional `profileBaseDir`/`chromePath`/
  `maxConcurrent`/`maxQueued`/`queueTimeoutMs`/`spawnRetryLimit`/`spawnRetryDelayMs`.
- **`ensureGenericBrowser(opts?: LaunchOptions)`** (`chrome-governor.ts:664`): memoized generic
  slave (`providerId 'generic'`, `accountId 'default'`). Relaunches after death. `LaunchOptions`:
  `{ visible?, profileDir?, debugPort?, extraArgs? }`.
- **`getSlave(slaveId)`** → `ChromeSlave | null`; **`getAllSlaves({providerId})`** →
  `ChromeSlave[]`; **`evaluate(slaveId, expression, opts?)`** → `unknown` (returns
  `result.result.value`; throws `EngineError` on exceptionDetails) — use this for SERP extraction.
- **`setCdpTransport(transport)`** must be called before any browser use (`capture`/
  `ensureGenericBrowser` throw `EngineError('CDP transport not configured')` otherwise).
- **`BrowserCapabilityRegistry` ctor** (`browser-automation/registry.ts:30`):
  `(governor: ChromeGovernor, grounding: SemanticGroundingEngine)`.
  `invoke(capabilityId, params, { slaveId, runId? })` → `Promise<CapResult>`; `list()` →
  `BrowserCapabilityDef[]`; `isDestructive(id)`. Def fields: `{ id, axis, description, params
  (zod), grounding?, trust, handler }`. IDs are `auto:<axis>:<action>` (e.g. `auto:nav:navigate`).
- **`CapResult`**: `{ ok, output?, detail?, resolved?, error? }`.
- **`SemanticGroundingEngine` ctor**: `(governor: ChromeGovernor)` (`semantic-grounding.ts`).
- **`SelectorHealer` ctor** (`browser-automation/selector-healer.ts:20`):
  `(governor, grounding, store: SelectorHealStore)`. **No `SelectorHealStore` impl exists in the
  repo** — write a small in-memory impl for the MCP server. Contract at
  `src/storage/contracts/selector-heal-store.ts` (`getStrategy`, `upsertStrategy`,
  `bumpHealCount`, `recordUse`).
- **`AsyncMutex`** (`src/engines/chrome/async-mutex.ts`): `acquire()` / `release()` to serialize
  tool calls (single shared browser).
- **`getLogger(name)`** (`src/lib/logger.ts:88`) → pino Logger; logs to stderr by default
  (configure to keep stdout clean). DO NOT `console.log` to stdout.
- **MCP handshake** (repo's `DiscoveryMcpServer` pattern + MCP spec):
  `initialize` (respond `{protocolVersion, capabilities:{tools:{}}, serverInfo}`) →
  `notifications/initialized` (no response) → `tools/list` → `tools/call` →
  `notifications/cancelled`/`exit`. Tool schema shape:
  `{name, description, inputSchema}`; call result: `{content:[{type:'text', text}], isError?}`.
- **Test mock pattern** (`tests/integration/engines/browser-automation.test.ts:20`
  `makeMockGovernor()`): mock `CDPTransport.send` returning `{ result: { result: { value: … } } }`
  for `Runtime.evaluate`, `{}` for others; `getPageState` → `{url,title,readyState}`;
  `captureScreenshot` → base64. Build registry against the mock governor (not a live Chrome).

## File map

- **New** `src/mcp/types.ts` — MCP shared types (`McpTool`, `McpCallResult`, `JsonRpc*`).
- **New** `src/mcp/zod-schema.ts` — `zodToJsonSchema(schema)` (pure, unit-testable).
- **New** `src/mcp/in-memory-heal-store.ts` — `SelectorHealStore` in-memory impl.
- **New** `src/mcp/browser-tools.ts` — Layer 1 registry→tool mapping + Layer 2 convenience tools.
- **New** `src/mcp/serp-parser.ts` — `parseGoogleSerp(html)` (pure, unit-testable).
- **New** `src/mcp/browser-session.ts` — slave lifecycle, mutex, watchdog, boot assembly.
- **New** `src/mcp/browser-mcp.ts` — entry point: stdio JSON-RPC server + protocol.
- **New** `tests/unit/mcp/zod-schema.test.ts`, `tests/unit/mcp/browser-tools.test.ts`,
  `tests/unit/mcp/serp-parser.test.ts`, `tests/unit/mcp/protocol.test.ts`,
  `tests/integration/mcp/browser-mcp.test.ts`.
- **Edit** `opencode.json` — register `vivim-browser` MCP.

## Rollout order (spec §12)

### T1. `src/mcp/types.ts` + `src/mcp/zod-schema.ts` (zod → JSON Schema)

> ✅ **DONE** — `types.ts` (`McpTool`, `JsonRpcRequest/Success/Error`, `JsonRpcResponse`; preserved
> `McpToolResult`), `zod-schema.ts` (`zodToJsonSchema`). `tests/unit/mcp/zod-schema.test.ts`: 8 pass.

**Red:** write `tests/unit/mcp/zod-schema.test.ts` covering: `z.object` → `type: 'object'` with
required/optional, nested object, `z.string()`, `z.number()`, `z.boolean()`, `z.array()`,
`z.enum()` → `{enum}`, `.optional()` → not required, `.default(x)` → `default` + not required,
`z.record(z.string(), z.unknown())` passthrough.

**Green:** `zodToJsonSchema(schema: ZodType): Record<string, unknown>` in `src/mcp/zod-schema.ts`
using `schema._def` introspection (mirror the repo's existing zod-introspection style in
`HarnessRepairEngine`). Handle only shapes present in the registry defs (checked: defs use
`z.object` with string/number/boolean/enum/array/optional/default — no unions/intersections
needed; throw `EngineError` on unsupported shape so it fails loudly, not silently).

**Verify:** `bun test tests/unit/mcp/zod-schema.test.ts`.

### T2. Layer 1 — registry → tool mapping (`src/mcp/browser-tools.ts`)

> ✅ **DONE** — `buildTools` one-tool-per-cap (name `browser_<axis>_<action>`, hyphens preserved;
> handler → `registry.invoke`, `isError: !result.ok`). `tests/unit/mcp/browser-tools.test.ts` 8 pass.

**Red:** `tests/unit/mcp/browser-tools.test.ts`:
- Build a `BrowserCapabilityRegistry` against a **mock governor** (copy `makeMockGovernor`
  from `tests/integration/engines/browser-automation.test.ts`).
- `buildTools(registry)` returns one `McpTool` per capability; assert name transform
  `auto:nav:navigate` → `browser_nav_navigate` for every cap (count == `registry.list().length`,
  covers all ~130).
- Assert `inputSchema` is the JSON Schema from `def.params`, description from `def.description`.
- Assert `_meta` carries `{ axis, trust, id }`.

**Green:** `buildTools(registry: BrowserCapabilityRegistry): McpTool[]` — iterate
`registry.list()`, map id→name (`browser_${axis}_${action}`), describe, schema; the handler is a
closure over the registry that calls `registry.invoke(def.id, args, { slaveId })` (slaveId from
injected context, see T4).

**Verify:** `bun test tests/unit/mcp/browser-tools.test.ts`.

### T3. Stack assembly + heal store + session (`src/mcp/in-memory-heal-store.ts`, `src/mcp/browser-session.ts`)

> ✅ **DONE** — `in-memory-heal-store.ts` (map-backed `SelectorHealStore`); `browser-session.ts`
> (`BrowserStack`, `buildBrowserStack` mirroring `discovery-stack.ts:37`, `BrowserSession` with
> `AsyncMutex`, `getSlaveId/isAlive/status/quit`, `ensureGenericBrowser` memoization; `killAll` +
> `clearGenericBrowser` reset for relaunch). Covered in `browser-mcp.test.ts`.

**Red:** `tests/integration/mcp/browser-mcp.test.ts` (start with the session part):
- `InMemoryHealStore` satisfies the `SelectorHealStore` contract (`getStrategy` returns null for
  unknown, `upsertStrategy` then `getStrategy` round-trips, `bumpHealCount`/`recordUse` mutate).
- `createBrowserSession()` returns a handle with `getSlaveId()`, `status()`, `quit()`,
  `isAlive()`.

**Green:**
- `src/mcp/in-memory-heal-store.ts` — map-backed impl of the `SelectorHealStore` contract.
- `src/mcp/browser-session.ts`:
  - `buildStack()` — lazy assembly mirroring `discovery-stack.ts:37` (see Key facts). Return
    `{ governor, registry, grounding, healer }`.
  - `BrowserSession` class: holds `governor`, `registry`, `AsyncMutex`; `ensureBrowser()`
    (acquire mutex → if no live generic slave, `governor.ensureGenericBrowser()`); `getSlaveId()`
    (ensure + return id); `status()` (slaveId, `getPageState` via governor, pid); `quit()`
    (governor.killAll() + clear internal ref; next call relaunches); `isAlive()` (slave exists +
    status not terminal).
  - Expose `stack` + `session` from one factory so `browser-mcp.ts` stays thin.

**Verify:** `bun test tests/integration/mcp/browser-mcp.test.ts`.

### T4. Protocol + entry (`src/mcp/browser-mcp.ts`)

> ✅ **DONE** — `createJsonRpcHandler({ tools, onShutdown?, callTimeoutMs?, ensureReady? })`
> (`tools` may be an async getter); `run()` + `assembleTools`. Stdout carries ONLY protocol bytes.
> Error codes -32700/-32600/-32601/-32603; `initialize` → protocolVersion '2025-03-26',
> capabilities `{tools:{listChanged:false}}`, serverInfo `{name:'vivim-browser',version:'1.0.0'}`;
> notifications/`exit` → null; 30s per-call timeout; handler failure → `{content:[{type:'text',text}],
> isError:true}`. `tests/unit/mcp/protocol.test.ts`: 12 pass.

**Red:** `tests/unit/mcp/protocol.test.ts`:
- `createJsonRpcHandler(dispatch)` returns a `handleMessage(line): string | null` function.
  Feed `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}` → valid initialize result
  (`protocolVersion`, `capabilities`, `serverInfo`).
- `tools/list` → `{tools: [...]}`.
- `tools/call` for a mocked capability → `{content:[{type:'text',...}], isError:false}`.
- `tools/call` for a capability that throws → `{isError:true, ...}`.
- Unknown method → JSON-RPC error code `-32601`; malformed JSON → `-32700`; missing id on a
  non-notification → `-32600`.
- Notifications (`initialized`, `cancelled`) → no response (`null`).
- `shutdown` → triggers session quit, returns `{result:null}` then process exit (test the
  handler's return, not actual process exit).

**Green:** `src/mcp/browser-mcp.ts`:
- Read stdin line-by-line (`readline` on `process.stdin`), write JSON-RPC responses to stdout
  (single `process.stdout.write` per message; **never** anything else on stdout).
- Wire `handleMessage` → dispatch: `initialize`/`notifications/initialized`/`tools/list`/
  `tools/call`/`shutdown`/`exit`/`ping`.
- `tools/call` path: acquire session mutex → `session.getSlaveId()` → call the mapped tool
  handler → wrap `CapResult` into `{content:[{type:'text', text}]}`; on error →
  `{isError:true}`. Per-call timeout (30s, `AbortController`-style guard around the await).
- Lazy boot: `buildStack()` only runs on the first `tools/call` (not at `initialize`).
- `getLogger('browser-mcp')` for boot/session/call logging to stderr.
- `browser_quit` tool: `session.quit()` (see T5 for the tool itself).

**Verify:** `bun test tests/unit/mcp/protocol.test.ts`; `bunx tsc --noEmit` only at the end per
repo guardrail (ask human first).

### T5. Layer 2 — convenience tools + SERP parser

> ✅ **DONE** — `src/mcp/serp-parser.ts` (`parseGoogleSerp` + `SerpResult`; regex/string parser, no
> DOM lib; strips ads `.uEierd`/`data-text-ad`/`data-ad-slot`, decodes `/url?q=` redirects, missing
> snippet → `''`, entity decode `&amp; &lt; &gt; &quot; &#39; &nbsp;`). `tests/unit/mcp/serp-parser.test.ts`:
> 6 pass. `buildConvenienceTools(ctx)` → 7 tools: `google_search` (navigate + sleep + `outerHTML`
> evaluate → parse), `browser_open`, `browser_extract` (`auto:extract:markdown` wrap),
> `browser_screenshot` (direct `governor.captureScreenshot` → base64 text), `browser_list_caps`,
> `browser_status`, `browser_quit`. Wired into `assembleTools`. `browser-tools.test.ts`: 17 pass.

**Red:** `tests/unit/mcp/serp-parser.test.ts` + extend `browser-tools.test.ts`:
- `parseGoogleSerp(html)`: organic result fixture → `[{rank, title, url, snippet}]`; strips ad
  blocks (`.uEierd`/`[data-text-ad]`), decodes Google redirect URLs (`/url?q=`), handles missing
  snippet (empty string, not undefined).
- `buildConvenienceTools(ctx)` returns the 7 tools; each has correct name + zod-derived schema;
  `google_search` schema has `query` (required string) + optional `numResults`/`lang`.

**Green:**
- `src/mcp/serp-parser.ts` — `parseGoogleSerp(html: string): SerpResult[]` using a lightweight
  regex/string parser over the SERP HTML (no DOM lib — no new deps). Extract `h3` titles,
  `a` hrefs (decode `url?q=`), snippet text from `.VwiC3b` / `div[data-sncf]`. Rank = index+1.
- Extend `src/mcp/browser-tools.ts` with `buildConvenienceTools(ctx: ToolCtx)` where `ToolCtx =
  { getSlaveId, governor, registry, session }`:
  - `google_search` — navigate to `https://www.google.com/search?q=<encoded>&num=N`, wait
    `#search` (via `auto:wait:wait-selector` or governor `evaluate` poll), then
    `governor.evaluate(slaveId, <serp-extractor-expression>)` → HTML string → `parseGoogleSerp`.
  - `browser_open` — `auto:nav:navigate` + poll `document.readyState === 'complete'`.
  - `browser_extract` — `auto:extract:markdown` (optional URL → navigate first).
  - `browser_screenshot` — governor `captureScreenshot` → base64 PNG text block.
  - `browser_list_caps` — enumerate `registry.list()` (names, descriptions, schemas).
  - `browser_status` — `session.status()`.
  - `browser_quit` — `session.quit()`, returns `{ok:true, detail:'quit'}`.
- Wire Layer 2 tools into the `tools/list` result alongside Layer 1 in `browser-mcp.ts`.

**Verify:** `bun test tests/unit/mcp/serp-parser.test.ts tests/unit/mcp/browser-tools.test.ts`.

### T6. opencode.json wiring

> ✅ **DONE** — `mcp.vivim-browser` entry added (`{"type":"local","command":["bun","run","src/mcp/browser-mcp.ts"],"enabled":true}`)
> next to `playwright`. Restart opencode to load.

Edit `opencode.json` `mcp` block to add:

```json
"vivim-browser": {
  "type": "local",
  "command": ["bun", "run", "src/mcp/browser-mcp.ts"],
  "enabled": true
}
```

**Verify:** `bunx --bun json -f` or read back with a bun script; then restart opencode so the new
MCP is loaded.

### T7. Integration + live smoke test

> ✅ **DONE** — `tests/integration/mcp/browser-mcp.test.ts` (16 pass / 42 expects) adds
> `describe('full protocol round-trip …')`: initialize (protocolVersion/serverInfo), tools/list
> (>100 incl. google_search, browser_quit), google_search round-trip (mock governor feeds SERP
> fixture on `outerHTML` evaluate), unknown tool → isError, `browser_quit` then relaunch spawns
> fresh shared slave (spawn count 1→1→2), plus a **spawn-based lifecycle test** asserting the real
> process exits cleanly (code 0, stdout clean) after an `exit` notification.
>
> **Live smoke (manual, verified):** full client round-trip against the real server — initialize +
> 139-tool `tools/list` + `browser_list_caps` + `browser_status` (real headless Chrome on
> chrome-profiles/generic/default) + `browser_quit`, then clean exit with **no orphaned bun/chrome
> processes** remaining. This caught three teardown/pollution bugs (see Status header) — all fixed.

**Verify:** `bun test tests/unit/mcp/ tests/integration/mcp/` — **65 pass / 0 fail**. ✅

**Red→Green:** extend `tests/integration/mcp/browser-mcp.test.ts`:
- Full protocol round-trip against the **mock governor** stack: initialize → tools/list →
  `tools/call browser_nav_navigate` (mock transport returns success) → result `ok:true`.
- Shared slaveId assertion: two consecutive `tools/call`s use the same `ensureGenericBrowser`
  result (mock governor counts spawns).
- `browser_quit` → relaunch on next call works.

**Live smoke (manual, optional):** run `bun run src/mcp/browser-mcp.ts`, speak the protocol from a
tiny test client (or drive via a temporary `.runtime/mcp-smoke.ts`), call `google_search`
against real Google; assert structured results or CAPTCHA error. Then `browser_quit`.

**Verify:** `bun test tests/unit/mcp/ tests/integration/mcp/`.

## Definition of Done

- All new tests pass: `bun test tests/unit/mcp/ tests/integration/mcp/`. ✅ (65/0)
- `bun run devops verify-cross-surface` unaffected (no capability registry changes). ✅ (no changes)
- Lint: `bun run lint` on the new `src/mcp/*` + test files. ✅ (production files clean; test files warn-only)
- opencode loads `vivim-browser` and can `tools/list` all ~130 + 7 tools. ✅ (139 real tools in smoke)
- No new npm dependencies; nothing written to vivim's DB. ✅
- Typecheck per repo guardrail: run `bunx tsc --noEmit` only after human confirmation. ⏸ Pending human go-ahead.

## Risks

- **Google anti-bot:** CAPTCHA/consent walls may break `google_search`; `browser_extract` is the
  fallback. Stealth engine is applied by the governor on connect.
- **Schema drift:** zod→JSON Schema only handles shapes currently used by the defs; unsupported
  shapes throw loudly (surfaced in tests), not silently.
- **stdout pollution:** any stray `console.log` breaks JSON-RPC — log exclusively through
  `getLogger` (pino → stderr). Enforced in code review; protocol test asserts stdout stays clean.
