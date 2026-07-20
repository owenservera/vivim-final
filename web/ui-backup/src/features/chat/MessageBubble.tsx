// web/ui/src/features/chat/MessageBubble.tsx
// Renders a single chat message. Provider-agnostic: brand color comes from the
// adapter so the same component serves Claude/ChatGPT/Gemini.
// Supports: inline editing, attachment display, file downloads.

import { useEffect, useRef, useState } from 'react'
import type { ProviderChatAdapter } from '../../providers/registry.js'
import { downloadUrl } from './api.js'
import type { ChatAttachment, ChatMessage } from './types.js'

interface Props {
  message: ChatMessage
  adapter: ProviderChatAdapter
  isLast?: boolean
  onEdit?: (messageId: string, newContent: string) => Promise<void>
  onUploadAttachment?: (messageId: string, file: File) => Promise<void>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentChip({ attachment }: { attachment: ChatAttachment }) {
  const isImage = attachment.mimeType.startsWith('image/')
  return (
    <a
      href={downloadUrl(attachment.id)}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 8,
        background: isImage ? 'rgba(59,130,246,0.1)' : 'rgba(107,114,128,0.1)',
        color: '#2563eb',
        fontSize: 12,
        textDecoration: 'none',
        marginTop: 6,
        border: '1px solid rgba(59,130,246,0.2)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(59,130,246,0.15)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isImage
          ? 'rgba(59,130,246,0.1)'
          : 'rgba(107,114,128,0.1)'
      }}
      title={`Download ${attachment.filename}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
      </svg>
      <span
        style={{
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {attachment.filename}
      </span>
      <span style={{ color: '#9ca3af', fontSize: 11 }}>{formatBytes(attachment.sizeBytes)}</span>
    </a>
  )
}

export function MessageBubble({ message, adapter, isLast, onEdit, onUploadAttachment }: Props) {
  const isUser = message.role === 'user'
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(editContent.length, editContent.length)
    }
  }, [editing])

  const handleSave = async () => {
    if (!onEdit || editContent.trim() === message.content.trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onEdit(message.id, editContent.trim())
      setEditing(false)
    } catch {
      // keep editing state on failure
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSave()
    }
    if (e.key === 'Escape') {
      setEditContent(message.content)
      setEditing(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onUploadAttachment) {
      void onUploadAttachment(message.id, file)
    }
    e.target.value = ''
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        margin: '8px 0',
      }}
    >
      <div style={{ maxWidth: '78%', position: 'relative' }}>
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 14,
            borderTopRightRadius: isUser ? 2 : 14,
            borderTopLeftRadius: isUser ? 14 : 2,
            background: isUser ? adapter.brandColor : '#f3f4f6',
            color: isUser ? adapter.brandText : '#111827',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
            fontSize: 14,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          {editing ? (
            <div>
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  minHeight: 60,
                  padding: 6,
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.15)',
                  background: 'rgba(255,255,255,0.9)',
                  color: '#111',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: 12,
                    cursor: saving ? 'wait' : 'pointer',
                  }}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditContent(message.content)
                    setEditing(false)
                  }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(0,0,0,0.15)',
                    background: 'transparent',
                    color: '#6b7280',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            message.content || <span style={{ opacity: 0.6 }}>(empty)</span>
          )}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {message.attachments.map((att) => (
              <AttachmentChip key={att.id} attachment={att} />
            ))}
          </div>
        )}

        {/* Edit + Attach buttons (hover) */}
        {!editing && isUser && isLast && (onEdit || onUploadAttachment) && (
          <div
            style={{
              display: 'flex',
              gap: 4,
              marginTop: 4,
              opacity: 0,
              transition: 'opacity 0.15s',
            }}
            className="message-actions"
          >
            {onEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: '#fff',
                  color: '#6b7280',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
                title="Edit message"
              >
                Edit
              </button>
            )}
            {onUploadAttachment && (
              <label
                style={{
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: '#fff',
                  color: '#6b7280',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
                title="Attach file"
              >
                Attach
                <input type="file" style={{ display: 'none' }} onChange={handleFileInput} />
              </label>
            )}
          </div>
        )}

        <style>{'.message-actions { opacity: 0; } div:hover > .message-actions { opacity: 1; }'}</style>
      </div>
    </div>
  )
}
