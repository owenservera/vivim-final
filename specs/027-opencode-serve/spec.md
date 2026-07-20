# Feature Specification: OpenCode `serve` Backend Integration (v2 persistent harness)

**Feature Branch**: `027-opencode-serve`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Connect vivim to a running `opencode serve` process — supervisor, client, and ingest — so OpenCode sessions, permissions, and file edits land in the local DB as a peer provider (`providerId='opencode'`), supervised and governed by the Governor, on top of the agentic backbone AGENT5 already built."

## Background & Scope Boundary

- Feature `022-local-agent-opencode` delivered the **v1 one-shot** surface (`cap:agent:run` → `opencode run --auto --format json`). This feature delivers the **v2 persistent** surface: a long-lived `opencode serve` HTTP/SSE backend, supervised locally.
- The two surfaces are **disjoint transports** over the same `opencode` provider. No shared code paths; both reuse the verified `parseOpencodeJson` event grammar and the `opencode`/`ProviderDefinition` already seeded in `022`.
- This feature is **additive** and **OFF by default** (local-first principle). It never blocks boot and never requires OpenCode to be up for other providers.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Supervise a local `opencode serve` process (Priority: P1)

vivim can, when explicitly enabled (env flag / capability), spawn and supervise an `opencode serve --port <p> --hostname 127.0.0.1` subprocess with `OPENCODE_SERVER_PASSWORD` set. It waits for readiness (poll `GET /doc` until 200), restarts on crash with bounded exponential backoff, and shuts the process down cleanly on `SIGTERM`.

**Why this priority**: Without a supervisor there is no durable, observable OpenCode backend — this is the process substrate the client and ingest depend on.

**Independent Test**: `tests/integration/opencode/supervisor.test.ts` (S3) boots `opencode serve`, asserts readiness probe returns 200, asserts `/doc` exposes the session API, then stops the process and asserts exit.

**Acceptance Scenarios**:

1. **Given** `OPENCODE_SERVE_ENABLED=1` and a free port, **When** the supervisor starts, **Then** `opencode serve` is spawned on `127.0.0.1` only (never `0.0.0.0`/`--mdns`), with a server password.
2. **Given** a spawned server, **When** readiness polling runs, **Then** the supervisor proceeds only after `GET /doc` returns 200 (readiness race handled).
3. **Given** the server crashes, **When** the supervisor detects exit, **Then** it restarts with bounded backoff (max N attempts then gives up, logging).
4. **Given** a running supervisor, **When** `SIGTERM` arrives, **Then** it kills the child and resolves without orphaning.

### User Story 2 - Client talks the `serve` HTTP/SSE API (Priority: P1)

vivim's client creates a session (`POST /session`), sends a prompt (`POST /session/:id/prompt_async` or `POST /session/:id/message`), and subscribes to the live event stream (`GET /event` SSE). Events are mapped to the canonical `ContentBlock[]` via the **already-verified** `parseOpencodeJson` grammar (same `type`/`part` shape as `--format json`).

**Why this priority**: The client is the bridge that turns a served OpenCode session into vivim-ingestible events.

**Independent Test**: `tests/integration/opencode/client.test.ts` (S1a) against a mock HTTP server implementing the documented endpoints asserts: session created, prompt accepted, SSE frames parsed into `ContentBlock[]` text/tool/permission-denial blocks.

**Acceptance Scenarios**:

1. **Given** a live served OpenCode, **When** `client.createSession()` runs, **Then** it returns a `sessionId` and the supervisor registers an `AgentSession` row (`providerId='opencode'`).
2. **Given** a session, **When** `client.sendPrompt(id, prompt)` runs, **Then** it dispatches the prompt and begins streaming `/event`.
3. **Given** an SSE frame `{type:'text',part:{type:'text',text:'...'}}`, **When** parsed, **Then** a `ContentBlock` of type `text` is produced (reuses `parseOpencodeJson`).
4. **Given** an SSE frame with `part.tool==='invalid'`, **When** parsed, **Then** a `PERMISSION_DENIED` block is produced.

### User Story 3 - Ingest sessions into the local DB (Priority: P1)

The ingest engine consumes client events and projects them into the four OpenCode landing tables (`AgentSession`, `AgentPermissionDecision`, `AgentFileEdit`) **and** the durable `EventRecord` outbox (`source:'opencode'`). It also renders the session as a vivim chat thread via the Option C chat methods (`startAgentConversation`/`appendAgentMessage`/`getAgentMessages`), reusing `ConversationMessage`/`StreamBlock`. Governor permission decisions are applied programmatically: on a `/event` permission request, the ingest asks the Governor and replies via `POST /session/:id/permissions/:permissionID` (allow/deny), auto-denying any tool with risk tier > 3.

