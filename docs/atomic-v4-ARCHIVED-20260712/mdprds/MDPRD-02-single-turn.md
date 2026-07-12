> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-02: Single-Turn Conversation

**Phase:** 2 | **Units:** 8 | **Goal:** Send one message, get one parsed response back

## Problem

The ConversationManager's 8-step `send()` pipeline is fully coded but three critical pieces are broken:

1. **SlaveId mismatch**: `conversation-manager.ts:90` derives `slave_{providerId}_{accountId}` but FleetSupervisor creates `{providerSlug}_{accountId}_{timestamp}`. `ensureRunning()` will always fail because the derived ID doesn't exist in the fleet.

2. **Harness stub**: `chrome-governor.ts:192` `executeHarnessPlan()` returns `{ success: true, stepsCompleted: 0 }` without executing any CDP commands. No message is actually typed or submitted.

3. **Capture without transport**: `governor.cdp.capture()` requires the CDP transport, which is wired in Phase 1. Even with transport, the capture must intercept the streaming response before the page navigates or the response completes.

## User Story

> As a user with a logged-in provider session, I want to type a message in the VIVIM frontend, have it sent to the provider, and see the provider's response rendered in my conversation view.

## Success Criteria

1. POST `/api/conversations/:id/send` with `{ message: "Hello" }` returns `{ ok: true, text: "...", blocks: [...] }`
2. The message is actually typed into the provider's composer and submitted
3. The provider's streaming API response is captured via CDP Network interception
4. The response is parsed into typed ContentBlocks (text, code, thinking, etc.)
5. The response is stored in the database and emitted via WebSocket
6. The frontend renders the response in the conversation surface

## Pipeline Detail

### Step 5: SEND (Harness DAG Execution)

The HarnessDAG currently built in `conversation-manager.ts:201`:
```
nodes: [
  { type: 'action', action: 'type_text', params: { text: message, selector: resolved.composer[0].selector } },
  { type: 'action', action: 'submit', params: { key: 'Enter' } },
]
```

This must be executed via `HarnessRuntime.execute()`, not the CDPProxy stub. The HarnessRuntime already has the DAG executor infrastructure (`sequence`, `step`, `branch`, etc.) but it needs:
- Real modules registered for `type_text` and `submit`
- Real context wired to the Governor's CDP transport

### Step 6: CAPTURE (Network Interception)

`CdpTransportImpl.capture()` already implements the Network.responseReceived handler pattern. The capture pattern `/\/api\/conversation\//` works for ChatGPT but needs provider-specific patterns:
- ChatGPT: `/\/backend-api\/conversation$/` or `/\/api\/conversation\/.*\/stream$/`
- Claude: `/\/api\/organizations\/.*\/chat_conversations\/.*\/completion$/`
- Gemini: `/\/app\/_api\/BardFrontendService\/StreamGenerate$/`

Unit 2.5 makes the capture pattern configurable per provider via the endpoint manifest.

### Step 7: PARSE

StreamParserEngine already loads parsers from DB with a 3-level fallback chain. The seeded parsers in `seeds/parsers/` are inline JS modules that parse SSE deltas into ContentBlocks. The chatgpt parser is verified working for OpenAI SSE format.

## Key Files

- `src/engines/conversation-manager.ts` — fix slaveId, wire harness
- `src/engines/harness-runtime.ts` — register real modules
- `src/executor/cdp-transport.ts` — capture pattern from manifest
- `src/engines/stream-parser.ts` — already functional
- `web/sandbox/src/features/capability-harness.tsx` — render response

## Units

| Unit | Title | Key Files |
|------|-------|-----------|
| 2.1 | Fix slaveId derivation | `conversation-manager.ts` |
| 2.2 | Implement harness plan execution | `harness-runtime.ts`, `chrome-governor.ts` |
| 2.3 | Provider-specific composer typing | `harness-runtime.ts` |
| 2.4 | Provider-specific submit action | `harness-runtime.ts` |
| 2.5 | Network capture with provider patterns | `cdp-transport.ts`, `conversation-manager.ts` |
| 2.6 | Parser: SSE → ContentBlock[] | `stream-parser.ts`, seeds/parsers/ |
| 2.7 | Store message + blocks + emit events | `conversation-manager.ts` |
| 2.8 | Frontend: render single response | `web/sandbox/src/` |

