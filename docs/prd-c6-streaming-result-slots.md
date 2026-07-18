# PRD-C6: Streaming/Result Slots

**Status:** Proposed | **Author:** vivim runtime | **Date:** 2026-07-16
**Part of:** [PRD-C1: Unified Infinite-Canvas Surface](prd-canvas-unified-surface.md)

## 1. Problem

`StreamParserEngine` produces blocks (text, code, artifacts) during streaming, but there is no `chat.streaming` or `chat.result` slot consuming them progressively. The current `ChatPage` has no streaming indicator slot.

## 2. Goals

- **G1 — `chat.streaming` slot.** Renders a streaming indicator (animated dots/progress) while the assistant is generating.
- **G2 — `chat.result` slot.** Renders rich result blocks (code, artifacts, structured data) progressively as they arrive.
- **G3 — Progressive rendering.** Blocks are appended to the result slot as `StreamParserEngine` emits them; no wait for completion.

## 3. Design

### 3.1 Streaming nodeType

```tsx
function StreamingNodeType({ data }: { data: { conversationId: string } }) {
  const { blocks, isStreaming } = useStreamBlocks(data.conversationId)
  if (!isStreaming && blocks.length === 0) return null
  return <StreamingIndicator blocks={blocks} isStreaming={isStreaming} />
}
```

### 3.2 Result nodeType

```tsx
function ResultNodeType({ data }: { data: { conversationId: string } }) {
  const { blocks } = useStreamBlocks(data.conversationId)
  return (
    <div className="result-slot">
      {blocks.map((block) => (
        <StreamBlock key={block.id} block={block} />
      ))}
    </div>
  )
}
```

### 3.3 useStreamBlocks hook

Subscribes to `StreamBlockStore` for a conversation; returns `{ blocks, isStreaming }`. Updates as blocks arrive.

## 4. Acceptance

- `chat.streaming` node renders animated indicator during assistant generation
- `chat.result` node renders blocks progressively as they arrive
- Blocks are displayed in order of arrival
- Streaming indicator disappears when generation completes
- `chat.result` shows all blocks after generation completes
