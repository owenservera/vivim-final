# Implementation Tasks: LLM-as-Human Production Testing

## Task 1: Knowledge Store
**Depends**: None

Create `src/engines/llm-testing/knowledge-store.ts` with `KnowledgeStore` class.

- Load/save JSON files from `.runtime/llm-testing/knowledge/`
- Bootstrap on first run (create default files)
- CRUD operations for patterns, providers, surfaces, errors, priorities
- Merge delta after each session

## Task 2: Surface Adapters
**Depends**: Task 1

Create `src/engines/llm-testing/adapters/` with:

### 2a: CLI Adapter (`cli-adapter.ts`)
- Spawn `bun run src/cli/index.ts` as child process
- Write to stdin, read from stdout
- Timeout handling (5s default)
- Capture exit code

### 2b: API Adapter (`api-adapter.ts`)
- `fetch()` to backend HTTP endpoints
- Status code validation
- Response body schema validation

### 2c: UI Adapter (`ui-adapter.ts`)
- Playwright page interactions
- Element discovery via `find`
- Click/type interactions
- Screenshot capture
- Console + network request logging

### 2d: MCP Adapter (`mcp-adapter.ts`)
- WebSocket connection to MCP server
- `tools/list` discovery
- `tools/call` invocation

### 2e: Workflow Adapter (`workflow-adapter.ts`)
- Create `WorkflowEngine` with mock stores
- Execute test workflows
- Event capture via `CapabilityEventBus`

### 2f: Provider Adapter (`provider-adapter.ts`)
- Connect to Chrome slave via `open-claude-in-chrome_*`
- Provider-specific send method (click vs Enter)
- Streaming response capture
- Screenshot capture
- Rate limit enforcement (5s delay, max 10/session)

## Task 3: Test Orchestrator
**Depends**: Tasks 1, 2

Create `src/engines/llm-testing/test-orchestrator.ts` with `TestOrchestrator` class.

- Load session config
- Route TestCase to correct adapter
- Execute tests sequentially
- Collect results
- Trigger knowledge update
- Generate session trace + report

## Task 4: Pattern Analyzer
**Depends**: Task 1

Create `src/engines/llm-testing/pattern-analyzer.ts` with `PatternAnalyzer` class.

- Extract patterns from test results
- Update confidence scores
- Record failures with root cause
- Generate knowledge delta

## Task 5: PriorityEngine
**Depends**: Tasks 1, 4

Create `src/engines/llm-testing/priority-engine.ts` with `PriorityEngine` class.

- Compute risk scores from error rates
- Compute coverage gaps from surface data
- Compute complexity from capability schemas
- Return sorted priority queue

## Task 6: Session Writer + Report Generator
**Depends**: Task 3

Create `src/engines/llm-testing/session-writer.ts` with `SessionWriter` class.

- Write session trace JSON to `.runtime/llm-testing/sessions/`
- Generate markdown report to `.runtime/llm-testing/reports/`
- Save screenshots to `.runtime/llm-testing/sessions/screenshots/`

## Task 7: CLI Commands
**Depends**: Task 3

Create `src/cli/commands/llm-test.ts` with CLI commands.

- `llm-test run --mode=<smoke|full|parity|providers|workflow> --surface=<surface> --providers=<list>`
- `llm-test report <sessionId>`
- `llm-test status` — show coverage + priorities
- `llm-test patterns` — show learned patterns
- `llm-test providers` — show provider knowledge

Register in `src/cli/commands/builtins.ts`.

## Task 8: DevOps Integration
**Depends**: Tasks 1–7

Add to `devops` skill:

- `bun run devops llm-test run` — Execute test suite
- `bun run devops llm-test report` — Generate report
- `bun run devops llm-test status` — Show status

## Task 9: Tests
**Depends**: Tasks 1–8

Create tests:

- `tests/unit/engines/llm-testing/knowledge-store.test.ts`
- `tests/unit/engines/llm-testing/test-orchestrator.test.ts`
- `tests/unit/engines/llm-testing/pattern-analyzer.test.ts`
- `tests/unit/engines/llm-testing/priority-engine.test.ts`
- `tests/integration/llm-testing/cli-adapter.test.ts`
- `tests/integration/llm-testing/api-adapter.test.ts`
- `tests/integration/llm-testing/provider-adapter.test.ts`

## Task 10: Documentation
**Depends**: Tasks 1–9

Update:

- `AGENTS.md` — Add LLM testing section
- `docs/atomic-v3-fork-canon/` — Add atomic units for new feature

## Task 11: Fix OpenCode Serve Boot Gating
**Depends**: Task 3

Fix the scope issue in `src/server/index.ts` where `agenticStoreImpl` is block-scoped inside the memory fabric try block but referenced by the OpenCode supervisor block.

- Move OpenCode supervisor block inside the memory fabric try block
- Verify `OPENCODE_SERVE_ENABLED=1` correctly starts the supervisor
- Test that the supervisor can be reached at the expected port

