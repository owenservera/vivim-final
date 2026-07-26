'use client';

import { useMemo, useState } from 'react';
import { useConversation } from '@/sdk/web/use-conversation';
import { getProviderTheme } from '@/lib/provider-theme';

interface Conversation {
  id: string;
  title?: string | null;
  providerId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  defaultProviderId?: string;
}

export function ConversationList({ activeId, onSelect, defaultProviderId }: ConversationListProps) {
  const { conversations, loading, error, refresh, create, remove } = useConversation();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title ?? '').toLowerCase().includes(q));
  }, [conversations, search]);

  const handleCreate = async () => {
    const conv = await create(defaultProviderId);
    if (conv) onSelect(conv.id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const ok = await remove(id);
    if (ok && activeId === id) onSelect('');
  };

  return (
    <div
      data-moment="3"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <button
          onClick={handleCreate}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          + New
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 4 }} className="scrollbar-thin">
        {loading && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
            Loading conversations...
          </div>
        )}
        {error && (
          <div style={{ padding: 16, textAlign: 'center', color: '#ef4444', fontSize: 11 }}>
            {error}
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No conversations yet.</div>
        )}
        {!loading && conversations.length > 0 && filtered.length === 0 && (
          <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12 }}>No conversations match your filter.</div>
        )}
        {filtered.map((c) => {
          const active = c.id === activeId;
          const pTheme = getProviderTheme(c.providerId);
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                marginBottom: 4,
                borderRadius: 6,
                cursor: 'pointer',
                background: active ? 'var(--accent-subtle)' : 'transparent',
                border: active ? '1px solid var(--accent)' : '1px solid transparent',
                fontSize: 12,
              }}
            >
              {c.providerId && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: pTheme.bg,
                    color: pTheme.fg,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {pTheme.label}
                </span>
              )}
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {c.title || 'New conversation'}
              </span>
              <button
                onClick={(e) => handleDelete(e, c.id)}
                style={{
                  padding: '2px 4px',
                  border: 'none',
                  borderRadius: 3,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 10,
                  flexShrink: 0,
                }}
                title="Delete"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
