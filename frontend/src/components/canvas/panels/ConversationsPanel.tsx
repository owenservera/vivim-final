'use client';

/**
 * components/canvas/panels/ConversationsPanel.tsx
 * --------------------------------------------------------------------
 * Conversations panel - list, search, create, delete conversations.
 * Replaces the old sidebar conversation list.
 */

import { useCallback, useMemo, useState } from 'react';
import { Icon } from '../Icon';
import { EmptyState } from '../EmptyState';
import { useConversation } from '@/sdk/web/use-conversation';
import { getProviderTheme } from '@/lib/provider-theme';

export function ConversationsPanel({ onSelect }: { onSelect?: (id: string) => void }) {
  const { conversations, loading, error, refresh, create, remove } = useConversation();
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title ?? '').toLowerCase().includes(q));
  }, [conversations, search]);

  const handleCreate = useCallback(async (providerId?: string) => {
    const conv = await create(providerId);
    if (conv) {
      setActiveId(conv.id);
      onSelect?.(conv.id);
    }
  }, [create, onSelect]);

  const handleDelete = useCallback(async (id: string) => {
    const removedId = await remove(id);
    if (removedId && activeId === id) setActiveId(null);
  }, [remove, activeId]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    onSelect?.(id);
  }, [onSelect]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search + Create */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--border)', display: 'flex', gap: 4 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Icon name="search" size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            style={{
              width: '100%',
              padding: '4px 8px 4px 24px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 11,
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => handleCreate()}
          style={{
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--background)',
            color: 'var(--foreground)',
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Icon name="plus" size={11} />
          New
        </button>
      </div>

      {/* Conversation list */}
      <div style={{ flex: 1, overflow: 'auto', padding: 4 }} className="scrollbar-thin">
        {loading && <EmptyState>Loading...</EmptyState>}
        {error && (
          <div style={{ padding: 16, textAlign: 'center', color: '#ef4444', fontSize: 11 }}>
            {error}
          </div>
        )}
        {!loading && conversations.length === 0 && <EmptyState>No conversations yet</EmptyState>}
        {filtered.map((conv) => {
          const active = conv.id === activeId;
          const pTheme = getProviderTheme(conv.providerId);
          return (
            <div
              key={conv.id}
              onClick={() => handleSelect(conv.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                marginBottom: 2,
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? 'var(--accent-foreground)' : 'var(--foreground)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (activeId !== conv.id) e.currentTarget.style.background = 'transparent';
              }}
              onMouseLeave={(e) => {
                if (activeId !== conv.id) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Provider dot */}
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: conv.providerId ? getProviderTheme(conv.providerId).color : 'var(--muted-foreground)',
                flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {conv.title || 'New conversation'}
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'var(--muted-foreground)',
                  marginTop: 2,
                }}>
                  {conv.providerId ?? 'unknown'}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                style={{
                  padding: 2,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.5,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; }}
              >
                <Icon name="trash" size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
