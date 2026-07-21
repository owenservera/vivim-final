# Feature Spec: LLM-as-Human Production Testing System

## Problem Statement

vivim-final has 40+ capabilities across 5 surfaces (CLI, UI, API, MCP, Workflow), 6 provider integrations (Gemini, ChatGPT, Claude, DeepSeek, Qwen, Grok), and a complex agentic system. Current testing is fragmented:

- `provider-testing` tests parser/selector infrastructure, not human behavior
- `vivim-runtime` drives the dev loop, not production quality
- `webapp-testing` uses scripted Playwright, not intelligent exploration
- `human-in-loop.test.ts` tests workflow gates, not real user flows

No system exists where an LLM **behaves as a human user** to test the full production surface, learns from prior sessions, and self-improves its testing strategy.

## User Stories

### US1 — LLM Tests CLI Surface
**As** the LLM acting as a human,
**I want** to type commands into the CLI REPL and verify output,
**So that** I confirm every CLI-surfaced capability works end-to-end.

**Acceptance:**
1. LLM types `conversations list` → receives array of conversations
2. LLM types `conversations create claude` → new conversation created
3. LLM types `conversations send <id> --message "hello"` → response received
4. LLM types `/switch gemini` → provider switched
5. All 20+ slash commands tested
6. Natural language phrases tested via `/api/interpret`

### US2 — LLM Tests UI Surface via CDP
**As** the LLM acting as a human,
**I want** to drive Chrome via CDP to navigate, click, type, and read the frontend,
**So that** I confirm every UI-surfaced capability renders and executes correctly.

**Acceptance:**
1. LLM navigates to `localhost:5175`, waits for load
2. LLM finds composer, types message, presses Enter
3. LLM verifies response streams into ChatSurface
4. LLM takes screenshots for visual verification
5. LLM reads console for errors
6. LLM tests canvas interactions (spawn node, mutate, dismiss)
7. LLM tests command palette (Ctrl+K), quick actions

### US3 — LLM Tests API Surface
**As** the LLM acting as a human,
**I want** to call HTTP endpoints and verify responses match contracts,
**So that** I confirm every API-surfaced capability returns correct data.

**Acceptance:**
1. LLM calls `GET /api/capabilities` → 200 with full capability list
2. LLM calls `POST /api/capabilities/:id/execute` for each capability
3. LLM validates response schemas against `outputSchema`
4. LLM tests error cases (missing params, invalid IDs)
5. LLM tests auth (if applicable)
6. All 40+ capabilities tested

### US4 — LLM Tests MCP Surface
**As** the LLM acting as a human,
**I want** to connect via WebSocket, list tools, and invoke them,
**So that** I confirm MCP-exposed capabilities work for external consumers.

**Acceptance:**
1. LLM connects to MCP WebSocket
2. LLM lists all tools → matches registered `mcpToolName` entries
3. LLM invokes each tool → verifies result
4. LLM tests tool error handling
5. All MCP-surfaced capabilities tested

### US5 — LLM Tests Provider Slaves (Gemini, ChatGPT, Claude)
**As** the LLM acting as a human,
**I want** to type prompts into real provider UIs and evaluate responses,
**So that** I confirm the Chrome slave integration works end-to-end.

**Acceptance:**
1. LLM connects to Gemini Chrome slave
2. LLM types prompt in Quill editor (uses click-to-send, not Enter)
3. LLM waits for batchexecute streaming response
4. LLM evaluates response quality
5. LLM repeats for ChatGPT (SSE) and Claude (Anthropic SSE)
6. LLM captures screenshots + console logs for each

### US6 — LLM Tests Cross-Surface Parity
**As** the LLM acting as a human,
**I want** to invoke the same capability on all surfaces and compare results,
**So that** I confirm parity across CLI/UI/API/MCP.

