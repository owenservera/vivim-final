# Spec: OpenCode Serve Capability Integration (029)

**Feature**: 029 | **Date**: 2026-07-19 | **Status**: Draft

## Problem

Feature 027 built the OpenCode serve infrastructure (Supervisor, Client, Ingest) but none of it is
wired into vivim's capability system. The objects live on `globalThis.__opencodeServe` but nothing
consumes them through the capability registry — no API route, no CLI command, no NL pattern.

## Goal

Make OpenCode serve a first-class provider in vivim's capability system, on par with ChatGPT/Claude/Gemini.

## User Stories

### US1: Send a prompt to OpenCode via NL
**As a** user
**I want to** say "ask opencode to refactor auth" and get a response
**So that** I can interact with OpenCode through the same interface as other providers

### US2: Send a prompt via API
**As a** developer
**I want to** `POST /api/opencode/send { prompt, sessionId? }` and get a streamed response
**So that** external tools can integrate with OpenCode

### US3: Manage OpenCode sessions
**As a** user
**I want to** create and list persistent OpenCode sessions
**So that** I can maintain multi-turn conversations

### US4: Respond to OpenCode permissions
**As a** governor
**I want to** auto-deny tier > 3 permissions and expose a manual override API
**So that** security is maintained while allowing human override

## Architecture

```
NL: "ask opencode to refactor auth"
    ↓
NLCL Catalog pattern → intent: opencode.send
    ↓
OpenCodeExecutor.execute() [or CapabilityExecutor via capabilityId]
    ↓
OpenCodeClient.createSession() → sendPrompt() → subscribe SSE
    ↓
OpenCodeIngest.onEvent() → DB (AgentSession, EventRecord, etc.)
    ↓
Response blocks returned to caller
```

## Components

| Component | File | Purpose |
|-----------|------|---------|
| OpenCodeExecutor | `src/engines/opencode/opencode-executor.ts` | NLCL executor for opencode serve |
| Capabilities | `src/engines/capability-bootstrap.ts` | 4 new capabilities |
| NL Patterns | `src/engines/nlcl/catalog.ts` | NL regex patterns |
| API Routes | `src/server/index.ts` | REST endpoints |
| Boot Wiring | `src/server/index.ts` | Pass client/ingest to BootstrapServices |

## Capabilities

| ID | Slug | API Route | CLI Command |
|----|------|-----------|-------------|
| `cap:opencode:send` | `opencode_send` | `POST /api/opencode/send` | `opencode send` |
| `cap:opencode:session.create` | `opencode_session_create` | `POST /api/opencode/session` | `opencode session create` |
| `cap:opencode:session.list` | `opencode_session_list` | `GET /api/opencode/sessions` | `opencode session list` |
| `cap:opencode:permission.respond` | `opencode_permission_respond` | `POST /api/opencode/permission/:id` | `opencode permission` |

## Constraints

- Env-gated: only active when `OPENCODE_SERVE_ENABLED=1`
- Local-first: localhost-only, password required
- Governor Canon: no CDP imports
- Store Contracts: depends on OpenCodeClient + OpenCodeIngest, not impls
- Default OFF: never blocks other providers

## Out of Scope

- Frontend UI (rendering opencode responses in chat) — handled by existing GenericCapabilityRenderer
- New Prisma tables — reuse existing AgentSession/EventRecord/etc.
- Chrome/CDP integration — opencode is HTTP-only
