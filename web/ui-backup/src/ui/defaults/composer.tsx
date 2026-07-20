// web/ui/src/ui/defaults/composer.tsx
// chat.composer / chat.send / chat.attach defaults.
//
// The composer owns the textarea and resolves the send + attach slots so those
// buttons are independently hot-swappable (and dispatch through ActionRegistry
// at the surface, B8).

import { useState, type KeyboardEvent } from 'react'
import { useSlot } from '../useSlot.js'
import type { AttachButtonProps, ComposerProps, SendButtonProps } from './types.js'

/** chat.send default. */
export function SendButton({ onSend, disabled, brandColor, brandText, pending }: SendButtonProps) {
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={disabled}
      style={{
        background: brandColor,
        color: brandText,
        border: 'none',
        borderRadius: 10,
        padding: '10px 18px',
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {pending ? '…' : 'Send'}
    </button>
  )
}

/** chat.attach default. Hidden by the composer when the capability disallows it. */
export function AttachButton({ onAttach, disabled, brandColor, brandText }: AttachButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        // Minimal file picker; real capture is backend-driven (Governor Canon).
        const input = document.createElement('input')
        input.type = 'file'
        input.onchange = () => {
          const file = input.files?.[0]
          if (file) onAttach(file)
        }
        input.click()
      }}
      disabled={disabled}
      title="Attach file"
      style={{
        background: 'transparent',
        color: brandColor,
        border: `1px solid ${brandColor}`,
        borderRadius: 10,
        padding: '10px 12px',
        fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      📎
    </button>
  )
}

/** chat.composer default. */
export function Composer({ adapter, disabled, onSend, onAttach, canAttach }: ComposerProps) {
  const [text, setText] = useState('')
  const SendComp = useSlot('chat.send') as unknown as React.ComponentType<SendButtonProps>
  const AttachComp = useSlot('chat.attach') as unknown as React.ComponentType<AttachButtonProps>

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div style={{ borderTop: '1px solid #e5e7eb', padding: 12, background: '#fff' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={adapter.placeholder}
          disabled={disabled}
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            border: '1px solid #d1d5db',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
            opacity: disabled ? 0.6 : 1,
          }}
        />
        {canAttach && onAttach ? (
          <AttachComp
            onAttach={onAttach}
            disabled={disabled}
            brandColor={adapter.brandColor}
            brandText={adapter.brandText}
          />
        ) : null}
        <SendComp
          onSend={submit}
          disabled={disabled || !text.trim()}
          brandColor={adapter.brandColor}
          brandText={adapter.brandText}
          pending={disabled}
        />
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{adapter.composerHint}</div>
    </div>
  )
}
