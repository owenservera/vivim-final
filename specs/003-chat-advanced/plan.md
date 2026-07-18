# Implementation Plan: Chat Advanced Capabilities & Memory/Knowledge

**Branch**: `003-chat-advanced` | **Date**: 2025-07-17

## Summary

Code research confirms all 5 chat capabilities are registered in `capability-bootstrap.ts` (lines 971-1082). All backend engines exist (cross-conversation-synthesis, knowledge-ingestion, semantic-search, memory-indexer, export). The remaining work is frontend wiring and FTS5 search route.

## Implementation Status

| Unit | Feature | Status |
|------|---------|--------|
| 102.1 | select_model cap | ✅ Registered (line 971) |
| 102.2 | upload_file cap | ✅ Registered (line 1004) |
| 102.3 | edit_message cap | ✅ Registered (line 1033) |
| 102.4 | regenerate cap | ✅ Registered (line 1055) |
| 102.5 | new_chat cap | ✅ Registered (line 1073) |
| 102.6 | Model selector UI | Verify in conversation-surface.tsx |
| 102.7 | File upload UI | Verify in conversation-surface.tsx |
| 102.10 | FTS5 search bar | Wire route in conversation-router.ts |
| 105.1 | Memory context panel | Backend exists, needs UI panel |
| 105.3 | Cross-conversation synthesis | Backend exists, needs UI |

## Constitution Check — PASS

Existing code follows all conventions. No new engine imports, no raw errors, no CDP bypass.

## Remaining Work

1. Wire `POST /api/conversations/search` route (backend `searchMessages()` exists)
2. Create memory context panel component
3. Create cross-conversation synthesis display component
4. Register provider_list_models capability for model selector
5. Write unit test for new chat capabilities
