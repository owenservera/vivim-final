# Vivim Browser Automation MCP Server — Design Spec

**Date:** 2026-08-08
**Status:** Approved
**Approach:** A — Standalone stdio MCP server

## 1. Problem

vivim has a complete browser-automation stack (`ChromeGovernor` + `BrowserCapabilityRegistry`
with 100+ capabilities, `AgenticLoopEngine`, recipes) but it is only reachable through vivim's
own runtime (CLI/devops commands, capability handlers, a WebSocket `McpServerAdapter` that
exposes a handful of stub tools). The existing `web_query` capability is plain HTTP fetch, not
real browsing. There is no way for an external agent (opencode, Claude Code, Cursor, etc.) to
drive vivim's owned Chrome for live web search and research.

This spec adds a standalone **MCP server over stdio** that bootstraps the full vivim
browser-automation stack in-process and exposes it as standard MCP tools. Google search is one
example use case; the surface is the complete registry.

## 2. Goals

- Expose every `BrowserCapabilityRegistry` capability as an MCP tool, plus a small set of
  convenience tools (google_search, browser_open, browser_extract, browser_screenshot,
  browser_list_caps, browser_status, browser_quit).
- Work with any MCP-capable agent with zero runtime dependencies on the vivim server.
- Reuse vivim's proven browser machinery (stealth, semantic grounding, selector healing,
  recipes, Governor Canon) rather than inventing a parallel path.
- Persistent shared Chrome session per MCP process lifetime.
- Full access, no trust gates (per user decision).
- Results returned to the calling agent only; nothing persisted to vivim's DB.

## 3. Non-Goals

- No changes to the `ChromeGovernor` core, `BrowserCapabilityRegistry`, or existing engines.
- No vivim-server dependency (the MCP server is standalone).
- No new npm dependencies — the repo's MCP code is deliberately hand-rolled JSON-RPC; the
  stdio transport follows the same pattern.
- No persistence of results into vivim Nodes/memory/research briefs (returned only).
- No agentic-loop / research-recipe orchestration as MCP tools in this iteration (the registry
  tools can express those flows; a later iteration may wrap `AgenticLoopEngine` directly).

## 4. Architecture

One primary entry point: `src/mcp/browser-mcp.ts`. It is a self-contained stdio MCP server.

```
opencode agent ──(stdio JSON-RPC)──► src/mcp/browser-mcp.ts
                                         │
                                         ├── ChromeGovernor (CdpTransportImpl, GovernorStoreImpl via getDb())
                                         ├── SemanticGroundingEngine
                                         ├── BrowserCapabilityRegistry (100+ caps, 12 axes)
                                         └── SelectorHealer (auto-heal on failed resolution)
```

`BrowserHarnessActions` (recipe execution: search/deep/crawl/compare) is intentionally **not**
wired in this iteration — recipes aren't exposed as MCP tools (see Non-Goals). Wiring it later is
a two-line change (`governor.setBrowserHarness(new BrowserHarnessActions(governor))`).

### 4.1 Process lifecycle

1. Process starts; reads line-delimited JSON-RPC messages from stdin, writes responses on
   stdout. stderr is reserved for logs via `getLogger` (pino) — stdout must stay clean for the
   protocol.
2. **Lazy boot** — the stack assembles on the first `tools/call`, mirroring
   `buildLocalDiscoveryStack` in `src/cli/discovery-stack.ts` (`getDb()` → `GovernorStoreImpl`
   → `ChromeGovernor` → `setCdpTransport(new CdpTransportImpl())` → `SemanticGroundingEngine`
   → `BrowserCapabilityRegistry` → `registry.healer = new SelectorHealer(grounding)`).
3. **Persistent session** — `ensureGenericBrowser()` spawns one shared Chrome slave on first
   use; every tool call reuses it until process exit or `browser_quit`. The server
   auto-injects the resolved `slaveId` into each capability's ctx.
4. Protocol handshake: `initialize` → `tools/list` → `tools/call` loop; `shutdown`
   notification kills Chrome and exits.

### 4.2 opencode.json registration

```json
"mcp": {
  "vivim-browser": {
    "type": "local",
    "command": ["bun", "run", "src/mcp/browser-mcp.ts"],
    "enabled": true
  }
}
```

Works in any MCP client; no vivim server running required.

## 5. Tool surface

### 5.1 Layer 1 — full registry, mapped 1:1

Every capability in `BrowserCapabilityRegistry` becomes an MCP tool named
`browser_<axis>_<action>`:

- `auto:nav:navigate` → `browser_nav_navigate`
- `auto:input:click` → `browser_input_click`
- `auto:extract:markdown` → `browser_extract_markdown`
- `auto:tab:open` → `browser_tab_open`

All ~130 capabilities across 12 axes (nav/input/scroll/wait/extract/capture/tab/net/state/
observe/flow/os). Each tool's input schema is generated mechanically from the capability's
Zod params (`def.params` → JSON Schema); description from `def.description`. Axis/trust
metadata attaches as `_meta`. The `flow` axis markers (branch-if/loop-while/parallel/…) are
no-op markers by design and are exposed for completeness (return their params).

### 5.2 Layer 2 — convenience tools

