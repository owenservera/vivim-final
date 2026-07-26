---
name: llm-testing
description: Run the LLM-as-Human production test suite in vivim-final. Covers the six UnifiedCapability entries (llm_test_run, llm_test_report, llm_test_status, llm_test_patterns, llm_test_providers, llm_test_parity), cross-surface parity verification (cli=ui=api=mcp), and the knowledge store. Use when testing the platform end-to-end, checking capability parity across surfaces, auditing provider quirks, or running a smoke/full/parity/providers/workflow test pass.
---

# LLM-as-Human Testing

The LLM acts as a real user across every surface (cli, ui, api, mcp, workflow, provider).
Everything is driven through the **One Entry Point**: each test action is a
`UnifiedCapability` (`cap:llm_test:*`) resolved via `POST /api/capabilities/:id/execute`,
the CLI bridge (`syncCliFromUnified`), and MCP — never a parallel transport.

## SESSION LOGGING (CRITICAL — READ FIRST)

During live testing, findings MUST be logged sequentially to `.runtime/llm-testing/session-log.jsonl`.
This prevents loss of discoveries during context compaction or session interruption.

**Every finding gets one JSON line immediately when discovered:**
```bash
# Log a finding (append-only, never overwrite)
bun run devops llm-testing-log finding --provider=gemini --severity=P0 --category=chrome-launch --detail="user-agent string split causes tab explosion"
```

**Or write directly via the session logger script:**
```typescript
import { SessionLogger } from './devops/llm-testing/session-logger.js'
const logger = new SessionLogger('gemini')
logger.logFinding({ severity: 'P0', category: 'chrome-launch', detail: '...', file: 'src/...', line: 177 })
logger.logPhase({ phase: 'discover', status: 'pass', durationMs: 1234 })
logger.logDecision({ decision: 'Quote user-agent in buildChromeArgs', rationale: 'Windows Bun.spawn splits on spaces' })
```

**Session log location:** `.runtime/llm-testing/session-log.jsonl`
**Session summary:** `.runtime/llm-testing/session-<provider>-<timestamp>.md`

## Capabilities (registered in `devops/llm-testing/capabilities.ts`)

| Capability | Surfaces | What it does |
|------------|----------|--------------|
| `llm_test_run` | cli, api, mcp | Run the test suite. Inputs: `mode` (smoke/full/parity/providers/workflow), `surfaces[]`, `providers[]`. Returns a `SessionTrace` with summary. |
| `llm_test_report` | cli, api, mcp | Show the markdown report for a finished session. Input: `sessionId` (e.g. `sess_20260720_120000`). |
| `llm_test_status` | cli, api, mcp | Show per-surface coverage + top risk priorities. |
| `llm_test_patterns` | cli, api, mcp | List learned test patterns (capability → action → confidence). |
| `llm_test_providers` | cli, api, mcp | Show provider knowledge: composer selector, send method, stream format, success rate, quirks. |
| `llm_test_parity` | cli, api, mcp | **Cross-surface parity check** — asserts every capability is reachable from cli/ui/api/mcp. Returns `{ total, parityGaps, pass }`. |
| `llm_test_brief` | cli, api, mcp | Live system snapshot + conceptual understanding for self-directed testing. |
| `llm_test_plan` | cli, api, mcp | Atomic-level test plan: untested surface::capability pairs. |

## How an agent runs it

The backend must be running (`CAP_STORE_PORT`, this env: `9421`; canonical: `9420`).

**Via CLI (after `syncCliFromUnified` bridges the registry):**
```
llm-test run --mode smoke
llm-test run --mode full --surface cli --surface ui
llm-test run --mode providers --providers gemini,chatgpt
llm-test parity
llm-test status
llm-test brief
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

## 30-Minute Per-Provider Testing Protocol

**Objective:** For each provider (gemini, chatgpt, claude), run a comprehensive 30-minute session that tests ALL registered capabilities, ALL parser formats, ALL data types, and real-world interaction patterns — as if you are a human user testing the product.

### Phase 0: Pre-flight (2 min)

```bash
# 1. Start backend
pwsh scripts/start-backend.ps1

# 2. Verify Chrome slave is live for this provider
bun run devops runtime-test status --provider=<slug>

