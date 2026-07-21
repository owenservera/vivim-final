# Research: LLM-as-Human Production Testing System

## R1: CLI REPL Programmatic Access

**Question**: How does the existing CLI REPL accept commands programmatically?

**Findings**:
- CLI entry: `src/cli/index.ts` — interactive REPL using `readline`
- Commands dispatched via `CommandRegistry.resolve()` → `CommandHandler.execute()`
- `registry-bridge.ts` bridges CLI commands to `UnifiedCapabilityRegistry`
- CLI can accept piped input: `echo "conversations list" | bun run src/cli/index.ts`
- Built-in commands: `automate`, `moments` (in `src/cli/commands/builtins.ts`)

**Decision**: CLI adapter spawns `bun src/cli/index.ts` as child process, writes commands to stdin, captures stdout. Use `Bun.spawn` with pipes for stdin/stdout.

**Alternatives considered**:
- Direct `CommandRegistry` import (rejected: would bypass the real CLI path, not testing what humans see)
- HTTP proxy to API (rejected: CLI has its own output formatting)

## R2: MCP WebSocket Protocol

**Question**: What is the exact WebSocket protocol for MCP tool invocation?

**Findings**:
- `McpServerAdapter` in `src/engines/mcp-server-adapter.ts`
- Serves on configurable port (default from config)
- Tools registered from `UnifiedCapabilityRegistry.list({ surface: 'mcp' })`
- WebSocket protocol: JSON-RPC style messages
- Tool list: `tools/list` → returns `McpToolDefinition[]`
- Tool call: `tools/call` → returns `{ content, isError? }`
- Also has base Chrome tools: `chrome_launch`, `chrome_navigate`, `chrome_click`, `chrome_send_keys`

**Decision**: MCP adapter connects via `BunWebSocket`, sends `tools/list` to discover tools, sends `tools/call` to invoke. Use JSON-RPC message format.

**Alternatives considered**:
- Import `McpServerAdapter` directly (rejected: would bypass WebSocket transport, not testing real MCP)

## R3: WorkflowEngine Instantiation

**Question**: How does `WorkflowEngine` instantiate without full server context?

**Findings**:
- `WorkflowEngine` constructor takes: `governor`, `store`, `eventBus`, `memoryEngine?`, `semanticSearch?`, `knowledgeIngestion?`, `synthesizer?`, `hitlStore?`
- `human-in-loop.test.ts` shows mock pattern: mock governor, mock store, real `CapabilityEventBus`
- Store needs: `getWorkflow`, `saveWorkflow`, `deleteWorkflow`, `saveExecution`, `getExecution`
- HITL store needs: `createGate`, `updateGate`, `getPendingGates`

**Decision**: Workflow adapter imports `WorkflowEngine` + mock stores (same pattern as `human-in-loop.test.ts`). Real `CapabilityEventBus` for event capture.

**Alternatives considered**:
- Full server bootstrap (rejected: too heavy for isolated workflow tests)
- HTTP API only (rejected: can't test HITL gate resolution via HTTP easily)

## R4: Chrome Slave Ports

**Question**: What Chrome slave ports are used for Gemini/ChatGPT/Claude?

**Findings**:
- Chrome profiles in `chrome-profiles/<provider>/<accountId>`
- `ProfileAllocator` resolves profile directories
- `ChromeGovernor` manages CDP connections
- CDP proxy port: configurable (default 9222 for base Chrome)
- Each slave has its own CDP port allocated by `FleetSupervisor`
- `open-claude-in-chrome_*` tools handle connection automatically

**Decision**: Provider adapter uses `open-claude-in-chrome_*` tools which abstract away port management. Connect via `tabs_context_mcp` → `tabs_create_mcp` → `navigate` → interact.

**Alternatives considered**:
- Hardcode ports (rejected: ports are dynamic, allocated by FleetSupervisor)
- Import Governor directly (rejected: Governor Canon — only Governor touches CDP, and `open-claude-in-chrome_*` goes through Governor)

## R5: open-claude-in-chrome Tool Mapping

**Question**: How do `open-claude-in-chrome_*` tools map to CDP commands?

**Findings**:
- `tabs_context_mcp` → get/create tab group
- `tabs_create_mcp` → create new tab
- `navigate` → `Page.navigate`
- `find` → accessibility tree search
- `read_page` → `Accessibility.snapshot`
- `left_click` → `Input.dispatchMouseEvent` + `DOM.focus`
- `type` → `Input.dispatchKeyEvent` (per character)
- `screenshot` → `Page.captureScreenshot`
- `read_console_messages` → `Runtime.consoleAPICalled` events
- `read_network_requests` → `Network.requestWillBeSent` events
- `javascript_tool` → `Runtime.evaluate`

**Decision**: UI adapter and Provider adapter both use `open-claude-in-chrome_*` tools. UI adapter tests the vivim frontend (localhost:5175). Provider adapter tests real provider UIs (gemini.google.com, chatgpt.com, claude.ai).

**Alternatives considered**:
- Direct CDP via `BunCdpClient` (rejected: violates Governor Canon)
- Playwright (rejected: separate browser instance, not testing through the real stack)

## R6: Knowledge Persistence Across Sessions

**Question**: How should knowledge persist and be loaded across LLM sessions?

**Findings**:
- `.opencode/memory/project.md` is injected into system prompt on every request
- Memory plugin provides `memory_set`/`memory_list`/`memory_replace` tools
- `bun run devops seed-memory` regenerates project memory from real data
- JSON files in `.runtime/` are standard for session data

**Decision**: Knowledge stored in `.runtime/llm-testing/knowledge/*.json`. LLM reads these files at session start via `read` tool. Session traces in `.runtime/llm-testing/sessions/`. Reports in `.runtime/llm-testing/reports/`. The LLM can also use `memory_set` to persist critical learnings into `.opencode/memory/project.md` for cross-session survival.

**Alternatives considered**:
- Database tables (rejected: overkill for test metadata, adds migration burden)
- Only memory plugin (rejected: 5000 char limit, can't store full knowledge base)
- Git-tracked files (rejected: test data shouldn't pollute repo history)

## R7: Non-Destructive Testing

**How to test without corrupting production data**:

1. **Conversations**: Create test conversations with prefix `[TEST]`, delete after test
2. **Memory**: Use `memory_forget` to clean up asserted facts
3. **Config**: Read-only testing for `config_get`; `config_set` only in test scope
4. **Workflows**: Create with `[TEST]` prefix, delete after test
5. **Provider slaves**: Type real prompts but don't send destructive commands
6. **Canvas**: Create test nodes, dismiss after test

## R8: Provider Rate Limit Safety

**How to avoid triggering rate limits**:

1. **Delay between prompts**: 5s minimum between provider interactions
2. **Prompt diversity**: Vary prompt content, don't repeat exact strings
3. **Session limits**: Max 10 prompts per provider per test session
4. **Off-peak testing**: Prefer off-peak hours for provider tests
5. **Graceful degradation**: If provider returns 429, mark as skip, don't retry
