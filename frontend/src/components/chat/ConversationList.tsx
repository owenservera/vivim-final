'use client';

import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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

const ITEM_HEIGHT = 48;

export function ConversationList({ activeId, onSelect, defaultProviderId }: ConversationListProps) {
  const { conversations, loading, error, refresh, create, remove } = useConversation();
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title ?? '').toLowerCase().includes(q));
  }, [conversations, search]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  const handleCreate = async () => {
    const conv = await create(defaultProviderId);
    if (conv) onSelect(conv.id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const removedId = await remove(id);
    if (removedId && activeId === id) onSelect('');
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
          type="button"
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

      {filtered.length > 0 && (
        <div
          ref={scrollRef}
          style={{ flex: 1, overflow: 'auto', padding: 4 }}
          className="scrollbar-thin"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow: { index: number; key: string; start: number; size: number }) => {
              const c = filtered[virtualRow.index];
              const active = c.id === activeId;
              const pTheme = getProviderTheme(c.providerId);
              return (
                <div
                  key={c.id}
                  data-index={virtualRow.index}
                  ref={(el: HTMLDivElement | null) => { if (el) (virtualizer as unknown as { measureElement: (el: Element) => void }).measureElement(el) }}
                  onClick={() => onSelect(c.id)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: active ? 'var(--accent-subtle)' : 'transparent',
                    border: active ? '1px solid var(--accent)' : '1px solid transparent',
                    fontSize: 12,
                    transform: `translateY(${virtualRow.start}px)`,
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
                    type="button"
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
      )}
    </div>
  );
}
