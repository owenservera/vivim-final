# Area 6 — Permission Model & Tool Gating

**Verified against:** opencode v1.17.15.
**Evidence:** `evidence/opencode-deep/06-permissions.transcript.txt`, `evidence/opencode-deep/02-tooluse.transcript.txt`

## Two layers
1. **Config-level** (`permission: "allow"` | `"deny"` | `"ask"`): set in `opencode.json`. The v2 executor uses a scratch config with `permission: allow` (or passes `--auto`) so runs are non-interactive.
2. **Per-tool gating**: opencode evaluates each tool call against permission rules. Allowed → executes; denied/unavailable → surfaces as `invalid` tool event (below).

## Permission denial behaviour (CRITICAL)
When a tool (e.g. `bash`) is gated out in a scratch `--dir` config:
- The `tool_use` event is emitted with `part.tool:"invalid"` and `part.state.output:"Model tried to call unavailable tool 'bash'..."`.
- **The run does NOT error and exits 0.** The denial is silent from the stream's perspective.
- Logs show: `evaluated permission=... pattern=... action.action=deny` (stderr, `--print-logs`).

## Executor mapping rule
- Parse each `tool_use` event. If `part.tool === "invalid"` → this is a permission denial, NOT a completed tool. Map to `EngineError` (PermissionDenied) if the tool was required for the task; otherwise log and continue.
- Do NOT rely on exit code (0) to detect permission denial.

## `--auto` vs config `permission`
- `--auto` = auto-approve anything not explicitly denied. Equivalent to `permission: allow` for the run.
- Scratch config `permission: allow` achieves the same without the flag. Both verified working.

## Impl-doc correction
- If the impl-doc states permission denial raises a stream error or non-zero exit, that is **WRONG**. Denial = `invalid` tool event + exit 0.