**Why this priority**: This is the local-first payload — every served OpenCode session becomes durable, queryable, replayable vivim data without a second message table.

**Independent Test**: `tests/integration/opencode/ingest.test.ts` (S1/S2) feeds recorded `serve` events and asserts: `AgentSession` + `AgentPermissionDecision` + `AgentFileEdit` rows written; `EventRecord` hash chain extended; a parallel `conversation` thread renders via `getAgentMessages`.

**Acceptance Scenarios**:

1. **Given** a session-start event, **When** ingested, **Then** an `AgentSession` row exists (`providerId='opencode'`, `providerSessionId` from serve).
2. **Given** a permission/tool request event, **When** ingested, **Then** an `AgentPermissionDecision` row exists (`providerPermissionId` unique, `riskTier` mapped) and the Governor decision is POSTed back.
3. **Given** a file-diff event, **When** ingested, **Then** an `AgentFileEdit` row exists (`patchJson` RFC-6902, before/after hash).
4. **Given** a text/step event, **When** ingested, **Then** `appendAgentMessage` appends to the session's `conversation` and `EventRecord` records the raw event (hash-chained).
5. **Given** a duplicate event (same `providerPermissionId`/`providerMessageId`), **When** re-ingested, **Then** it is idempotent (no duplicate rows).

### User Story 4 - Governor-owned permissions (Priority: P2)

Permissions are resolved by the Governor in-process, NOT via `--auto` or frontmatter presets. Every permission event from `/event` triggers a Governor risk assessment; tier > 3 is auto-denied, others are delegated to the configured permission policy. The decision is recorded in `AgentPermissionDecision.decidedBy='governor'` and sent to OpenCode via `POST /session/:id/permissions/:permissionID`.

**Why this priority**: Keeps the Governor as the single authority over tool execution (consistent with the rest of vivim), preventing OpenCode from silently approving risky tools.

**Independent Test**: `tests/integration/opencode/permission.test.ts` (S2b) simulates a tier-4 bash permission event and asserts the decision is `deny` and the POST to the permissions endpoint carries `decision:'deny'`.

**Acceptance Scenarios**:

1. **Given** a permission request for `bash` rated tier 4, **When** the Governor assesses it, **Then** the decision is `deny` and `AgentPermissionDecision` reflects `decision:'deny'`, `decidedBy:'governor'`.
2. **Given** a permission request for `read` rated tier 1, **When** assessed, **Then** the decision defaults to `allow` (or policy-resolved) and is POSTed back `decision:'allow'`.

## Requirements

- FR-1: Supervisor spawns `opencode serve` bound to `127.0.0.1` only, with password auth, default OFF.
- FR-2: Supervisor handles the readiness race (poll until `GET /doc` 200) before declaring ready.
- FR-3: Supervisor restarts on crash with bounded exponential backoff; gives up after max attempts.
- FR-4: Client implements `POST /session`, `POST /session/:id/message`, `POST /session/:id/prompt_async`, `POST /session/:id/permissions/:id`, `GET /event` (SSE) off the live `GET /doc` OpenAPI.
- FR-5: Client maps `serve` SSE events to `ContentBlock[]` reusing `parseOpencodeJson`.
- FR-6: Ingest writes `AgentSession`/`AgentPermissionDecision`/`AgentFileEdit` + durable `EventRecord`.
- FR-7: Ingest renders served sessions as vivim chat threads via Option C (`startAgentConversation`/`appendAgentMessage`).
- FR-8: Governor owns permission decisions; tier > 3 auto-denied; decision POSTed back to OpenCode.
- FR-9: Ingest is idempotent by `providerSessionId`/`providerPermissionId`/`providerMessageId`.
- FR-10: All wiring is additive + env-gated; does not affect `cap:agent:run` or other providers' boot.

## Success Metrics

- `bun test tests/integration/opencode` → S1/S2/S3 pass.
- `bun test tests/integration/agentic` → 16 still pass (backbone untouched).
- `bun build src/server/index.ts` → exit 0 (additive boot wiring imports cleanly).
- No new Prisma migration (4 tables already present).
- No `any`; no `BunCdpClient` import (Governor Canon preserved).
