# Data Model: OpenCode `serve` Backend Integration

**Feature**: `027-opencode-serve` | **Date**: 2026-07-19

> All Prisma entities below already exist (feature `022`/`AGENT5` substrate). This document
> records the **projection contract** the ingest engine uses — it introduces NO new tables.

## Reused Entities (no migration)

### `AgentSession` (`prisma/schema.prisma:2967`)
- `id` (ULID), `providerSessionId` (unique), `providerId` (default `'opencode'`), `parentSessionId` (fork tree), `agentName`, `model`, `projectPath`, `status`.
- **Ingest writes**: one row per served OpenCode session. `providerSessionId` = serve `sessionId`; `providerId='opencode'`; `status` ∈ `active|idle|closed`.

### `AgentPermissionDecision` (`prisma/schema.prisma:~2985`)
- `id`, `agentSessionId` (FK cascade), `providerPermissionId` (unique), `toolName`, `riskTier` (1-5 → `Node.securityLevel`), `requestedAt`, `respondedAt?`, `decision` (`allow|deny|allow_always`), `decidedBy?`, `payloadJson`.
- **Ingest writes**: one row per `/event` permission request. `riskTier` mapped from tool/permission; `decidedBy='governor'`; `decision` from Governor assessment.

### `AgentFileEdit` (`prisma/schema.prisma:~2998`)
- `id`, `agentSessionId` (FK cascade), `messageId?`, `filePath`, `patchJson` (RFC-6902 JSON Patch), `beforeHash?`, `afterHash?`.
- **Ingest writes**: one row per file-diff event from `GET /session/:id/diff`. `patchJson` = RFC-6902 ops.

### `EventRecord` (`src/engines/event-record-store.ts`)
- `id`, `seq` (monotonic per source), `source` (`'opencode'`), `type`, `entityType?`, `entityId?`, `providerSessionId?`, `payloadJson`, `prevHash`, `hash`.
- **Ingest writes**: every raw served event → one `EventRecord` (`source:'opencode'`, hash-chained). Single source of truth for replay.

### `Conversation` / `ConversationMessage` / `StreamBlock` (Option C)
- Reused via `AgenticStoreContract.startAgentConversation` / `appendAgentMessage` / `getAgentMessages`.
- `startAgentConversation` → `{providerSessionId, conversationId}`; creates `Conversation` with `providerId='opencode'` and an opening user message.
- `appendAgentMessage(conversationId, {role,text,blocks?,model?,authorDid?,stepId?})` → `{id}`.

### `ProviderSession` / `ProviderDefinition`
- `providerId='opencode'` already seeded by feature `022` (`capability-bootstrap.ts`). Ingest creates a `ProviderSession` (or reuses the seeded one) and links `AgentSession.providerSessionId` → it.

## Ingest Projection Contract

```text
serve SSE event
  ├─ session_start      → AgentSession (status='active')            + EventRecord
  ├─ text / step         → appendAgentMessage(role,text,blocks)      + EventRecord
  ├─ tool_use (invalid)  → AgentPermissionDecision(deny, PERMISSION) + EventRecord
  ├─ permission_request  → AgentPermissionDecision(<tier>)           + Governor assess
  │                        → POST /session/:id/permissions/:pid      (allow|deny)
  ├─ diff                → AgentFileEdit(patchJson, hashes)         + EventRecord
  └─ session_end         → AgentSession(status='closed')            + EventRecord
```

## State Transitions

- `AgentSession.status`: `idle → active → closed`.
- `AgentPermissionDecision.decision`: `pending (on request) → allow | deny | allow_always (after Governor)`.

## Idempotency Keys

- `AgentSession`: `providerSessionId` (unique constraint).
- `AgentPermissionDecision`: `providerPermissionId` (unique constraint).
- `AgentFileEdit`: `(agentSessionId, filePath, messageId?)`.
- `EventRecord`: hash chain `prevHash || payloadJson` — duplicate payloads produce identical hash; ingest dedupes by `providerMessageId`/`providerPermissionId` before append.

## Risk Tier Mapping (Governor)

| Tool family        | riskTier | Auto-deny (tier>3) |
|--------------------|----------|--------------------|
| read / view        | 1        | no                 |
| edit (allowed path)| 2        | no                 |
| web fetch          | 3        | no                 |
| bash / exec        | 4        | **yes**            |
| filesystem delete  | 5        | **yes**            |
