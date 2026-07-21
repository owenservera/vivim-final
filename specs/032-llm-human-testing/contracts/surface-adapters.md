# Contract: Surface Adapters

## Interface

```typescript
export interface SurfaceAdapter {
  /** Surface name for logging and knowledge mapping */
  name: TestSurface
  
  /** Initialize adapter with test configuration */
  init(config: TestConfig): Promise<void>
  
  /** Discover all testable capabilities on this surface */
  discoverCapabilities(): Promise<TestCase[]>
  
  /** Execute a single test case */
  execute(test: TestCase): Promise<TestResult>
  
  /** Clean up resources after test session */
  cleanup(): Promise<void>
}
```

## CLI Adapter Contract

**Input**: `TestCase` with `surface: 'cli'`
**Output**: `TestResult` with stdout capture

**Behavior**:
1. Spawns `bun run src/cli/index.ts` as child process
2. Writes command to stdin
3. Captures stdout with timeout (5s default)
4. Returns output as `actual` field
5. Handles REPL prompts (e.g., `> ` prefix)

**Error handling**:
- Timeout → `status: 'error'`, `error: 'CLI timeout after 5s'`
- Non-zero exit → `status: 'fail'`, `error: exit code`
- Crash → `status: 'error'`, `error: stderr output`

## UI Adapter Contract

**Input**: `TestCase` with `surface: 'ui'`
**Output**: `TestResult` with screenshot + console logs

**Behavior**:
1. Navigates to `http://localhost:5175`
2. Waits for `networkidle`
3. Uses `find` to locate elements by description
4. Uses `click`/`type` to interact
5. Uses `screenshot` to capture visual state
6. Uses `read_console_messages` to capture errors
7. Uses `read_network_requests` to capture API calls

**Error handling**:
- Element not found → `status: 'fail'`, `error: 'Element not found: <description>'`
- Console error → `status: 'fail'`, `error: console error message`
- Navigation timeout → `status: 'error'`, `error: 'Page load timeout'`

## API Adapter Contract

**Input**: `TestCase` with `surface: 'api'`
**Output**: `TestResult` with HTTP response

**Behavior**:
1. Calls `fetch('http://localhost:9420/api/...')`
2. Validates response status
3. Validates response body against `outputSchema`
4. Returns response body as `actual`

**Error handling**:
- HTTP error → `status: 'fail'`, `error: 'HTTP <status>'`
- Schema mismatch → `status: 'fail'`, `error: validation errors`
- Network error → `status: 'error'`, `error: fetch error message`

## MCP Adapter Contract

**Input**: `TestCase` with `surface: 'mcp'`
**Output**: `TestResult` with tool invocation result

**Behavior**:
1. Connects WebSocket to MCP server port
2. Sends `tools/list` to discover tools
3. Finds tool by `mcpToolName`
4. Sends `tools/call` with input
5. Returns result as `actual`

**Error handling**:
- Tool not found → `status: 'fail'`, `error: 'Tool not found: <name>'`
- Tool error → `status: 'fail'`, `error: tool error message`
- WebSocket error → `status: 'error'`, `error: connection error`

## Workflow Adapter Contract

**Input**: `TestCase` with `surface: 'workflow'`
**Output**: `TestResult` with execution result

**Behavior**:
1. Creates `WorkflowEngine` with mock stores
2. Defines workflow from test case
3. Executes workflow
4. Captures events via `CapabilityEventBus`
5. If HITL node → resolves gate
6. Returns execution status as `actual`

**Error handling**:
- Execution error → `status: 'fail'`, `error: execution error`
- HITL timeout → `status: 'error'`, `error: 'HITL gate not resolved'`

## Provider Adapter Contract

**Input**: `TestCase` with `surface: 'provider'`
**Output**: `TestResult` with response text + screenshot

**Behavior**:
1. Connects to provider Chrome slave via `open-claude-in-chrome_*`
2. Reads `ProviderKnowledge` for provider-specific quirks
3. Types prompt in composer
4. Sends (click or Enter based on knowledge)
5. Waits for streaming response
6. Captures response text
7. Takes screenshot
8. Returns response + screenshot as `actual`

**Error handling**:
- Provider offline → `status: 'error'`, `error: 'Provider slave not running'`
- Rate limited → `status: 'skip'`, `error: 'Rate limited (429)'`
- Send failed → `status: 'fail'`, `error: 'Send failed: <reason>'`
- Response timeout → `status: 'fail'`, `error: 'Response timeout after 30s'`

**Rate limit safety**:
- Minimum 5s delay between provider interactions
- Maximum 10 prompts per provider per session
- If 429 received → skip, don't retry
