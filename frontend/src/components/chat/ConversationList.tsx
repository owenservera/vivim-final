'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listConversations,
  createConversation,
  deleteConversation,
} from '@/sdk/backend-client';

interface Conversation {
  id: string;
  title?: string;
  providerId?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  defaultProviderId?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  grok: 'Grok',
};

const PROVIDER_COLORS: Record<string, { bg: string; fg: string }> = {
  chatgpt: { bg: 'rgba(34,197,94,0.15)', fg: 'rgb(34,197,94)' },
  claude: { bg: 'rgba(249,115,22,0.15)', fg: 'rgb(249,115,22)' },
  gemini: { bg: 'rgba(59,130,246,0.15)', fg: 'rgb(59,130,246)' },
  deepseek: { bg: 'rgba(139,92,246,0.15)', fg: 'rgb(139,92,246)' },
  qwen: { bg: 'rgba(236,72,153,0.15)', fg: 'rgb(236,72,153)' },
  grok: { bg: 'rgba(107,114,128,0.15)', fg: 'rgb(107,114,128)' },
};

function getProviderStyle(providerId?: string) {
  const c = providerId ? PROVIDER_COLORS[providerId] : undefined;
  return c ?? { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' };
}

export function ConversationList({ activeId, onSelect, defaultProviderId }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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

  const handleCreate = async () => {
    const res = await createConversation(defaultProviderId).catch(() => null);
    if (res?.ok && res.data) {
      setConversations((prev) => [res.data as Conversation, ...prev]);
      onSelect((res.data as Conversation).id);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const res = await deleteConversation(id).catch(() => null);
    if (res?.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) onSelect('');
    }
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
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <strong style={{ fontSize: 12 }}>Conversations</strong>
        <button
          type="button"
          onClick={handleCreate}
          title="New conversation"
          style={{
            padding: '2px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--accent)',
            color: 'var(--accent-foreground, #fff)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
        >
          + New
        </button>
      </div>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter conversations…"
          style={{
            width: '100%',
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 11,
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {loading && (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 36, borderRadius: 6, background: 'var(--bg-subtle)', animation: 'skeleton-pulse 1.5s infinite' }} />
            ))}
          </div>
        )}
        {error && (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: '#ef4444', fontSize: 12 }}>{error}</div>
            <button
              type="button"
              onClick={load}
              style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              Retry
            </button>
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <div style={{ padding: 16, color: 'var(--text-subtle)', fontSize: 12 }}>No conversations yet.</div>
        )}
        {!loading && conversations.length > 0 && filtered.length === 0 && (
          <div style={{ padding: 16, color: 'var(--text-subtle)', fontSize: 12 }}>No conversations match your filter.</div>
        )}
        {filtered.map((c) => {
          const active = c.id === activeId;
          const pStyle = getProviderStyle(c.providerId);
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
                    background: pStyle.bg,
                    color: pStyle.fg,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {PROVIDER_LABELS[c.providerId] ?? c.providerId}
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
                {c.title ?? 'Untitled conversation'}
              </span>
              <button
                type="button"
                onClick={(e) => handleDelete(e, c.id)}
                title="Delete"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
