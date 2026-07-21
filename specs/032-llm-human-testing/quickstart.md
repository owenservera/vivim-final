# Quickstart: LLM-as-Human Production Testing

## Prerequisites

```bash
# Start backend + frontend
pwsh scripts/start-all.ps1

# Verify
curl http://localhost:9420/api/health   # should return 200
curl http://localhost:5175              # should return HTML
```

## Validation Scenarios

### S1: CLI Adapter — Smoke Test

Run the orchestrator in smoke mode (10 capabilities, CLI only):

```bash
bun run devops llm-test run --mode=smoke --surface=cli
```

Expected: All 10 tests pass. Session file created at `.runtime/llm-testing/sessions/sess_*.json`. Coverage deltas show cli coverage improvement.

### S2: UI Adapter — Composer Interaction

Test the frontend chat surface:

```bash
bun run devops llm-test run --mode=smoke --surface=ui
```

Expected: Navigate to localhost:5175, find composer, type "hello", press Enter. Response streams. Screenshot captured. Console errors logged (none expected).

### S3: API Adapter — REST Endpoints

Test backend API endpoints directly:

```bash
bun run devops llm-test run --mode=smoke --surface=api
```

Expected: GET /api/conversations returns array. POST /api/conversations creates conversation. All responses validated against schemas.

### S4: MCP Adapter — WebSocket Tools

Test MCP tool discovery and invocation:

```bash
bun run devops llm-test run --mode=smoke --surface=mcp
```

Expected: Connect to MCP WebSocket, call tools/list, invoke a tool, verify result.

### S5: Provider — Gemini Live

Test Gemini Chrome slave (requires browser running):

```bash
bun run devops llm-test run --mode=providers --providers=gemini
```

Expected: Connect to Gemini slave via open-claude-in-chrome, type prompt, click send (not Enter — Quill), capture streaming response. Screenshot saved.

### S6: Parity Check — CLI vs UI

Run the same capability on CLI and UI, compare outputs:

```bash
bun run devops llm-test run --mode=parity
```

Expected: Both surfaces return identical results for shared capabilities. Parity report shows mismatches.

### S7: Knowledge Persistence

Run twice, verify patterns accumulate:

```bash
# First run
bun run devops llm-test run --mode=smoke --surface=cli
# Check knowledge
cat .runtime/llm-testing/knowledge/patterns.json | jq '.patterns | length'
# → N

# Second run (should reuse patterns + add new ones)
bun run devops llm-test run --mode=smoke --surface=cli
cat .runtime/llm-testing/knowledge/patterns.json | jq '.patterns | length'
# → N + M (M >= 0 new patterns)
```

### S8: Session Report

Verify report generation:

```bash
bun run devops llm-test report <sessionId>
```

Expected: Markdown report with summary table, coverage delta, failed tests, new patterns.

### S9: Full Production Run

Run across all surfaces and providers:

```bash
bun run devops llm-test run --mode=full
```

Expected: All surfaces tested, all providers tested, knowledge updated, session saved, report generated.

## What "Done" Looks Like

- [x] `specs/032-llm-human-testing/spec.md` — Feature specification
- [x] `specs/032-llm-human-testing/plan.md` — Implementation plan
- [x] `specs/032-llm-human-testing/research.md` — Research findings
- [x] `specs/032-llm-human-testing/data-model.md` — Entity definitions
- [x] `specs/032-llm-human-testing/contracts/` — 3 contract files
- [x] `specs/032-llm-human-testing/quickstart.md` — Validation scenarios
- [ ] `specs/032-llm-human-testing/tasks.md` — Atomic implementation tasks
