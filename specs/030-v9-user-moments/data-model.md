# Data Model: Wire 10 Critical User Moments in v9 Canvas

**Feature**: 030-v9-user-moments
**Date**: 2026-07-19
**Source**: `spec.md` Key Entities (§Requirements) + verified backend routers

## Scope

This feature is **frontend wiring** against existing backend entities. No new Prisma models are
introduced. The data model below documents the entities the canvas UI consumes/mutates and their
contract shapes. All entities already exist in `prisma/schema.prisma` and are served by the
existing routers.

---

## Entities

### Capability
Represents an executable action surfaced in the command palette and canvas slots.

| Field | Type | Notes |
|-------|------|-------|
| id | string (ULID) | `cap:<category>:<action>` format per AGENTS.md |
| slug | string | Must match `capability-bootstrap.ts` definitions |
| name | string | Display label |
| description | string | Help text |
| category | string? | May be absent; derive from `slug.split('_')[0]` (taxonomy gotcha) |
| inputSchema | JSON (Zod) | Runtime-validated at boundary |
| outputSchema | JSON (Zod) | |
| cliCommand | string | For CLI-surface parity |
| ui | object | UI slot binding (`chat.actionBar`, etc.) |
| mcpToolName | string | MCP-surface parity |
| apiEndpoint | { method, path } | `POST /api/capabilities/:id/execute` |
| surfaces | string[] | `['cli','ui','api', 'mcp']` |

**Relations**: `Provider 1—* Capability` (resolved via `GET /api/providers/:id/capabilities`).

### Conversation
A chat session.

| Field | Type | Notes |
|-------|------|-------|
| id | string (ULID) | |
| title | string | Display in sidebar |
| providerId | string | FK to Provider |
| createdAt | datetime | |
| updatedAt | datetime | |

**Relations**: `Conversation 1—* Message`, `Provider 1—* Conversation`.
**Transitions**: empty → active (Moment 3/10), active → deleted (Moment 5 AC4).

### Message
A chat turn.

| Field | Type | Notes |
|-------|------|-------|
| id | string (ULID) | |
| conversationId | string | FK |
| role | enum | `user` \| `assistant` \| `system` |
| content | string | Streamed in blocks via WS |
| createdAt | datetime | |

**Streaming**: content assembled from `conversation:block` WS events (Moment 2).

### Provider
AI provider (chatgpt, claude, gemini, deepseek, qwen, grok).

| Field | Type | Notes |
|-------|------|-------|
| id | string (ULID) | |
| name | string | |
| slug | string | |
| status | enum | `online` \| `offline` \| `degraded` |
| capabilities | Capability[] | Resolved dynamically |

### Session (Provider Session)
Chrome slave attachment (Moment 10).

| Field | Type | Notes |
|-------|------|-------|
| id | string (ULID) | |
| providerId | string | FK |
| slaveId | string | Chrome slave id |
| conversationId | string? | Linked conversation |

**Transitions**: unloaded → loading → active → ended.

### Memory
Stored fact (Moment 8).

| Field | Type | Notes |
|-------|------|-------|
| id | string (ULID) | |
| content | string | |
| confidence | number | 0..1 |
| createdAt | datetime | |

### Knowledge
Searchable document (Moment 7).

| Field | Type | Notes |
|-------|------|-------|
| id | string (ULID) | |
| content | string | |
| source | string | Conversation title |
| timestamp | datetime | |

---

## Validation Rules (boundary, Zod)

- Capability `inputSchema` validated before `POST /api/capabilities/:id/execute`.
- `Conversation.title` required non-empty for sidebar display.
- `Message.role` constrained to enum.
- `Provider.status` drives selector disabled state (Moment 9 AC2).

## State Transitions

```
Conversation:  (none) ──create──▶ active ──delete──▶ (gone)
Session:       unloaded ──load──▶ loading ──restore──▶ active ──end──▶ unloaded
Backend:       disconnected ──health OK──▶ connected ──health fail──▶ disconnected
WebSocket:     closed ──connect──▶ open ──drop──▶ reconnecting ──open──▶ open
```

## Out of Scope (no schema change)

All 10 moments consume existing models. SC-010 ("wireable without backend code changes") holds.