**Status**: Completed (2026-07-20)

## Task 12: Intelligent Model Discovery for Local Providers
**Depends**: Tasks 2f, 3

Update `src/engines/llm-testing/adapters/provider-adapter.ts` to query `LocalAgentStore` for available models and generate per-model test cases.

- Add `setLocalAgentStore()` method to `ProviderAdapter`
- Update `discoverCapabilities()` to query store for models
- Generate per-model test cases (e.g., `provider-opencode-send-deepseek-v4-flash-free`)
- Cache models for reuse across test executions

**Status**: Completed (2026-07-20)

## Task 13: Multi-Turn Context Retention Testing
**Depends**: Task 12

Add multi-turn context retention verification to the provider adapter.

- Add `opencode_multiturn` capability type
- Generate multi-turn test cases with secret code verification
- Implement `executeLocalProvider()` to handle multi-turn sessions
- Verify LLM retains context across messages (e.g., "My secret code is BLUE-ELEPHANT-42" → "What was the secret code?")
- Reuse session IDs for context continuity

**Status**: Completed (2026-07-20)

## Task 14: Wire LocalAgentStore into Orchestrator
**Depends**: Tasks 3, 12

Update `src/engines/llm-testing/test-orchestrator.ts` to accept and wire `LocalAgentStore` into the provider adapter.

- Add `localAgentStore` to `OrchestratorOptions`
- Update `initAdapters()` to call `provider.setLocalAgentStore()`
- Wire store from `BootstrapServices` in `llm-test-capabilities.ts`

**Status**: Completed (2026-07-20)

## Task 15: Relocate llm-testing engine to devops
**Depends**: Tasks 11–14

Per architecture decision: llm-testing is a **devops system**; the local-provider
engine lives in vivim source (`src/engines/opencode/`), the test harness moves to devops.

- Move `src/engines/llm-testing/` → `devops/llm-testing/` (orchestrator, 6 adapters, knowledge/pattern/priority/session stores, system-brief, types, index)
- Rewrite relative imports: `../../../lib/…` → `../../../src/lib/…`, `../../unified-registry.js` → `../../../src/engines/unified-registry.js`, `../../opencode/…` → `../../../src/engines/opencode/…`, `../../../storage/…` → `../../../src/storage/…`
- Keep `src/engines/llm-test-capabilities.ts` (capability registration glue) reachable from boot; update its import of the orchestrator to `../../devops/llm-testing/index.js`
- Update `src/server/index.ts:664` import path if needed (must still resolve `registerLlmTestCapabilities`)
- Delete old `src/engines/llm-testing/` after verifying imports resolve

**Status**: Completed (2026-07-20)

Notes: moved source to `devops/llm-testing/` (not `src/engines/llm-testing/`);
capability registration glue relocated to `devops/llm-testing/capabilities.ts` and
imported from `src/server/index.ts:664`. Relative imports normalized (top-level files
use `../../src/...`, adapter files use `../../../src/...`). Old `src/engines/llm-testing/`
deleted. `AGENTS.md` and `.opencode/skill/llm-testing/SKILL.md` path refs updated.

## Task 16: Wire ALL provider test results to Agent Memory (all providers)
**Depends**: Task 15

Project **every** provider test session (local `opencode` + webapp `gemini`/`chatgpt`/`claude`) into the agentic store so the memory fabric can query cross-provider results.

- Add `setMemoryStores(agenticStore, eventRecordStore)` to `ProviderAdapter`
- For each provider test execution, create an `AgentSession` (or reuse) and append the conversation messages (user prompt + provider response) via `agenticStore.appendAgentMessage`
- For local `opencode` tests, reuse `OpenCodeIngest` to project the live session; for webapp providers, project the captured prompt/response directly into `ConversationMessage`
- Ensure multi-turn sessions are recorded as a single thread (context continuity visible to memory)
- Verify results are queryable via the memory fabric after a test run

**Status**: Completed (2026-07-20)

Notes: `ProviderAdapter.execute()` now wraps `runTest()` and calls `recordToMemory()`
for every result (local + webapp paths). `recordToMemory()` lazily creates one memory
conversation thread per provider (`createOpencodeAgentSession` for `opencode`,
`startAgentConversation` for webapp providers) and appends user prompt + assistant
result via `agenticStore.appendAgentMessage`, plus a durable hash-chained
`EventRecord` (source `'llm-test'`). Orchestrator reads `agenticStore`/`eventRecordStore`
from `OrchestratorOptions` with a `globalThis.__capStoreMemory` fallback. `src/server/index.ts`
now creates `EventRecordStore` unconditionally in the memory-fabric block and stashes
both stores on `globalThis.__capStoreMemory` so the orchestrator can project even when
`OPENCODE_SERVE_ENABLED` is off. Multi-turn opencode sessions reuse `activeSessions` so
context continuity is preserved in a single thread.
