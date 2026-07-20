# Area 10 — Config Precedence & Model Routing

**Verified against:** opencode v1.17.15.
**Evidence:** `evidence/opencode-deep/05-acp-stdio2.transcript.txt` (load order in logs), `evidence/opencode-deep/10-config.txt`, `evidence/opencode-deep/10-config.txt.scratch-run.txt`

## Config load order (from ACP stdout logs, in order)
```
~/.config/opencode/config.json
~/.config/opencode/opencode.json
~/.config/opencode/opencode.jsonc
<cwd>/opencode.json              <-- repo root when run from repo
<cwd>/.opencode/opencode.json
<cwd>/.opencode/opencode.jsonc
~/.opencode/opencode.json
~/.opencode/opencode.jsonc
```
Later files override earlier. **CWD `opencode.json` wins over global config.**

## Model routing
- `model` field in `opencode.json` sets the default model.
- `-m/--model <provider/model>` on the CLI **overrides** the config default for that run.
- `default_agent` resolves an agent; the agent's `model` (or the global `model`) is used. The repo `opencode.json` sets `default_agent: build` → `anthropic/claude-sonnet-4-20250514` (unauthenticated) → fatal error unless `-m` overrides (Area 9).

## Verified: scratch dir override
- Scratch dir `opencode.json`:
  ```json
  { "model": "opencode/deepseek-v4-flash-free", "permission": "allow" }
  ```
- Running `opencode run --auto --format json "Say MODELOK"` **from that scratch dir** → used the free model (output "MODELOK", exit 0), overriding the repo's `default_agent: build`.
- Running from **repo root** without `-m` → hits `default_agent: build` → sonnet unavailable → `Model not found` error (Area 9).

## Executor routing rules (v2)
1. **Always pass `-m opencode/<free-model>`** — never rely on config default (repo config points at an unauthenticated model).
2. **Run from a scratch `--dir`** with its own `opencode.json` (`model` + `permission: allow`) as defense-in-depth, so even if `-m` is dropped, the run uses a free model and is non-interactive.
3. Free models verified available: `opencode/deepseek-v4-flash-free`, `opencode/hy3-free`, `opencode/mimo-v2.5-free`, `opencode/north-mini-code-free`. (`opencode/nemotron-3-ultra-free` excluded — >5min cold timeout.)
4. Never edit the repo `opencode.json` (it is the team's dev config; the v2 backend must be side-effect-free).
