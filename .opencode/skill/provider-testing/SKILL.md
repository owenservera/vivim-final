---
name: provider-testing
description: Test providers in vivim-final. Covers the 8-phase onboarding pipeline (discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge), parser test workflow, CDP selector validation, and provider status checking. Use when testing a provider, onboarding a new provider, or diagnosing provider-specific failures.
---

# Provider Testing

## Two Onboarding Flows

| Flow | Skill | When to Use |
|------|-------|-------------|
| **Agent-as-Explorer (APOP-AX)** | `provider-onboard-explorer` | Onboarding NEW providers (DeepSeek, Grok, Mistral). Agent autonomously discovers UI, captures streaming, generates parsers. |
| **8-Phase Pipeline** | This skill (`provider-testing`) | Testing EXISTING providers. Validates selectors, parsers, capabilities against live Chrome. |

**For new provider onboarding, use `provider-onboard-explorer` first.** This skill is for validation and diagnostics after onboarding.

## CRITICAL: Provider Setup First

**Before running ANY live phase** (discover, test-selectors, test-frontend, onboard run),
you MUST ensure a Chrome slave is running with the target provider's profile. Without this,
CDP-dependent phases fail with "No live Chrome slave found".

### Setup Checklist (run in order)

```bash
# 1. Check current state
bun run devops runtime-test status --provider=gemini

# 2a. First-time: no profile exists → opens Chrome for manual login
bun run devops runtime-test setup --provider=gemini --account=gemini_owservera@gmail.com

# 2b. Subsequent: profile on disk → restores cookies + launches headless
bun run devops agentic adopt --provider=gemini

# 3. Verify readiness
bun run devops runtime-test status --provider=gemini
# Expected: verdict "already-registered", liveSlave true, hasCookies true
```

### ⚠️ `adopt` Command Bug (KNOWN)

`bun run devops agentic adopt --provider=<slug>` parses `--provider=<slug>` as the **account slug**, not the provider. This creates a bogus profile at `chrome-profiles/<slug>/--provider_<slug>`. **Workaround:** Use `bun run devops runtime-test setup --provider=<slug> --account=<slug>_owservera@gmail.com` instead. Or launch Chrome manually with the correct profile path (see below).

### Profile Naming Discrepancy

The `setup` command creates profiles as `<provider>_<account>@gmail.com` (e.g. `gemini_owservera-at-gmail.com`), but AGENTS.md canonical path says `chrome-profiles/gemini/owservera/`. In practice, `setup` creates `chrome-profiles/gemini/gemini_owservera-at-gmail.com/`. Both work — the system resolves profiles by scanning `chrome-profiles/<provider>/` subdirectories. Don't create a second profile if one already exists.

### Manual Chrome Launch (if `adopt`/`setup` fails)

```powershell
# Kill stale Chrome first
Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force

# Launch with correct profile + remote debugging
& "C:\Users\VIVIM.inc\AppData\Local\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\0-BlackBoxProject-0\vivim-final\chrome-profiles\gemini\gemini_owservera-at-gmail.com" `
  --no-first-run `
  --disable-background-networking `
  --disable-default-apps `
  --disable-extensions `
  --disable-sync `
  --disable-translate `
  --metrics-recording-only `
  --mute-audio `
  --no-default-browser-check `
  "--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

# Wait for WebSocket URL
Start-Sleep -Seconds 3
$wsUrl = (Invoke-RestMethod "http://localhost:9222/json/version").webSocketDebuggerUrl
Write-Output "CDP ready: $wsUrl"
```

### Chrome Launch Fixes (MUST KNOW)

These bugs were found and fixed during this session. If Chrome launches create extra tabs or fail to connect, check these:

| Bug | Symptom | Fix | File |
|-----|---------|-----|------|
| User-agent string split | `--user-agent=...` with spaces split into multiple URL tabs | Wrap in quotes: `"--user-agent=..."` | `src/executor/chrome-instance-profile.ts:177` |
| Session restore | Chrome restores previous tabs on launch, causing duplicate connections | Added `--disable-restore-last-session` flag + `clearSessionRestore()` function that deletes Preferences/Sessions/ before launch | `src/executor/chrome-instance-profile.ts:175`, `src/executor/launcher.ts` |
| `--no-startup-window` | Only needed when `--app` flag is present | Conditional: `if (args.includes('--app')) result.push('--no-startup-window')` | `src/executor/chrome-instance-profile.ts:176` |