**Acceptance:**
1. LLM picks a capability (e.g., `conversation_list`)
2. LLM invokes via CLI → captures output
3. LLM invokes via API → captures response
4. LLM invokes via MCP → captures result
5. LLM invokes via UI → takes screenshot
6. LLM compares all outputs for semantic equivalence
7. Discrepancies flagged as parity failures

### US7 — LLM Tests Workflow + HITL Gates
**As** the LLM acting as a human,
**I want** to create workflows with human-loop nodes and resolve them,
**So that** I confirm the workflow engine handles HITL correctly.

**Acceptance:**
1. LLM creates workflow: trigger → human_loop → action
2. LLM executes workflow
3. LLM sees pending event
4. LLM resolves with approve → workflow continues
5. LLM tests reject → workflow fails
6. LLM tests skip → workflow continues

### US8 — LLM Learns from Prior Sessions
**As** the LLM acting as a human,
**I want** to read knowledge from prior sessions before testing,
**So that** I avoid repeating known failures and focus on gaps.

**Acceptance:**
1. LLM reads `knowledge/patterns.json` → knows what works
2. LLM reads `knowledge/providers.json` → knows provider quirks
3. LLM reads `knowledge/errors.json` → knows error patterns
4. LLM reads `knowledge/priorities.json` → knows what to test next
5. LLM updates knowledge after each session
6. Next session starts smarter

### US9 — LLM Self-Improves Testing Strategy
**As** the LLM acting as a human,
**I want** to analyze test results and adjust priorities,
**So that** I focus on high-risk, low-coverage areas.

**Acceptance:**
1. After session, LLM computes coverage per surface
2. LLM identifies gaps (capabilities never tested)
3. LLM identifies high-failure areas
4. LLM updates `knowledge/priorities.json`
5. Next session prioritizes gaps + high-failure areas
6. Coverage improves over time

## Technical Context

### Existing Infrastructure
- **5 surfaces**: CLI (`src/cli/`), UI (`web/ui/`), API (`src/server/`), MCP (`src/engines/mcp-server-adapter.ts`), Workflow (`src/engines/workflow-engine.ts`)
- **40+ capabilities**: registered in `src/engines/capability-bootstrap.ts` via `makeCapability()`
- **6 providers**: Gemini, ChatGPT, Claude, DeepSeek, Qwen, Grok — Chrome slaves in `chrome-profiles/<provider>/<account>`
- **CDP tools**: `open-claude-in-chrome_*` tools for browser automation
- **Existing tests**: `tests/e2e/`, `tests/integration/`, `tests/unit/`
- **Session handoff**: `handoff` skill for context persistence
- **Knowledge persistence**: `.opencode/memory/project.md` via memory plugin

### Dependencies
- Running backend on port 9420
- Running frontend on port 5175
- Chrome slaves with live sessions for Gemini/ChatGPT/Claude
- `bun` runtime

### Integration Points
- `UnifiedCapabilityRegistry` — source of truth for all capabilities
- `ChromeGovernor` — CDP proxy for provider slaves
- `McpServerAdapter` — MCP tool registration
- `WorkflowEngine` — workflow execution + HITL gates
- `NLCLEngine` — natural language resolution

## Constraints

1. **LLM-driven**: All testing must be executable by the LLM using available tools (bash, CDP, fetch, WebSocket)
2. **Session-persistent**: Knowledge survives across sessions via JSON files
3. **Non-destructive**: Tests must not corrupt production data (use test conversations, clean up after)
4. **Provider-safe**: Provider tests must not trigger rate limits or abuse detection
5. **Self-contained**: No external test frameworks required — LLM is the test runner

## Success Criteria

1. LLM can run a full test session across all 5 surfaces
2. LLM can test all 3 live providers (Gemini, ChatGPT, Claude)
3. Session traces are written to `.runtime/llm-testing/sessions/`
4. Knowledge base is updated after each session
5. Coverage improves over consecutive sessions
6. Cross-surface parity is verified for top 10 capabilities
7. HITL workflow gates are tested end-to-end
