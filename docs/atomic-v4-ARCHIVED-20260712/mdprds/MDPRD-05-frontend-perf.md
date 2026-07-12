> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-05: Frontend Performance

**Phase:** 5 | **Units:** 6 | **Goal:** Zero-breakage UX with minimal latency overhead

## Problem

The VIVIM frontend must feel as responsive as using the provider's native UI directly. The overhead of routing through CDP + VIVIM backend must be imperceptible (< 200ms total overhead per interaction). Key performance risks:

1. **No optimistic UI**: User clicks send, waits for full backend round-trip before seeing anything
2. **WebSocket flooding**: Streaming blocks arrive every few ms, causing React re-renders on each block
3. **No virtualization**: Long conversations (100+ messages) cause massive DOM and slow renders
4. **No mirror sync**: UI state and Chrome state diverge, causing confusing UX
5. **Webapp mutation risk**: VIVIM's CDP interactions could accidentally modify the provider's page DOM, breaking the native experience

## User Story

> As a user, I want the VIVIM interface to feel exactly as fast and responsive as using ChatGPT/Claude/Gemini directly. I should never see loading spinners where the native UI wouldn't have them. My interactions should never break the provider's page.

## Success Criteria

1. User sees their message echoed immediately on send (< 16ms, one frame)
2. Streaming response text appears smoothly (60fps, no jank)
3. 500-message conversation scrolls at 60fps
4. UI state matches Chrome state within 100ms after any action
5. Per-stage latency is measured and displayed in DevTools
6. Zero DOM mutations persist on the provider page after VIVIM interaction (all mutations are reverted)

## Optimistic UI Pattern

```
User types message → clicks send
  → Frontend immediately appends user message to list (optimistic)
  → Frontend immediately appends empty assistant message with typing indicator
  → POST /api/conversations/:id/send (async)
  → WebSocket streams blocks → update assistant message progressively
  → On error: remove optimistic messages, show error toast
```

## WebSocket Debouncing

```
CdpTransportImpl → StreamingProtocol → WebSocket
  → Frontend receives 'conversation:block' events
  → Zustand store batches updates (16ms window = 1 frame)
  → Single re-render per frame, not per block

Implementation:
  const batchedBlocks = useRef<ContentBlock[]>([])
  const flushTimer = useRef<number>()
  
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.type === 'conversation:block') {
      batchedBlocks.current.push(msg.block)
      if (!flushTimer.current) {
        flushTimer.current = requestAnimationFrame(() => {
          set({ streamingBlocks: [...batchedBlocks.current] })
          batchedBlocks.current = []
          flushTimer.current = null
        })
      }
    }
  }
```

## Zero-Breakage Mutation Safety

VIVIM types into the provider's textarea and clicks submit. These are legitimate mutations. But VIVIM must NEVER:
- Add/remove DOM nodes that persist after the interaction
- Modify CSS styles that persist
- Inject scripts that persist
- Leave event listeners attached
- Change the page URL (except through normal provider navigation)

**Audit protocol** (unit 5.6):
1. Take DOM snapshot before interaction
2. Execute type + submit
3. Wait for response
4. Take DOM snapshot after interaction
5. Diff: only the message list should have changed — no structural mutations outside the provider's own update area

## Latency Budgets

| Stage | Budget | Measurement Point |
|-------|--------|-------------------|
| User click → optimistic echo | 16ms | requestAnimationFrame |
| POST send → CDP type begins | 500ms | backend log |
| CDP type → provider receives | 100ms | CDP telemetry |
| Provider response starts → first block | 2000ms | capture event |
| First block → frontend render | 100ms | WS + React |
| Subsequent blocks → frontend render | 50ms | WS + React |

## Key Files

- `web/sandbox/src/store/capability-store.ts` — Zustand store
- `web/ui/src/actions/registry.ts` — Action dispatch
- `src/engines/mirror-engine.ts` — Bidirectional sync
- `src/engines/observation-tap.ts` — DOM mutation observation

## Units

| Unit | Title | Key Files |
|------|-------|-----------|
| 5.1 | Optimistic UI on send | `web/sandbox/src/` |
| 5.2 | WebSocket debouncing | `web/sandbox/src/` |
| 5.3 | Virtual scrolling | `web/sandbox/src/` |
| 5.4 | Mirror engine sync | `mirror-engine.ts`, `observation-tap.ts` |
| 5.5 | Latency budget enforcement | `mirror-engine.ts`, `conversation-manager.ts` |
| 5.6 | Mutation safety audit | `observation-tap.ts`, test harness |