### What Happens Without Setup

- `onboard discover` → fails: "No live Chrome slave found"
- `onboard test-selectors` → fails: same
- `onboard test-frontend` → fails: same
- `engage --provider=gemini` → returns `ok: false, step: 'fleet_start'`
- `discover-protocol <url>` → fails: "No live Chrome instance found"

## The 8-Phase Onboarding Pipeline

Every provider goes through this pipeline. Each phase is a bounded, repeatable mode:

```
discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
```

| Phase | Command | Gate |
|-------|---------|------|
| discover | `bun run devops discover-protocol <url> --hint=<name>` | Returns manifest with selectors + format |
| infer | `bun run devops runtime-test onboard infer --provider=<slug>` | Confidence >= 0.7 |
| test-selectors | `bun run devops runtime-test onboard test-selectors --provider=<slug>` | All selectors match live DOM |
| test-parse | `bun run devops runtime-test onboard test-parse --provider=<slug>` | All known formats parse |
| test-cap | `bun run devops runtime-test onboard test-cap --provider=<slug>` | Capability resolves via `/api/capabilities/:id/execute` |
| test-frontend | `bun run devops runtime-test onboard test-frontend --provider=<slug>` | UI renders capability |
| verify | `bun run devops runtime-test onboard verify --provider=<slug>` | CLI + API + MCP + UI all resolve |
| converge | `bun run devops runtime-test onboard converge --provider=<slug>` | No drift from spec |

### ⚠️ `test-cap` Input Requirement (KNOWN)

The `test-cap` phase runs `conversation_send` (the default capability). This requires `conversationId` in the input — passing `{}` fails with "Missing required input: conversationId". The onboard controller was fixed to pass `{conversationId, message}` automatically (`devops/onboard-controller.ts:604-605`).

### ⚠️ `test-frontend` Not Deployed (KNOWN)

The `test-frontend` phase hits a canvas mount endpoint that returns HTTP 404. This is not yet deployed. Expect this phase to fail. The `verify` phase still passes if all other phases succeed.

### ⚠️ Capability Slug Mismatch (KNOWN)

`loadDiscoveredCapabilities` in `onboard-controller.ts` defaults the capability slug to `send_message`, but the actual registered slug is `conversation_send`. This was fixed at line 74/82. If you see "capability not found" errors during test-cap, check that the slug matches what's in the registry.

## Provider Status

Before starting, check what exists:

```bash
# All providers summary
bun run devops agentic preflight

# Single provider deep-dive (seed, profile, slave, caps, selectors, UI)
bun run devops runtime-test status --provider=gemini
```

The status command returns: `seeded?`, `profileOnDisk?`, `hasCookies?`, `liveSlave?`, `capabilityRegistered?`, `selectorConfidence?`, `uiTestStatus`. Verdict is `already-registered` / `partial` / `absent`.

## Parser Test Workflow

Each provider has harvested parsers in `seeds/parsers/harvested/<slug>-*.ts` as `LOGIC_CODE` strings. They are tested in two ways:

### 1. Unit: Format Correctness (`tests/unit/engines/harvested-parser.test.ts`)
Compiles each `LOGIC_CODE` via `new Function`, runs against representative payload samples.

```bash
bun test tests/unit/engines/harvested-parser.test.ts
```

Test gate: parser returns correct `ContentBlock[]`, `detectCompletion` works, `getConfidence > 0.5`.

### 2. E2E: Real Wire Format (`tests/e2e/provider-stream-validate.test.ts`)
Loads real captured body fixtures from `tests/fixtures/capture/<provider>.body.txt`.

```bash
bun test tests/e2e/provider-stream-validate.test.ts
```

Test gate: fixture parses into text blocks, completion detected, confidence > 0.

## CDP Selector Validation

Provider selectors (composer, send button, capture patterns) are defined in:
- `src/engines/provider-selectors.ts` — fallback selector lists
- `seeds/providers/manifests.ts` — primary selectors (DB-as-source-of-truth)

Test via:
```bash
# Unit test: validate selector patterns match known URLs
bun test tests/unit/engines/chat/selectors.test.ts

# Live DOM validation (requires Chrome slave)
bun run devops runtime-test onboard test-selectors --provider=gemini
```

