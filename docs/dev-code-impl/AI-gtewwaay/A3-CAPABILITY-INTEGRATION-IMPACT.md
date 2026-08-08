# Impact Assessment A3 — Capability / One-Entry-Point Integration

**Assessment point 3 of 5 (DB → Engine → A3).** Scope: how the AI Gateway exposes
itself through the repo's **one-entry-point invariant** — every operation is a
`UnifiedCapability`, surfaced to CLI/UI/API/MCP/workflow via the
`UnifiedCapabilityRegistry`, driven by NL patterns in the `nlcl` catalog.

**Date:** 2026-08-08 · **Status:** Assessment (no code changed)

---

## 1. The Invariant (AGENTS.md + v10)

> Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells that
> call `POST /api/interpret` → `POST /api/capabilities/:id/execute`. New capability?
> Register in `registerDefaultCapabilities` / a `*caps.ts` module. New NL phrase? Add
> a pattern to `catalog.ts` bound to a `capabilityId`. Never hand-write CLI commands.

The gateway **must** be registered as capabilities — it cannot be a second transport.

## 2. What the Gateway Maps To

| Gateway surface (`IVIVIMGateway`) | UnifiedCapability candidate | Surfaces |
|---|---|---|
| `execute(request)` / `createExecution` + stream | `cap:ai:execute` — takes `AIRequest` JSON, returns execution handle/stream | cli, ui, api, mcp, workflow |
| `cancel` / `cancelExecution` | `cap:ai:cancel` | cli, api, mcp |
| `listModels` | `cap:ai:list-models` | cli, ui, api, mcp |
| `listProviders` | `cap:ai:list-providers` | cli, ui, api, mcp |
| `resolveRoute` | `cap:ai:resolve-route` (route preview) | cli, ui, api, mcp |
| `installProvider` | `cap:ai:install-provider` (requires confirmation) | cli, api |
| `remove/enable/disable/start/stop/restartProvider` | `cap:ai:provider-control` | cli, api, ui |
| `getProviderHealth` | `cap:ai:provider-health` | cli, ui, api |
| `subscribe(filter)` | WS channel, NOT a capability (event stream) | ws |

**Capability ID convention:** `cap:ai:execute`, `cap:ai:list-models`, etc. (repo uses
`cap:${category}:${action}`, single-segment slug rule: `cap:ai:ai` forbidden).

**Constraints enforced by `validateCapability`** (unified-registry.ts:52):
- `cli` surface ⇒ must have `cliCommand` (`{name, aliases, examples}`)
- `mcp` surface ⇒ must have `mcpToolName`
- `api` surface ⇒ must have `apiEndpoint`
- `ui` surface ⇒ must have `ui` or `uiAction` block

So each gateway capability needs cross-surface parity metadata — same pattern as
`registerNlInterpretCapability` (nl-interpret.ts) and `registerProviderCapabilities`
(provider-caps.ts).

## 3. Registration Point

**Current wiring** (`src/server/bootstrap/phases/capabilities.ts`):
`registerDefaultCapabilities(registry, services)` → `registerProviderCapabilities`
→ harness program resolver → `registerLlmTestCapabilities` →
`registerGeneratedCapabilities` → CDP method registrar → `connectCapabilityRegistry`
(CLI bridge) → `policyEngine`/`autonomousEngine`.

**Gateway registration** — additive, two options:
1. **New module `src/engines/ai-gateway-caps.ts`** with `registerAiGatewayCaps(
   registry, gateway)` called from `bootstrapCapabilitiesPhase` right after
   `registerProviderCapabilities`. Matches repo convention (each cap set = a
   `*caps.ts` module). **Recommended.**
2. Fold into `registerDefaultCapabilities` — rejected: it's already huge and the
   gateway has its own lifecycle + needs the `IVIVIMGateway` instance, which
   shouldn't be an optional `BootstrapServices` field at phase-1 seed time.

**Where the `IVIVIMGateway` instance comes from:** built in a new boot phase
(§A5) and stored on `ctx.aiGateway`; `bootstrapCapabilitiesPhase` reads it and
registers the cap set. If the gateway isn't available (e.g. config off), skip
registration gracefully (same try/catch pattern as MCP server, line 304).

## 4. NL Catalog Binding

Add a category file `src/engines/nlcl/categories/ai-gateway.ts` and register it in
`catalog.ts` `getDefaultCommandPatterns()` (catalog.ts:34). Patterns bind to
`capabilityId` = `cap:ai:*`:

| NL pattern (examples) | capabilityId |
|---|---|
| "run AI", "execute ai request", "ask <model>" | `cap:ai:execute` |
| "list ai models", "which models" | `cap:ai:list-models` |
| "list ai providers", "ai providers status" | `cap:ai:list-providers` |
| "route this", "which provider handles this" | `cap:ai:resolve-route` |
| "install ai provider <plugin>" | `cap:ai:install-provider` |
| "restart ai provider <x>", "stop ai provider <x>" | `cap:ai:provider-control` |

Existing `llmPatterns` (llm.ts category) already covers `send message to X` — the
gateway caps **complement** it; verify no pattern collisions after adding (the
`fuzzy-matcher`/`layered-resolver` will rank; intentional overlap is fine but must
be tested).

## 5. Streaming / WS Surface

`IVIVIMGateway.execute()` returns `AsyncIterable<AIEvent>` — the repo already has
WS event streaming (frontend `ws://localhost:9420/ws`, `DevConsole` WS firehose).
Mapping `cap:ai:execute` to a streamed capability handler is consistent with
`isAsync: true` on all `makeCapability` outputs. The **subscribe() control plane**
(`GatewayEvent` bus) maps to the existing WS event channel via an adapter
(§A5), not a capability — matches how `CapabilityEventBus` events already flow.

## 6. What Changes (additive)

| Change | Type |
|---|---|
| `src/engines/ai-gateway-caps.ts` (cap set + cross-surface metadata) | NEW |
| `src/engines/nlcl/categories/ai-gateway.ts` + `catalog.ts` one-line registration | NEW + EDIT |
| `bootstrapCapabilitiesPhase` — 3-line registration call (guarded) | EDIT (additive) |
| `BootstrapContext` — `aiGateway?:` field + `BootstrapEnginesResult` (optional) | EDIT (additive) |
| WS streaming adapter for gateway `subscribe()` | NEW (P2/P3) |

## 7. Verification Gates

- `bun run devops verify-cross-surface` — asserts every capability resolves across
  CLI (name), API (path), MCP (tool name), UI (slot id). **Run after P2.**
- `POST /api/interpret` with NL phrase → returns `cap:ai:*` chain.
- `POST /api/capabilities/cap:ai:list-models/execute` → models list.
- `bun run devops audit-code surface` clean.
