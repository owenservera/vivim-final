---
name: llm-testing
description: Run the LLM-as-Human production test suite in vivim-final. Covers the six UnifiedCapability entries (llm_test_run, llm_test_report, llm_test_status, llm_test_patterns, llm_test_providers, llm_test_parity), cross-surface parity verification (cli=ui=api=mcp), and the knowledge store. Use when testing the platform end-to-end, checking capability parity across surfaces, auditing provider quirks, or running a smoke/full/parity/providers/workflow test pass.
---

# LLM-as-Human Testing

The LLM acts as a real user across every surface (cli, ui, api, mcp, workflow, provider).
Everything is driven through the **One Entry Point**: each test action is a
`UnifiedCapability` (`cap:llm_test:*`) resolved via `POST /api/capabilities/:id/execute`,
the CLI bridge (`syncCliFromUnified`), and MCP — never a parallel transport.

## Capabilities (registered in `devops/llm-testing/capabilities.ts`)

| Capability | Surfaces | What it does |
|------------|----------|--------------|
| `llm_test_run` | cli, api, mcp | Run the test suite. Inputs: `mode` (smoke/full/parity/providers/workflow), `surfaces[]`, `providers[]`. Returns a `SessionTrace` with summary. |
| `llm_test_report` | cli, api, mcp | Show the markdown report for a finished session. Input: `sessionId` (e.g. `sess_20260720_120000`). |
| `llm_test_status` | cli, api, mcp | Show per-surface coverage + top risk priorities. |
| `llm_test_patterns` | cli, api, mcp | List learned test patterns (capability → action → confidence). |
| `llm_test_providers` | cli, api, mcp | Show provider knowledge: composer selector, send method, stream format, success rate, quirks. |
| `llm_test_parity` | cli, api, mcp | **Cross-surface parity check** — asserts every capability is reachable from cli/ui/api/mcp. Returns `{ total, parityGaps, pass }`. |

## How an agent runs it

The backend must be running (`CAP_STORE_PORT`, this env: `9421`; canonical: `9420`).

**Via CLI (after `syncCliFromUnified` bridges the registry):**
```
llm-test run --mode smoke
llm-test run --mode full --surface cli --surface ui
llm-test run --mode providers --providers gemini,chatgpt
llm-test parity
llm-test status
llm-test report sess_20260720_120000
```

**Via API (the universal route — same handler the CLI calls):**
```
POST /api/capabilities/cap:llm_test:run/execute
{ "input": { "mode": "smoke" } }

POST /api/capabilities/cap:llm_test:parity/execute
{ "input": {} }
```

**Via MCP:** tools `llm_test_run`, `llm_test_parity`, `llm_test_status`, `llm_test_report`,
`llm_test_patterns`, `llm_test_providers` (exposed by `src/engines/mcp-server-adapter.ts`).

## Surfaces & adapters

`TestOrchestrator` (`devops/llm-testing/test-orchestrator.ts`) routes each surface to
an adapter:

- **cli** — spawns `bun run src/cli/index.ts`, derives commands from `registry.list({surface:'cli'})`.
- **api** — `fetch` to backend, derives endpoints from `registry.list({surface:'api'})`.
- **mcp** — WebSocket JSON-RPC, discovers live tools from the MCP server (which wraps the registry).
- **ui** — Playwright via an injected `PlaywrightBridge` (open-claude-in-chrome_*).
- **provider** — Chrome slave via injected `ChromeToolBridge` (open-claude-in-chrome_*). Rate limit: 5s delay, max 10 prompts/provider/session.
- **workflow** — mock `WorkflowEngine` execution.

All adapters accept the live `UnifiedCapabilityRegistry` so the suite never drifts from the
canonical capability set. UI/provider adapters route **only** through Governor-routed bridges
(Governor Canon — no direct CDP in the testing engine).

## Knowledge store

Flat JSON under `.runtime/llm-testing/knowledge/`: patterns, providers, surface coverage,
errors, priorities. Session traces at `.runtime/llm-testing/sessions/<id>.json`, reports at
`.runtime/llm-testing/reports/<id>.md`.

## Parity mandate

The user mandate is **frontend = backend = cli = api = mcp**. `llm_test_parity` is the
machine-readable assertion of that: it scans the registry and reports any capability missing
from one of the four parity surfaces. Treat a non-empty `parityGaps` as a regression.

## Devops tracker

Units live in Phase 14 of `docs/atomic-v3-fork-canon/01-tracker.md`
(`bun run devops select --tracker docs/atomic-v3-fork-canon/01-tracker.md`).
