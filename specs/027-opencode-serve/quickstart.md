# Quickstart: OpenCode `serve` Backend Integration

**Feature**: `027-opencode-serve` | **Date**: 2026-07-19

End-to-end validation scenarios. Prerequisites, commands, expected outcomes. Do not duplicate
implementation bodies — see `spec.md`, `data-model.md`, `contracts/client-api.md`.

## Prerequisites

- `opencode` on PATH (v1.17.15 verified). `bun` runtime. Repo at `027-opencode-serve` branch.
- SQLite dev DB present (`bunx prisma db push --skip-generate` if fresh).
- The `opencode` `ProviderDefinition` is seeded at boot by feature `022` (`capability-bootstrap.ts`).

## Scenario Q1 — Unit: event grammar reuse (no server needed)

```pwsh
bun test tests/unit/engines/opencode-client.test.ts
```
- Feeds recorded `serve`-style SSE frames through `parseOpencodeJson`.
- Asserts: `text`→text block, `tool`→tool-call+tool-result, `part.tool==='invalid'`→`PERMISSION_DENIED`, `error`→`AGENT_FAILED`.
- Expected: pass (8/8).

## Scenario Q2 — Integration S1: client + ingest projection

```pwsh
bun test tests/integration/opencode/ingest.test.ts
```
- Spins a mock `serve` HTTP/SSE server implementing the `contracts/client-api.md` subset.
- Client creates a session, sends a prompt, mock streams `step_start`/`text`/`tool`/`diff`/`permission` frames.
- Ingest writes: `AgentSession` + `AgentPermissionDecision` + `AgentFileEdit`; extends `EventRecord` hash chain; renders a `conversation` thread via `getAgentMessages`.
- Asserts idempotent re-ingest (no duplicate rows).
- Expected: pass.

## Scenario Q3 — Integration S2: chat-thread rendering + Governor permission

```pwsh
bun test tests/integration/opencode/permission.test.ts
```
- Reuses S1 harness; adds a tier-4 `bash` permission event.
- Asserts `AgentPermissionDecision.decision==='deny'`, `decidedBy==='governor'`, and the mock received `POST /session/:id/permissions/:pid` with `{decision:'deny'}`.
- Asserts `getAgentMessages(conversationId)` returns the rendered assistant blocks.
- Expected: pass.

## Scenario Q4 — Integration S3: supervisor lifecycle

```pwsh
bun test tests/integration/opencode/supervisor.test.ts
```
- `supervisor.start()` spawns `opencode serve --port <free> --hostname 127.0.0.1` with `OPENCODE_SERVER_PASSWORD` set.
- Asserts readiness probe (`GET /doc` → 200) before `start()` resolves.
- `supervisor.stop()` kills the child; assert no orphan (exit code observed).
- Expected: pass.

## Scenario Q5 — Backbone still green

```pwsh
bun test tests/integration/agentic
```
- Expected: 16 pass (AGENT5 substrate untouched by this feature).

## Scenario Q6 — Additive boot wiring (no typecheck)

```pwsh
bun build src/server/index.ts
```
- Expected: exit 0. Confirms the ONE additive, env-gated supervisor boot line imports cleanly.
- NOTE: do NOT run full `tsc` (pre-existing errors elsewhere are out of scope).

## Local-first guardrail check

- `OPENCODE_SERVE_ENABLED` unset → supervisor does NOT start; other providers boot normally.
- `opencode serve` bound to `127.0.0.1` only (never `0.0.0.0`); password always set.
- No repo-root `opencode.json` mutated.
