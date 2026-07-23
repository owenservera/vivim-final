---
name: provider-testing
description: Test providers in vivim-final. Covers the 8-phase onboarding pipeline (discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge), parser test workflow, CDP selector validation, and provider status checking. Use when testing a provider, onboarding a new provider, or diagnosing provider-specific failures.
---

# Provider Testing

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

### Provider Account Convention

| Provider | Account slug | Profile dir |
|----------|-------------|-------------|
| gemini | `gemini_owservera@gmail.com` | `chrome-profiles/gemini/owservera/` |
| chatgpt | `chatgpt_owservera@gmail.com` | `chrome-profiles/chatgpt/owservera/` |
| claude | `claude_owservera@gmail.com` | `chrome-profiles/claude/owservera/` |

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
- `seeds/providers/<slug>.json` — primary selectors

Test via:
```bash
# Unit test: validate selector patterns match known URLs
bun test tests/unit/engines/chat/selectors.test.ts

# Live DOM validation (requires Chrome slave)
bun run devops runtime-test onboard test-selectors --provider=gemini
```

## Provider-Specific Gotchas

| Provider | Composer | Send Method | Stream Format |
|----------|----------|-------------|---------------|
| gemini | `div.ql-editor[contenteditable="true"]` (Quill) | Click send button (Enter broken) | batchexecute (custom Google RPC, NOT SSE) |
| chatgpt | `#prompt-textarea` | Enter or click button | SSE `data: {message: {content: {parts}}}` + `[DONE]` |
| claude | `div[contenteditable="true"]` (ProseMirror) | Enter or click button | SSE `data: {type, delta, content_block_start/stop}` |

## Existing Provider Test Status

From `tests/e2e/provider-stream-validate.test.ts`:

| Provider | Status | Parser | Tested | Gaps |
|----------|--------|--------|--------|------|
| claude | seeded + registered | `claude/001_streaming_sse` (inline) | tested:true conf:1 | none |
| gemini | seeded + registered | `gemini/001_batchexecute` (inline) | tested:false | no stream_config row (custom batchexecute RPC) |
| chatgpt | seeded + partial | `chatgpt/001_openai_sse` (inline) | tested:true conf:1 | parser uses API format; wire uses chat UI format — needs real-world validation |
| deepseek | seeded | none configured | unknown | no parser row yet |
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

# Test capability by slug (no Chrome needed)
bun run devops runtime-test test-cap --slug=gemini_send

# Full onboarding cycle (auto-resolves CDP, but Chrome must be running)
bun run devops runtime-test onboard run --provider=gemini

# Individual onboard phases (auto-resolve CDP when possible)
bun run devops runtime-test onboard discover --provider=gemini --url=https://gemini.google.com/app
bun run devops runtime-test onboard test-selectors --provider=gemini
bun run devops runtime-test onboard test-cap --provider=gemini
bun run devops runtime-test onboard test-frontend --provider=gemini
```
