> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-03: Multi-Turn Conversation

**Phase:** 3 | **Units:** 6 | **Goal:** Sustained back-and-forth with streaming and error recovery

## Problem

Single-turn works (Phase 2), but multi-turn introduces new challenges:

1. **Page state drift**: Provider SPAs (ChatGPT, Claude) update their DOM between turns. Selectors that worked on turn 1 may break by turn 3.
2. **No streaming**: The current pipeline captures the complete response only after it finishes. Users see nothing until the full response arrives (potentially 30+ seconds).
3. **No error recovery**: If the Chrome slave crashes mid-conversation, the circuit breaker opens but the user gets no retry or fallback.
4. **No selector healing**: When a selector breaks, the capability fails silently with no auto-detection or repair.

## User Story

> As a user in an active conversation, I want to see the response stream in real-time as the provider generates it. If something breaks (Chrome crash, selector change), I want the system to recover automatically and continue the conversation without manual intervention.

## Success Criteria

1. Response text appears progressively in the frontend as blocks arrive (sub-200ms latency per block)
2. After a Chrome crash, the system respawns the slave, reloads the provider page, and resumes within 10 seconds
3. When a selector breaks (e.g., ChatGPT changes their textarea), the selector healer detects it within 2 turns and attempts repair
4. Conversation state (message count, context) persists correctly across 10+ turns
5. WebSocket delivers blocks to frontend with < 100ms overhead vs raw CDP event timing

## Streaming Architecture

```
CDP Network.dataReceived → CdpTransportImpl.capture() streams chunks
  → StreamingProtocol.captureChunk(convId, msgId, chunk)
    → parser.parse(chunk) → ContentBlock[]
    → emit('conversation:block', { block })
    → store.storeBlocks(convId, msgId, blocks)
  → WebSocket → Frontend Zustand store → React re-render
```

Currently `CdpTransportImpl.capture()` waits for the full `Network.responseReceived` + `Network.getResponseBody`. Unit 3.3 changes this to also handle `Network.dataReceived` events for progressive streaming.

## Selector Healing Flow

```
HarnessRuntime.execute(step: type_text)
  → CDP.querySelector(selector)
  → FAIL (element not found)
  → SelectorHealer.heal(providerId, capabilitySlug, failedSelector)
    → Try alternative selectors from provider_capability.recovery_strategies
    → Try DOM heuristic search (find textarea, find [contenteditable])
    → If found: update selector in DB, retry step
    → If not found: emit capability:selector_drifted, return error
```

## Error Recovery Flow

```
ConversationManager.send()
  → governor.ensureRunning(slaveId)
  → FAIL: SlaveNotRunningError or CircuitOpenError
  → Retry logic:
    1. If circuit half_open: spawn new slave with same profile
    2. Navigate to provider URL
    3. Wait for page load
    4. Re-inject context
    5. Retry send pipeline (max 2 retries)
    6. If all fail: return error to frontend, mark conversation as degraded
```

## Key Files

- `src/engines/streaming-protocol.ts` — progressive delivery
- `src/executor/cdp-transport.ts` — Network.dataReceived handling
- `src/engines/selector-healer.ts` — auto-repair
- `src/engines/conversation-manager.ts` — retry logic
- `src/server/websocket.ts` — block forwarding to frontend
- `web/sandbox/src/store/capability-store.ts` — streaming state

## Units

| Unit | Title | Key Files |
|------|-------|-----------|
| 3.1 | Conversation state persistence | `conversation-manager.ts` |
| 3.2 | DOM recovery + SPA navigation | `conversation-manager.ts`, `cdp-transport.ts` |
| 3.3 | Streaming over WebSocket | `streaming-protocol.ts`, `cdp-transport.ts`, `websocket.ts` |
| 3.4 | Frontend streaming updates | `web/sandbox/src/` |
| 3.5 | Error recovery + circuit breaker | `conversation-manager.ts`, `fleet-supervisor.ts` |
| 3.6 | Selector healing | `selector-healer.ts`, `conversation-manager.ts` |

