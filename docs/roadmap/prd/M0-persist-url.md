# PRD — M0: Persist Provider Conversation URL (Foundation)

> Part of the Multi-Turn Conversations roadmap. Scope: data layer only.
> Grounded in `prisma/schema.prisma` (`Conversation` model, has `externalId?` but no URL field)
> and `src/storage/contracts/conversation-store.ts` (`ConversationRow` has no URL field;
> `updateConversation(id, Partial<ConversationRow>)` already accepts arbitrary patches).

## Goal
Give the system a durable place to remember *which provider conversation page* a given local
conversation is bound to, so later milestones can navigate back to it.

## Current State (truth)
- `Conversation` (Prisma) has `externalId String?` and `providerSessionId` — but **no URL column**.
- `ConversationRow` (contract) has 10 fields, none for a provider URL.
- `updateConversation(id, patch)` is already partial-patch capable → adding a field is non-breaking.
- `ConversationInput` (create input) has no URL field.
- No migration exists for a URL column.

## Success Criteria (gates — not implementation)
1. **SC-M0-1 (schema):** A nullable `provider_conversation_url` column exists on `Conversation`,
   mapped to a `providerConversationUrl` field, nullable, no default.
2. **SC-M0-2 (migration):** `bunx prisma migrate dev --name add_conversation_url` applies cleanly
   on a fresh DB; `prisma migrate status` reports no pending migrations.
3. **SC-M0-3 (contract):** `ConversationRow` exposes `providerConversationUrl: string | null`.
   `ConversationInput` accepts `providerConversationUrl?`. `updateConversation` patch type includes it.
4. **SC-M0-4 (impl parity):** `conversation-store-impl.ts` read/write of the field round-trips
   (write a value, read it back, equals).
5. **SC-M0-5 (typecheck):** `bun run typecheck` passes with zero errors across src.
6. **SC-M0-6 (no behavior change):** No existing capability output changes; existing conversations
   read back with `providerConversationUrl === null`.

## Out of Scope
- Actually capturing or navigating (M1/M2).
- Frontend display (M4).
- Parser changes (M3).

## Acceptance Test (backend)
- New unit test in `tests/unit/storage/impl/conversation-store-impl.test.ts`:
  create conversation with `providerConversationUrl`, read back, assert equality + null-default.

## Definition of Done
All 6 SC pass; `bun run typecheck` green; migration committed; no consumer broke.
