// ui/defaults/index.tsx
// Default slot renderers. Each wraps an existing component and accepts
// generic Record<string, unknown> props (AnyComponent contract) so the
// slot registry can resolve any slot without type mismatches.
//
// Props are extracted from the generic bag and forwarded to the real
// component. Missing/undefined props fall through to the component's
// own defaults.

'use client'

import { ConversationList } from '@/components/chat/ConversationList'
import { Composer } from '@/components/chat/Composer'
import { MessageBlock, RenderBlocks, type ContentBlock } from '@/components/chat/MessageBlock'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { CapabilityCatalog } from '@/components/chat/CapabilityCatalog'
import { StreamingIndicator } from '@/components/canvas/StreamingIndicator'
import type { WsStatus } from '@/hooks/useWebSocket'
import type { WsMessage } from '@/hooks/useWebSocket'

// ── Helpers ──────────────────────────────────────────────────────────────────

function cast<T>(v: unknown, fallback: T): T {
  return (v === undefined || v === null) ? fallback : v as T
}

// ── Slot: chat.entry (host container) ────────────────────────────────────────

export function DefaultChatEntry(props: Record<string, unknown>) {
  return (
    <div
      data-slot="chat.entry"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      {...props}
    />
  )
}

// ── Slot: chat.sidebar ───────────────────────────────────────────────────────

export function DefaultChatSidebar(props: Record<string, unknown>) {
  return (
    <ConversationList
      activeId={cast<string | null>(props.activeId, null)}
      onSelect={cast<(id: string) => void>(props.onSelect, () => {})}
      defaultProviderId={cast<string | undefined>(props.defaultProviderId, undefined)}
    />
  )
}

// ── Slot: chat.thread ────────────────────────────────────────────────────────

export function DefaultChatThread(props: Record<string, unknown>) {
  const blocks = cast<ContentBlock[]>(props.blocks, [])
  return <RenderBlocks blocks={blocks} />
}

// ── Slot: chat.bubble ────────────────────────────────────────────────────────

export function DefaultChatBubble(props: Record<string, unknown>) {
  const block = cast<ContentBlock>(props.block, { kind: 'text', content: '', index: 0 })
  return <MessageBlock block={block} />
}

// ── Slot: chat.composer ──────────────────────────────────────────────────────

export function DefaultChatComposer(props: Record<string, unknown>) {
  return (
    <Composer
      conversationId={cast<string | null>(props.conversationId, null)}
      wsStatus={cast<WsStatus>(props.wsStatus, 'disconnected')}
      wsMessage={cast<WsMessage | null>(props.wsMessage, null)}
    />
  )
}

// ── Slot: chat.send ──────────────────────────────────────────────────────────

export function DefaultChatSend(props: Record<string, unknown>) {
  const onClick = cast<() => void>(props.onClick, () => {})
  const disabled = cast<boolean>(props.disabled, false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-slot="chat.send"
      style={{
        padding: '8px 16px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--accent)',
        color: 'var(--bg)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      Send
    </button>
  )
}

// ── Slot: chat.attach ────────────────────────────────────────────────────────

export function DefaultChatAttach(props: Record<string, unknown>) {
  const onClick = cast<() => void>(props.onClick, () => {})
  return (
    <button
      type="button"
      onClick={onClick}
      data-slot="chat.attach"
      title="Attach file"
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text)',
        cursor: 'pointer',
        fontSize: 16,
      }}
    >
      +
    </button>
  )
}

// ── Slot: chat.streaming ─────────────────────────────────────────────────────

export function DefaultChatStreaming(props: Record<string, unknown>) {
  return (
    <StreamingIndicator
      wsStatus={cast<WsStatus>(props.wsStatus, 'disconnected')}
      isStreaming={cast<boolean>(props.isStreaming, false)}
      streamProgress={cast<number | undefined>(props.streamProgress, undefined)}
      lastEvent={cast<string | undefined>(props.lastEvent, undefined)}
    />
  )
}

// ── Slot: chat.result ────────────────────────────────────────────────────────

export function DefaultChatResult(props: Record<string, unknown>) {
  const blocks = cast<ContentBlock[]>(props.blocks, [])
  return <RenderBlocks blocks={blocks} />
}

// ── Slot: chat.confirm ───────────────────────────────────────────────────────

export function DefaultChatConfirm(props: Record<string, unknown>) {
  const message = cast<string>(props.message, 'Are you sure?')
  const onConfirm = cast<() => void>(props.onConfirm, () => {})
  const onCancel = cast<() => void>(props.onCancel, () => {})
  const open = cast<boolean>(props.open, false)

  if (!open) return null

  return (
    <div
      data-slot="chat.confirm"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 20,
          maxWidth: 360,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <p style={{ margin: '0 0 16px', color: 'var(--text)', fontSize: 14 }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Slot: chat.error ─────────────────────────────────────────────────────────

export function DefaultChatError(props: Record<string, unknown>) {
  const message = cast<string>(props.message, '')
  const onDismiss = cast<(() => void) | undefined>(props.onDismiss, undefined)

  if (!message) return null

  return (
    <div
      data-slot="chat.error"
      style={{
        padding: '10px 14px',
        borderRadius: 6,
        background: '#fef2f2',
        border: '1px solid #fecaca',
        color: '#991b1b',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: '#991b1b',
            cursor: 'pointer',
            fontSize: 16,
            padding: 0,
          }}
        >
          x
        </button>
      )}
    </div>
  )
}

// ── Slot: chat.header ────────────────────────────────────────────────────────

export function DefaultChatHeader(props: Record<string, unknown>) {
  return (
    <ChatHeader
      workspaceId={cast<string>(props.workspaceId, 'default')}
      paletteOpen={cast<boolean>(props.paletteOpen, false)}
      setPaletteOpen={cast<(v: boolean) => void>(props.setPaletteOpen, () => {})}
      themeOpen={cast<boolean>(props.themeOpen, false)}
      setThemeOpen={cast<(v: boolean | ((prev: boolean) => boolean)) => void>(props.setThemeOpen, () => {})}
    />
  )
}

// ── Slot: chat.actionBar ─────────────────────────────────────────────────────

export function DefaultChatActionBar(props: Record<string, unknown>) {
  return <CapabilityCatalog {...props} />
}
