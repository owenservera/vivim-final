// web/ui/src/features/chat/Composer.tsx
// Message composer. Enter sends, Shift+Enter newline. Branding + copy come from
// the provider adapter so it is shared across all providers.
// Supports file attachments via the attach button.

import { type KeyboardEvent, useRef, useState } from 'react'
import type { ProviderChatAdapter } from '../../providers/registry.js'

interface Props {
  adapter: ProviderChatAdapter
  disabled: boolean
  onSend: (text: string) => void
  onAttach?: (file: File) => void
  attachDisabled?: boolean
}

export function Composer({ adapter, disabled, onSend, onAttach, attachDisabled }: Props) {
  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    if (pendingFile && onAttach) {
      onAttach(pendingFile)
      setPendingFile(null)
    }
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPendingFile(file)
    }
    e.target.value = ''
  }

  const removePending = () => setPendingFile(null)

  return (
    <div style={{ borderTop: '1px solid #e5e7eb', padding: 12, background: '#fff' }}>
      {/* Pending file indicator */}
      {pendingFile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            marginBottom: 6,
            borderRadius: 6,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            fontSize: 12,
            color: '#0369a1',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
          </svg>
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {pendingFile.name}
          </span>
          <button
            type="button"
            onClick={removePending}
            style={{
              background: 'none',
              border: 'none',
              color: '#0369a1',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
              fontSize: 14,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        {/* Attach button */}
        {onAttach && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || attachDisabled}
            title="Attach file"
            style={{
              background: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              padding: '10px 10px',
              cursor: disabled || attachDisabled ? 'not-allowed' : 'pointer',
              opacity: disabled || attachDisabled ? 0.5 : 1,
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

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
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          style={{
            background: adapter.brandColor,
            color: adapter.brandText,
            border: 'none',
            borderRadius: 10,
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            cursor: disabled || !text.trim() ? 'not-allowed' : 'pointer',
            opacity: disabled || !text.trim() ? 0.5 : 1,
          }}
        >
          {disabled ? '…' : 'Send'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{adapter.composerHint}</div>
    </div>
  )
}
