# Tasks: Chat Advanced Capabilities & Memory/Knowledge

**Input**: `specs/003-chat-advanced/plan.md`

## Phase 1: Backend Gaps

- [ ] T001 [P] Wire `POST /api/conversations/search` in conversation-router.ts (backend searchMessages exists)
- [ ] T002 [P] Register `provider_list_models` capability in capability-bootstrap.ts
- [ ] T003 Write unit test for provider chat capabilities (select_model, upload_file, edit_message, regenerate, new_chat)

## Phase 2: UI Wiring

- [ ] T004 Verify model selector UI in conversation-surface.tsx
- [ ] T005 Create memory context panel component (fetches from memory:query)
- [ ] T006 Create cross-conversation synthesis display component

## Phase 3: Gate

- [ ] T007 Run `bun run typecheck && bun test && bun run devops verify-cross-surface`
