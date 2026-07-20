// web/ui/src/ui/defaults/sidebar.tsx
// chat.sidebar — conversation list + new-chat. Provider-agnostic via the adapter.

import type { SidebarProps } from './types.js'

export function Sidebar({
  adapter,
  conversations,
  activeId,
  onSelect,
  onNew,
}: SidebarProps) {
  return (
    <div
      style={{
        width: 240,
        borderRight: '1px solid #e5e7eb',
        background: '#fafafa',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
        <button
          type="button"
          onClick={onNew}
          style={{
            width: '100%',
            background: adapter.brandColor,
            color: adapter.brandText,
            border: 'none',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New chat
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: '#9ca3af' }}>No conversations yet.</div>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: 'none',
                borderBottom: '1px solid #f0f0f0',
                background: c.id === activeId ? '#eef2ff' : 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                color: '#374151',
              }}
            >
              <div
                style={{
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.title || 'New conversation'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                {c.messageCount ? `${c.messageCount} msgs` : 'empty'}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