# 3. If no slave, set up:
bun run devops runtime-test setup --provider=<slug> --account=<slug>_owservera@gmail.com
# Then launch Chrome manually with the correct profile (see provider-testing skill)

# 4. Get system brief
bun run devops runtime-test test --mode=full
```

### Phase 1: Capability Enumeration (3 min)

List ALL capabilities registered for this provider and cross-reference with the registry:

```bash
# List all CLI-surface capabilities
bun run .runtime/list-caps.ts  # (or equivalent fetch script)

# Check parity across surfaces
bun run devops runtime-test test --mode=parity
```

For each capability found, log it to the session log:
```
[CAPABILITY] slug=conversation_send surfaces=[cli,api,mcp,ui] registered=true
[CAPABILITY] slug=<provider>_select_model surfaces=[cli,api] registered=true
```

### Phase 2: Parser Validation (5 min)

Test every known parser format for this provider:

```bash
# Unit tests (no Chrome needed)
bun test tests/unit/engines/harvested-parser.test.ts

# E2E wire format
bun test tests/e2e/provider-stream-validate.test.ts

# Individual parser validation
bun run devops runtime-test onboard test-parse --provider=<slug>
```

For each parser, verify:
- `parse(rawBody)` returns correct `ContentBlock[]`
- `detectCompletion(rawBody)` returns true/false correctly
- `getConfidence(rawBody)` > 0.5
- All content types: `text`, `reasoning`, `tool-call`, `file`, `meta`

### Phase 3: Capability Execution (10 min)

Execute EVERY registered capability with realistic inputs:

```bash
# conversation_send — requires real conversationId
bun run devops runtime-test test-cap conversation_send --input='{"conversationId":"<real_id>","message":"test message"}'

# select_model — if registered
bun run devops runtime-test test-cap <provider>_select_model --input='{"model":"gemini-2.0-flash"}'

# NL resolution for each capability
bun run devops runtime-test test --nl="send message to <provider>"
bun run devops runtime-test test --nl="list conversations"
bun run devops runtime-test test --nl="create new chat on <provider>"
```

For each capability, log:
```
[CAPABILITY_TEST] slug=conversation_send status=PASS durationMs=1234
[CAPABILITY_TEST] slug=conversation_send status=FAIL error="Missing required input: conversationId" fix="Provide test conversationId"
```

### Phase 4: Chrome/CDP Integration (5 min)

Test the live browser automation path:

```bash
# Selector validation against live DOM
bun run devops runtime-test onboard test-selectors --provider=<slug>

# CDP protocol discovery
bun run devops discover-protocol <provider_url> --hint=<slug>

# Verify Chrome is responsive
# (check port 9222, verify /json/version, verify /json/list)
```

Log Chrome-specific findings:
```
[CHROME] composer=div.ql-editor sendMethod=click-send-button enterKeyBroken=true
[CHROME] streamFormat=batchexecute quirks=["Enter doesn't work in Quill editor"]
```

### Phase 5: Cross-Surface Parity (3 min)

Assert the parity mandate: frontend = backend = cli = api = mcp

```bash
bun run devops runtime-test test --mode=parity
bun run devops verify-cross-surface
```

Log any parity gaps:
```
[PARITY] capability=conversation_send cli=PASS api=PASS mcp=PASS ui=GAP
```

### Phase 6: Stress & Edge Cases (5 min)

```bash
# Multiple rapid sends
# Concurrent capability executions
# Invalid inputs (missing fields, wrong types, empty strings)
# Nonexistent conversation IDs
# Unicode/emoji messages
# Very long messages (>4000 chars)
```

Log edge case findings:
```
[EDGE_CASE] input=empty_string capability=conversation_send status=PASS error=""
[EDGE_CASE] input=unicode_emoji capability=conversation_send status=FAIL error="encoding mismatch"
```

### Phase 7: Session Summary (2 min)

Generate the session report:

```bash
# Read back the session log
cat .runtime/llm-testing/session-log.jsonl

# Generate summary markdown
# (auto-generated from session log)
```

The summary MUST include:
- Total capabilities tested: N/M
- Pass rate: X%
- P0 findings (blockers): list
- P1 findings (degraded): list
- P2 findings (cosmetic): list
- Parser coverage: which formats tested, which missed
- Chrome quirks discovered
- Parity gaps found
- Recommendations for next session

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
