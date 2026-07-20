// web/ui/src/features/canvas/StreamingSlot.tsx
// Renders a streaming indicator while the assistant is generating (PRD-C6 §3.1).
// Shows animated dots + block count during streaming; hidden when idle.

import { useStreamBlocks } from './useStreamBlocks.js'

interface StreamingSlotProps {
  conversationId?: string
  messageId?: string
}

export function StreamingSlot({ conversationId, messageId }: StreamingSlotProps) {
  const { blocks, isStreaming } = useStreamBlocks(conversationId, messageId)

  if (!isStreaming && blocks.length === 0) return null

  return (
    <div
      style={{
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: '#9ca3af',
        fontSize: 13,
      }}
    >
      {isStreaming && (
        <span className="streaming-dots" style={{ letterSpacing: 2 }}>
          ●●●
        </span>
      )}
      <span>
        {isStreaming
          ? `Generating… ${blocks.length} block${blocks.length !== 1 ? 's' : ''}`
          : `${blocks.length} block${blocks.length !== 1 ? 's' : ''} ready`}
      </span>
      <style>{`
        .streaming-dots {
          animation: pulse 1.2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
