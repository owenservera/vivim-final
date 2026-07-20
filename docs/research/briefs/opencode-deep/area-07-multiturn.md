# Area 7 — Multi-Turn, Session Resume & Fork

**Verified against:** opencode v1.17.15.
**Evidence:** `evidence/opencode-deep/07-multiturn.txt`, `evidence/opencode-deep/07-run-help.txt`, `evidence/opencode-deep/07-multiturn.txt.t3-session.txt`, `*.t4-fork.txt`

## Flags
- `-c/--continue` (**no argument**) — resume the LAST session.
- `-s/--session <id>` — resume a SPECIFIC session by ID.
- `--fork` — fork the session before continuing; **requires `--continue` or `--session`**.

## ⚠️ `--continue <id>` is a trap
`opencode run --continue ses_xxx "msg"` does NOT resume `ses_xxx`. `--continue` takes no arg; `ses_xxx` is parsed as the **message text**, and a brand-new session is created. Confirmed: turn-2 created `ses_085cc20b...` (new) instead of resuming `ses_0850648d...`, and the model had no memory of prior context.

## Correct resume (verified)
```
opencode run --auto -m opencode/deepseek-v4-flash-free --format json -s ses_0850648d0ffe0qr7j4DEkvW8ou "What was the code word?"
```
- **SAME session ID returned** (`ses_0850648d...` == input).
- Model **recalled the prior turn's context** ("ZEBRA"). Multi-turn works.

## Fork (verified)
```
opencode run --auto -m opencode/deepseek-v4-flash-free --format json --fork -s ses_0850648d0ffe0qr7j4DEkvW8ou "Confirm you are a forked copy"
```
- Returns a **NEW session ID** (`ses_08500cad...` ≠ parent).
- Inherits parent context (model said "FORKED" and had prior context).

## Executor rules for v2
1. To resume: always use `-s/--session <id>`, never `--continue <id>`.
2. Capture `part.sessionID` from the first `step_start` of a run; persist it for the next turn.
3. `--fork -s <id>` for parallel/isolated branches (e.g. speculative edits). Forked sessions are independent afterward.
4. Context recall across resume is best-effort — opencode compacts (Area 3); if a session was compacted, the model may lose early context. Treat long multi-turn as resilient-but-not-guaranteed.

## ACP parallel
ACP `agentCapabilities.sessionCapabilities = {close, fork, list, resume}` — fork/resume are first-class in ACP too (Area 5).
