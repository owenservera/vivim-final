# Research: OpenCode `serve` Backend Integration

**Feature**: `027-opencode-serve` | **Date**: 2026-07-19

> Research-first note: the deep-research plan (`.kilo/plans/1784416945191-opencode-deep-research-plan.md`)
> was never executed — its briefs in `docs/research/briefs/opencode-deep/` do **not** exist.
> This research therefore consolidates the **verified ground truth** recorded in that plan's header
> (executed on host, 2026-07-19) plus the AGENT5/AGENT6-HELPER confirmation of the substrate.
> No repo-root `opencode.json` was mutated; no new captures were required because the v1 `run` parser
> (`parseOpencodeJson`) already covers the event grammar the `serve` SSE carries.

## Decision 1 — Transport: `serve` (not `run`, not `acp`)

- **Decision**: Persistent `opencode serve` HTTP/SSE backend.
- **Rationale**: `run` is one-shot (v1, AGENT1) and `opencode run --attach` has a known
  "No context found for instance" bug. `acp` is stdio (embed path). `serve` exposes a stable
  HTTP API + SSE event stream suitable for durable supervision + ingest.
- **Alternatives considered**: `run --attach` (buggy), `acp` (no HTTP surface for health/probe).

## Decision 2 — Auth & binding (research area #4)

- **Decision**: `opencode serve --port <p> --hostname 127.0.0.1` with `OPENCODE_SERVER_PASSWORD`
  (basic auth; default user `opencode`). Never `--mdns`/`--cors *` (those flip hostname to `0.0.0.0`).
- **Rationale**: localhost + password satisfies the local-first + security guardrails.
- **Verified**: `serve` starts **unsecured** by default unless `OPENCODE_SERVER_PASSWORD` is set —
  so we ALWAYS set it. `--hostname` defaults to `127.0.0.1` (loopback) — we set it explicitly.

## Decision 3 — Event grammar reuse (research areas #1/#8)

- **Decision**: Reuse `parseOpencodeJson` from `src/engines/local-agent/local-agent-executor.ts`
  to map `serve` SSE frames → `ContentBlock[]`. SSE frames carry the same `type`/`part` shape as
  `--format json` NDJSON.
- **Verified event grammar (opencode v1.17.15)**:
  - `step_start` → `part.type:'step-start'`, `part.sessionID`
  - `reasoning` → `part.type:'reasoning'`, `part.text` (only with `--thinking`)
  - `tool_use` → `part.type:'tool'`, `part.tool`, `part.callID`, `part.state{status,input,output}`
  - `part.tool==='invalid'` → silent permission denial (run still exits 0) → `PERMISSION_DENIED`
  - `text` → `part.type:'text'`, `part.text`
  - `step_finish` → `part.reason`, `part.tokens{...}`, `part.cost`
  - `error` → `error{name,data.message}`
- **Alternatives considered**: writing a separate SSE-only parser — rejected (duplication; the
  grammar is identical, only the framing differs, which the client handles).

## Decision 4 — Endpoints (research area #4, from live `GET /doc`)

- **Decision**: Client implements the documented surface.
- **Verified endpoints to use**:
  - `GET /doc` — OpenAPI 3.1 (readiness probe + schema source)
  - `GET /global/health` — liveness (used by supervisor readiness probe)
  - `POST /session` — create session (returns `id`)
  - `POST /session/:id/message` — send a message
  - `POST /session/:id/prompt_async` — async prompt dispatch
  - `POST /session/:id/permissions/:permissionID` — respond to a permission request
  - `GET /session/:id/diff` — file diffs (source of `AgentFileEdit`)
  - `GET /event` — SSE stream of session events

## Decision 5 — Landing tables & chat thread (AGENT5 substrate)

- **Decision**: Ingest writes `AgentSession` / `AgentPermissionDecision` / `AgentFileEdit` (Prisma
  tables already present, `prisma/schema.prisma:2967-3037`) + durable `EventRecord` (`source:'opencode'`,
  hash-chained outbox in `src/engines/event-record-store.ts`). Session rendering reuses Option C
  chat methods (`startAgentConversation`/`appendAgentMessage`/`getAgentMessages`) → `ConversationMessage`/
  `StreamBlock`. `providerId='opencode'` already seeded as a `ProviderDefinition` by feature `022`.
- **Rationale**: No new tables, no new message table — reuse the substrate AGENT5 built.
- **Verified**: all 4 Prisma tables present; `AgenticStoreImpl` implements the Option C contract;
  `EventRecordStore.append({source,type,entityType?,entityId?,providerSessionId?,payload})` exists.

## Decision 6 — Permission model (research area #6)

- **Decision**: Governor owns permission decisions in-process. On a `/event` permission request,
  assess risk tier (mapped from the tool/permission); **auto-deny tier > 3**; otherwise resolve via
  the configured permission policy. POST the decision back to `POST /session/:id/permissions/:id`
  (`decision: 'allow' | 'deny'`). Record in `AgentPermissionDecision.decidedBy='governor'`.
- **Rationale**: keeps the Governor as the single authority (consistent with rest of vivim); does
  not rely on `--auto`/frontmatter presets.

## Open unknowns (accepted — conservative implementation)

- Exact SSE field names for `permissions` and `diff` events are inferred from the OpenAPI `GET /doc`
  contract (read live at runtime). The client treats unknown event types defensively (log + skip),
  so schema drift does not crash ingest.
- `OPENCODE_SERVER_USERNAME` defaults to `opencode` (matches `022` seed).
