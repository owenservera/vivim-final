# 06 — Streaming / Result Slots (C6)

**Units:** C6 (`useStreamBlocks.ts`, `StreamingSlot.tsx`, `ResultSlot.tsx`)
**Principle:** Blocks stream in progressively; the UI renders them as they
arrive — no wait for completion.

---

## 1. Problem

`StreamParserEngine` produces `ContentBlock[]` during streaming, but there was
no `chat.streaming` or `chat.result` slot consuming them progressively. The
old `ChatPage` had no streaming indicator.

---

## 2. The block model

`shared/stream-blocks.ts` (mirrors `src/schema/streaming.ts`):

```ts
export type ContentBlock =
  | { kind: 'text'; content: string; index: number }
  | { kind: 'thinking'; content: string; index: number }
  | { kind: 'code'; content: string; language?: string; index: number }
  | { kind: 'artifact'; content: string; artifactType?: string; index: number }
  | { kind: 'image'; url: string; alt?: string; index: number }
  | { kind: 'citation'; content: string; source?: string; index: number }
  | { kind: 'tool_use'; toolName: string; input: Record<string, unknown>; index: number }
  | { kind: 'error'; message: string; code?: string; index: number }
  | { kind: 'meta'; key: string; value: unknown; index: number }
```

The backend persists these via `StreamBlockStore` (Prisma `streamBlock` table).

---

## 3. `useStreamBlocks` hook (C6)

`web/ui/src/features/canvas/useStreamBlocks.ts`

Polls the backend for new blocks:

```ts
export function useStreamBlocks(
  conversationId: string | undefined,
  messageId?: string,
): { blocks: ContentBlock[]; isStreaming: boolean } {
  const [blocks, setBlocks] = useState<ContentBlock[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  useEffect(() => {
    if (!conversationId) return
    let active = true
    const POLL_INTERVAL = 500

    const poll = async () => {
      if (!active) return
      const params = new URLSearchParams()
      if (messageId) params.set('messageId', messageId)
      const res = await fetch(`/api/conversations/${conversationId}/stream-blocks?${params}`)
      const data = await res.json() as { blocks: ContentBlock[]; streaming: boolean }
      setBlocks(data.blocks)
      setIsStreaming(data.streaming)
      timerRef.current = setTimeout(poll, POLL_INTERVAL)
    }
    poll()
    return () => { active = false; if (timerRef.current) clearTimeout(timerRef.current) }
  }, [conversationId, messageId])

  return { blocks, isStreaming }
}
```

> **Polling vs. WebSocket:** The hook polls every 500ms. A WebSocket push
> (alongside `/ws/canvas` from C7) would be lower-latency but requires a backend
> stream-forwarder. Polling is sufficient for the initial implementation and
> degrades gracefully (no connection needed).

---

## 4. `StreamingSlot` (C6)

`web/ui/src/features/canvas/StreamingSlot.tsx`

Renders an animated indicator while the assistant generates:

```tsx
export function StreamingSlot({ conversationId, messageId }) {
  const { blocks, isStreaming } = useStreamBlocks(conversationId, messageId)
  if (!isStreaming && blocks.length === 0) return null
  return (
    <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      {isStreaming && <span className="streaming-dots">●●●</span>}
      <span>
        {isStreaming
          ? `Generating… ${blocks.length} block${blocks.length !== 1 ? 's' : ''}`
          : `${blocks.length} block${blocks.length !== 1 ? 's' : ''} ready`}
      </span>
      <style>{`.streaming-dots { animation: pulse 1.2s ease-in-out infinite; } @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
    </div>
  )
}
```

The indicator disappears when `isStreaming` flips to `false`.

---

## 5. `ResultSlot` (C6)

`web/ui/src/features/canvas/ResultSlot.tsx`

Renders each block progressively as it arrives:

```tsx
export function ResultSlot({ conversationId, messageId }) {
  const { blocks } = useStreamBlocks(conversationId, messageId)
  if (blocks.length === 0) return null
  return (
    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {blocks.map((block) => (
        <BlockRenderer key={`${block.kind}-${block.index}`} block={block} />
      ))}
    </div>
  )
}
```

`BlockRenderer` switches on `block.kind`:

| Kind | Render |
|------|--------|
| `text` | Paragraph (pre-wrap) |
| `code` | `<pre>` with language label |
| `thinking` | `<details>` collapsible |
| `artifact` | Bordered panel with `artifactType` |
| `image` | `<img>` |
| `citation` | Left-bordered quote + source |
| `tool_use` | Inline chip: `Tool: <name>` |
| `error` | Red error box |
| `meta` | Not rendered (metadata only) |

Blocks render in `index` order — the order they arrived.

---

## 6. How it fits the canvas

`StreamingSlot` and `ResultSlot` are **slot components**. They can be:
- Mounted as seed nodes (like the other chat slots), or
- Composed inside an existing slot (e.g. `chat.thread` renders a `ResultSlot`
  for the active message)

Because they use `useStreamBlocks` (polling), they update independently of the
React Flow node lifecycle — no node re-mount needed when blocks arrive.

---

## 7. Acceptance (from PRD-C6)

- [x] `chat.streaming` node renders animated indicator during generation
- [x] `chat.result` node renders blocks progressively as they arrive
- [x] Blocks displayed in order of arrival (`index`)
- [x] Streaming indicator disappears when generation completes
- [x] `chat.result` shows all blocks after generation completes
- [x] `bun run typecheck` passes

---

## 8. Open items

- **Backend endpoint:** `/api/conversations/:id/stream-blocks` does not yet
  exist. The hook will return `[]` until it's added. See `08-backend-integration.md`.
- **WebSocket push:** replace polling with a `/ws/stream` forwarder from
  `StreamBlockStore` for lower latency.
- **Block diffing:** the hook replaces the entire `blocks` array each poll. For
  large transcripts this re-renders all blocks. A keyed diff (append only new
  indices) would reduce churn — but React's `key={kind-index}` already
  preserves DOM for unchanged blocks.
- **Error retry:** a failed poll is silently swallowed. Add retry/backoff and a
  visible error state.