## Provider-Specific Gotchas

| Provider | Composer | Send Method | Stream Format | Key Quirk |
|----------|----------|-------------|---------------|-----------|
| gemini | `div.ql-editor[contenteditable="true"]` (Quill) | Click send button | batchexecute (custom Google RPC, NOT SSE) | Enter doesn't work in Quill editor |
| chatgpt | `#prompt-textarea` | Enter or click button | SSE `data: {message: {content: {parts}}}` + `[DONE]` | Parser uses API format but wire uses chat UI format |
| claude | `div[contenteditable="true"]` (ProseMirror) | Enter or click button | SSE `data: {type, delta, content_block_start/stop}` | None significant |

## Existing Provider Test Status

From `tests/e2e/provider-stream-validate.test.ts` and live testing:

| Provider | Status | Parser | Tested | Gaps |
|----------|--------|--------|--------|------|
| claude | seeded + registered | `claude/001_streaming_sse` (inline) | tested:true conf:1 | none |
| gemini | seeded + registered | `gemini/001_batchexecute` (inline) + `gemini/002_ai_studio` + generic fallback | tested:false conf:1 | no stream_config row (custom batchexecute RPC); onboarding pipeline: 5/8 phases pass |
| chatgpt | seeded + registered | `chatgpt/001_openai_delta` (inline) + generic fallback | tested:true conf:1 | parser uses API format; wire uses chat UI format — needs real-world validation |
| deepseek | seeded + registered | `deepseek/001_reasoning_sse` (inline) | tested:false conf:? | none (reasoning-channel SSE parser seeded) |
| qwen | seeded | none configured | unknown | no parser row yet |
| grok | seeded | none configured | unknown | no parser row yet |

## Quick Reference: Common Test Commands

```bash
# Check if provider is ready (MUST pass before any live phase)
bun run devops runtime-test status --provider=gemini

# Run all parser unit tests (no Chrome needed)
bun test tests/unit/engines/harvested-parser.test.ts

# Run all provider E2E stream validation (no Chrome needed)
bun test tests/e2e/provider-stream-validate.test.ts

# Test NL resolution (no Chrome needed)
bun run devops runtime-test test --nl="send message to gemini"

# Full onboarding cycle (auto-resolves CDP, but Chrome must be running)
bun run devops runtime-test onboard run --provider=gemini

# Individual onboard phases (auto-resolve CDP when possible)
bun run devops runtime-test onboard discover --provider=gemini --url=https://gemini.google.com/app
bun run devops runtime-test onboard test-selectors --provider=gemini
bun run devops runtime-test onboard test-cap --provider=gemini
bun run devops runtime-test onboard test-frontend --provider=gemini

# Full test suite (all providers, all surfaces)
bun run devops runtime-test test --mode=full

# Cross-surface parity check
bun run devops verify-cross-surface

# Kill stale Chrome processes (if tabs pile up)
Get-Process chrome | Where-Object {$_.Id -ne $mainPid} | Stop-Process -Force

# ── APOP-AX (agent-as-explorer) commands ──
# Onboard a new provider (agent autonomously discovers everything)
bun run devops runtime-test onboard-provider --provider=grok --url=https://x.com/i/grok

# Verify onboarding succeeded (7 DB checks)
bun run devops runtime-test onboard-verify --provider=grok

# Diagnose failures (Chrome, profile, DB checks + fix suggestions)
bun run devops runtime-test diagnose --provider=grok --phase=capture
```

## Session Findings Logger

During live testing, log findings sequentially so they survive context compaction:

```bash
# Log a finding (append-only JSONL)
bun run devops llm-testing-log finding --provider=gemini --severity=P0 --category=chrome-launch --detail="user-agent string split causes tab explosion"

# Log a phase result
bun run devops llm-testing-log phase --provider=gemini --phase=discover --status=pass --durationMs=1234

# Log a decision
bun run devops llm-testing-log decision --provider=gemini --decision="Quote user-agent" --rationale="Windows Bun.spawn splits on spaces"

# Read back the log
cat .runtime/llm-testing/session-log.jsonl

# Generate summary
bun run devops llm-testing-log summary --provider=gemini
```

See `devops/llm-testing/session-logger.ts` for the implementation.