- `google_search(query, numResults?, lang?)` — navigate to `https://www.google.com/search?q=…`,
  wait for `#search`, extract organic result blocks, return `[{rank, title, url, snippet}]`.
- `browser_open(url)` — navigate + wait for `readyState === 'complete'`.
- `browser_extract(url?)` — `auto:extract:markdown` with optional URL.
- `browser_screenshot(url?, fullPage?)` — PNG (base64).
- `browser_list_caps(axis?)` — introspection (names, descriptions, schemas).
- `browser_status` — session info (slaveId, current URL, ready state, running Chrome PID).
- `browser_quit` — kill shared Chrome + session; next call relaunches.

### 5.3 Semantic grounding

Grounding capabilities (input/extract that target elements) resolve through
`SemanticGroundingEngine`, so targets can be addressed by `text`, `ariaLabel`, `testid`,
`role`, `placeholder` — not just CSS — and `SelectorHealer` auto-repairs failed selectors.

## 6. Trust gating

Full access, no gates. Every tool maps straight to its capability handler. The registry's
`TRUST` presets (read/write/destructive) are metadata only and do **not** block execution.
This means forms can be submitted, storage set, network requests intercepted, and shell
commands run (`auto:os:shell-run`) through the tools. This is a genuinely destructive-capable
surface operating on the live Chrome profile.

## 7. Data flow

```
google_search("opencode mcp config")
  → ensureGenericBrowser()  (spawn shared Chrome, first time)
  → auto:nav:navigate       (Page.navigate to google.com/search?q=…)
  → auto:wait:wait-selector (#search)
  → extract SERP blocks via Runtime.evaluate
  → returns [{rank, title, url, snippet}]
```

Every `tools/call` result is a `text` content block containing the capability's `CapResult`
(ok/error, `output`, `detail`). Search results are structured JSON text; screenshots are base64
PNG. Nothing is persisted to vivim's DB.

## 8. Concurrency & timeouts

- Per-call timeout (default 30s) aborts a hung page and returns an error result.
- Concurrent calls serialize through a simple async mutex (single shared browser).
- Watchdog surfaces whether Chrome is alive; dead Chrome is transparently relaunched on the
  next call.

## 9. Error handling

- Capability failures (CDP errors, selector resolution failure, zod validation) →
  `{ isError: true, content: [{type:'text', text: <message>}] }`.
- Malformed JSON-RPC → JSON-RPC error object with codes -32700/-32600/-32601.
- Browser-not-spawnable (Chrome missing, port conflict) → structured error with spawn log tail.
- All internal errors logged to stderr via pino `getLogger` — never stdout.

## 10. Logging

- Info: boot, session spawn/kill, tool call entry/exit (name, durationMs, ok/error).
- Standalone process; does not write to vivim-server.log.

## 11. Testing

- **Unit — tool mapping** (`tests/unit/mcp/browser-tools.test.ts`): every registry capability
  produces a tool with the right name `browser_<axis>_<action>`, JSON-Schema-derived input
  schema, correct description. Covers all ~130 caps.
- **Unit — zod→JSON Schema**: optional/required/defaults (e.g. wait timeouts, input text).
- **Unit — protocol**: initialize/list/call/error handling with a stubbed transport.
- **Unit — SERP parser**: Google result HTML fixture → correct structured results
  (strips ads, handles missing snippets).
- **Integration — mock governor** (`tests/integration/mcp/`): tool calls route through the
  registry with the shared slaveId auto-injected (mirrors `browser-automation.test.ts` mock).
- Commands: `bun test tests/unit/mcp/ tests/integration/mcp/`. One optional live smoke test
  (`browser_quit` → relaunch).

## 12. Rollout order

1. `src/mcp/browser-mcp.ts` core + stack assembly.
2. Registry → tool mapping (Layer 1).
3. Protocol layer + session management.
4. Convenience tools + SERP parser (Layer 2).
5. `opencode.json` wiring.
6. Tests (unit + integration).
7. Live smoke test with a real Google search.

## 13. Files

- **New:** `src/mcp/browser-mcp.ts` (entry + assembly + protocol + session)
- **New:** `src/mcp/browser-tools.ts` (tool mapping + convenience tools + SERP parser)
- **New:** `src/mcp/browser-session.ts` (slave lifecycle, mutex, watchdog) — may be folded
  into browser-mcp.ts if it stays small
- **New:** `tests/unit/mcp/browser-mcp.test.ts`, `tests/unit/mcp/browser-tools.test.ts`,
  `tests/unit/mcp/serp-parser.test.ts`, `tests/integration/mcp/browser-mcp.test.ts`
- **Edit:** `opencode.json` (register `vivim-browser` MCP)

## 14. Risks

- **Google anti-bot:** Google may present CAPTCHA or consent walls to automated browsers.
  Mitigation: vivim's stealth engine is applied on slave connect
  (`ChromeGovernor.ensureRunning`), and the shared Chrome is a real (non-headless) profile.
  If SERP parsing fails, `browser_extract` remains as a fallback.
- **Destructive surface:** full-access tools can submit forms / run shell commands. Per user
  decision this is intended; the design documents it rather than gates it.
- **Schema drift:** tool names derive from the registry at boot, so registry additions
  surface automatically; no static duplicate.
