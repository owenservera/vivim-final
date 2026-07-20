// web/ui/src/features/canvas/ResultSlot.tsx
// Renders stream blocks progressively as they arrive (PRD-C6 §3.2).
// Each block type gets a dedicated renderer; blocks are appended in order.

import type { ContentBlock } from 'shared/stream-blocks.js'
import { useStreamBlocks } from './useStreamBlocks.js'

interface ResultSlotProps {
  conversationId?: string
  messageId?: string
}

export function ResultSlot({ conversationId, messageId }: ResultSlotProps) {
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

function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.kind) {
    case 'text':
      return (
        <div style={{ color: '#e5e7eb', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {block.content}
        </div>
      )
    case 'code':
      return (
        <pre
          style={{
            background: '#1f2937',
            borderRadius: 8,
            padding: 12,
            overflow: 'auto',
            fontSize: 13,
            color: '#d1d5db',
            margin: 0,
          }}
        >
          <code>{block.content}</code>
          {block.language && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              {block.language}
            </div>
          )}
        </pre>
      )
    case 'thinking':
      return (
        <details style={{ color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>
          <summary>Thinking…</summary>
          <pre style={{ marginTop: 4, whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {block.content}
          </pre>
        </details>
      )
    case 'artifact':
      return (
        <div
          style={{
            border: '1px solid #374151',
            borderRadius: 8,
            padding: 12,
            background: '#111827',
          }}
        >
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
            {block.artifactType ?? 'artifact'}
          </div>
          <pre style={{ margin: 0, fontSize: 13, color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
            {block.content}
          </pre>
        </div>
      )
    case 'image':
      return (
        <img
          src={block.url}
          alt={block.alt ?? ''}
          style={{ maxWidth: '100%', borderRadius: 8 }}
        />
      )
    case 'citation':
      return (
        <div style={{ fontSize: 12, color: '#6b7280', borderLeft: '3px solid #374151', paddingLeft: 8 }}>
          {block.content}
          {block.source && (
            <span style={{ marginLeft: 4 }}>— {block.source}</span>
          )}
        </div>
      )
    case 'tool_use':
      return (
        <div
          style={{
            fontSize: 12,
            color: '#9ca3af',
            background: '#1f2937',
            borderRadius: 6,
            padding: '4px 8px',
          }}
        >
          Tool: {block.toolName}
        </div>
      )
    case 'error':
      return (
        <div
          style={{
            color: '#ef4444',
            background: '#1f2937',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 13,
          }}
        >
          Error: {block.message}
          {block.code && <span style={{ marginLeft: 4 }}>({block.code})</span>}
        </div>
      )
    case 'meta':
      return null // meta blocks are not rendered
    default:
      return null
  }
}
