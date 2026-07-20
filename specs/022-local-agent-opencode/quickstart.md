# Quickstart & Validation: Local-Agent OpenCode Provider (Phase 1)

**Feature**: `022-local-agent-opencode` | **Date**: 2026-07-19

Run these to prove the feature works end-to-end. Prerequisites: `opencode` on PATH (bun),
`bun` installed, dev DB migrated.

## Prerequisites

```powershell
# Repo root
Set-Location "C:\0-BlackBoxProject-0\vivim-final"
# Verify opencode present (Zen free, no key)
opencode --version
opencode models | Select-String "opencode/"
```

## Scenario 1 — Provider seeds with 4 free models (SC-003, FR-001)

```powershell
bun run devops runtime-test status --provider=opencode
```

**Expected**: provider `opencode` (`provider_type: local-agent`) listed with exactly 4 models:
`deepseek-v4-flash-free`, `hy3-free`, `mimo-v2.5-free`, `north-mini-code-free`. `nemotron` absent.

## Scenario 2 — Dispatch via capability (SC-001, FR-002/003)

```powershell
bun run devops runtime-test test --nl "run deepseek agent: reply with the single word PONG"
```

**Expected**: `cap:agent:run` executes `opencode run --auto --model opencode/deepseek-v4-flash-free --format json "..."`,
returns `ContentBlock[]` containing `{type:'text', text:'PONG'}` within ~120s.

## Scenario 3 — Allow-list rejects nemotron (SC-002, FR-004)

```powershell
bun run devops runtime-test test --nl "run nemotron agent: say hi"
```

**Expected**: rejected with `EngineError` ("model not in allow-list") — **zero** `opencode` subprocess spawns.

## Scenario 4 — Surface parity (SC-004, FR-002)

```powershell
bun -e "import('./src/engines/unified-registry.js').then(m=>{/* registered cap:agent:run */})"
bun run devops verify-cross-surface
```

**Expected**: `agent_run` appears under CLI (`cliCommand`), API (`/api/capabilities/agent_run/execute`
or equivalent), MCP (`mcpToolName`), and UI (`ui`) in `verify-cross-surface` output.

## Scenario 5 — Unit: parse + allow-list (FR-003/004)

```powershell
bun test tests/unit/engines/local-agent-executor.test.ts
```

**Expected**: Fixture `--format json` payload from `evidence/opencode-agentic/notes.md` parses to
`[{type:'text',text:'PONG'}]`; nemotron slug is rejected by allow-list check.

## Scenario 6 — Event bus (FR-005)

After Scenario 2, inspect `CapabilityEventBus.snapshot()` for a `capability:executed` entry with
`providerId:'opencode'`. On timeout (set `timeoutMs:1`), expect `capability:failed`.

## Failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `EngineError: opencode binary not found` | `opencode` not on PATH | `npm i -g opencode` / bun link |
| hang > 120s | agent queued | `timeoutMs` kills; check `nemotron` not requested |
| `model not in allow-list` | wrong slug | use one of the 4 free slugs |
