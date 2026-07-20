# Area 9 — Error & Failure Semantics

**Verified against:** opencode v1.17.15.
**Evidence:** `evidence/opencode-deep/09-errors.txt`, `evidence/opencode-deep/06-permissions.transcript.txt`, `evidence/opencode-deep/01-json-stream.transcript.txt`

## Three distinct error classes

### 1. Fatal CLI errors (before run starts)
- Example: `-s nonexistent_session_123` → stderr `Error: Session not found`, **exit 1**.
- Example: unauthenticated model enum passed as `-m` but rejected at parse → exit 1.
- NOT emitted as JSON `type:"error"` events. The executor must capture stderr + exit code for these.

### 2. Runtime errors (during run)
- Example: `-m anthropic/claude-sonnet-4-20250514` (unauthenticated) → emits `type:"error"` events:
  ```json
  {"type":"error","sessionID":"ses_...","error":{"name":"UnknownError",
   "data":{"message":"Unexpected server error. Check server logs for details.","ref":"err_..."}}}
  {"type":"error","sessionID":"ses_...","error":{"name":"UnknownError",
   "data":{"message":"Model not found: anthropic/claude-sonnet-4-20250514. Did you mean: claude-sonnet-4-5, ..."}}}
  ```
  and **exit 1**.
- The v2 executor maps `type:"error"` events → `EngineError` (Provider/Model error).

### 3. Permission denial (silent)
- `tool_use` with `part.tool:"invalid"` + exit 0 (Area 6). NOT an error class from the stream's view. Executor maps `invalid` tool → `EngineError`(PermissionDenied) if required.

## Exit-code summary
| Scenario | Exit | Signal |
|----------|------|--------|
| Clean run | 0 | final `step_finish` reason `stop` |
| Permission denied (tool) | 0 | `tool_use` `tool:"invalid"` |
| Bad session id | 1 | stderr `Error: Session not found` |
| Unavailable model (runtime) | 1 | `type:"error"` events |
| Server 500 (serve, bad model) | 500 | HTTP body `ProviderModelNotFoundError` |

## Executor error-handling rules
1. Always capture `stderr` + `exitCode` from the `Bun.spawn` process.
2. Parse stdout NDJSON; on `type:"error"` → `EngineError`.
3. On `exit !== 0` with no `error` events → read stderr for fatal CLI message → `EngineError`.
4. On `exit === 0` but `tool:"invalid"` present → `EngineError`(PermissionDenied) if the tool was required.
5. Never treat exit 0 as unconditional success — check for `invalid` tool events.
