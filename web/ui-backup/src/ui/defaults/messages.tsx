// web/ui/src/ui/defaults/messages.tsx
// chat.bubble / chat.thread / chat.streaming / chat.result defaults.
//
// Thread resolves the bubble, streaming, and result slots itself so each can be
// hot-swapped independently (H4: every slot resolves through the registry).

import { useEffect, useRef } from 'react'
import { MessageBubble } from '../../features/chat/MessageBubble.js'
import { useSlot } from '../useSlot.js'
import type { BubbleProps, ResultProps, StreamingProps, ThreadProps } from './types.js'

/** chat.bubble default — reuses the existing provider-agnostic message bubble. */
export function Bubble(props: BubbleProps) {
  return MessageBubble(props)
}

/** chat.streaming default — small pulsing indicator while a turn runs. */
export function Streaming({ active }: StreamingProps) {
  if (!active) return null
  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 16px', color: '#9ca3af', fontSize: 13 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#9ca3af',
          animation: 'vivim-pulse 1s ease-in-out infinite',
        }}
      />
      generating…
    </div>
  )
}

/** chat.result default — renders StreamParserEngine blocks (artifact/code/etc). */
export function Result({ blocks }: ResultProps) {
  if (!blocks || blocks.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      {blocks.map((b, i) => (
        <div
          key={i}
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '8px 10px',
            background: '#f8fafc',
            fontSize: 13,
          }}
        >
          <div
            style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', marginBottom: 2 }}
          >
            {b.kind}
          </div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
            {b.content}
          </pre>
        </div>
      ))}
    </div>
  )
}

/** chat.thread default — scroll region rendering bubbles + streaming + result slots. */
export function Thread({
  messages,
  adapter,
  emptyHint,
  streaming,
  onEditMessage,
  onUploadAttachment,
}: ThreadProps) {
  const BubbleComp = useSlot('chat.bubble') as unknown as React.ComponentType<BubbleProps>
  const StreamingComp = useSlot('chat.streaming') as unknown as React.ComponentType<StreamingProps>
  const ResultComp = useSlot('chat.result') as unknown as React.ComponentType<ResultProps>
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = threadRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [messages, streaming])

  return (
    <div
      ref={threadRef}
      style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', background: '#fff' }}
    >
      {messages.length === 0 && !streaming ? (
        <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 24, textAlign: 'center' }}>
          {emptyHint}
        </div>
      ) : (
        messages.map((m, i) => (
          <div key={m.id}>
            <BubbleComp
              message={m}
              adapter={adapter}
              isLast={i === messages.length - 1}
              onEdit={onEditMessage}
              onUploadAttachment={onUploadAttachment}
            />
            {m.blocksJson ? (
              <ResultComp
                blocks={(() => {
                  try {
                    return JSON.parse(m.blocksJson!) as Array<{ kind: string; content: string }>
                  } catch {
                    return []
                  }
                })()}
              />
            ) : null}
          </div>
        ))
      )}
      <StreamingComp active={streaming} />
    </div>
  )
}
