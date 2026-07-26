'use client';

/**
 * components/canvas/panels/ConversationsPanel.tsx
 * --------------------------------------------------------------------
 * Conversations panel - list, search, create, delete conversations.
 * Replaces the old sidebar conversation list.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { listConversations, createConversation, deleteConversation } from '@/sdk/backend-client';

interface Conversation {
  id: string;
  title?: string | null;
  providerId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

const PROVIDER_COLORS: Record<string, string> = {
  chatgpt: 'rgb(34,197,94)',
  claude: 'rgb(249,115,22)',
  gemini: 'rgb(59,130,246)',
  deepseek: 'rgb(139,92,246)',
  qwen: 'rgb(236,72,153)',
  grok: 'rgb(107,114,128)',
};

export function ConversationsPanel({ onSelect }: { onSelect?: (id: string) => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listConversations();
      if (!mountedRef.current) return;
      if (res?.ok) {
        setConversations(res.data?.conversations ?? []);
      }
    } catch (e) {
      if (mountedRef.current) setError(String(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => (c.title ?? '').toLowerCase().includes(q));
  }, [conversations, search]);

  const handleCreate = useCallback(async (providerId?: string) => {
    try {
      const res = await createConversation(providerId);
      if (res?.ok && res.data) {
        setConversations((prev) => [res.data!, ...prev]);
        setActiveId(res.data.id);
        onSelect?.(res.data.id);
      }
    } catch (e) {
      setError(String(e));
    }
  }, [onSelect]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await deleteConversation(id);
      if (res?.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeId === id) {
          setActiveId(null);
        }
      }
    } catch (e) {
      setError(String(e));
    }
  }, [activeId]);

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
            placeholder="Search conversations..."
            style={{
              width: '100%',
              padding: '6px 8px 6px 26px',
              border: '1px solid var(--border)',
              borderRadius: 'calc(var(--radius) - 4px)',
              background: 'var(--background)',
              color: 'var(--foreground)',
              fontSize: 11,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => handleCreate()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: '1px solid var(--border)',
            borderRadius: 'calc(var(--radius) - 4px)',
            background: 'var(--background)',
            cursor: 'pointer',
            color: 'var(--foreground)',
          }}
        >
          <Icon name="plus" size={12} />
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 4 }} className="scrollbar-thin">
        {loading && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
            Loading...
          </div>
        )}
        {error && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--destructive)', fontSize: 11 }}>
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
            No conversations yet
          </div>
        )}
        {filtered.map((conv) => (
          <div
            key={conv.id}
            onClick={() => handleSelect(conv.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 'calc(var(--radius) - 4px)',
              cursor: 'pointer',
              background: activeId === conv.id ? 'color-mix(in oklch, var(--ring) 10%, transparent)' : 'transparent',
              border: activeId === conv.id ? '1px solid color-mix(in oklch, var(--ring) 20%, transparent)' : '1px solid transparent',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (activeId !== conv.id) e.currentTarget.style.background = 'var(--muted)';
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
              background: conv.providerId ? PROVIDER_COLORS[conv.providerId] ?? 'var(--muted-foreground)' : 'var(--muted-foreground)',
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                border: 'none',
                background: 'transparent',
                color: 'var(--muted-foreground)',
                borderRadius: 3,
                cursor: 'pointer',
                opacity: 0.6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--destructive)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
            >
              <Icon name="trash-2" size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
