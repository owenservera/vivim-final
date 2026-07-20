'use client';

/**
 * components/chat/ConversationList.tsx — Moment 3: Conversation List
 * --------------------------------------------------------------------
 * Sidebar listing past conversations. Loads via `GET /api/conversations`,
 * supports create (`POST /api/conversations`) and delete
 * (`DELETE /api/conversations/:id`). Selecting a conversation lifts the
 * id to the parent (which loads its messages). Per spec FR-007/009/010
 * and AC 1-4.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  listConversations,
  createConversation,
  deleteConversation,
} from '@/sdk/backend-client';

interface Conversation {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ConversationListProps {
  activeId: string | null;
  onSelect: (id: string) => void;
  defaultProviderId?: string;
}

export function ConversationList({ activeId, onSelect, defaultProviderId }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listConversations().catch((e) => {
      setError(String(e));
      return null;
    });
    if (res?.ok) setConversations(res.data?.conversations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

      <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {loading && <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>}
        {error && <div style={{ padding: 12, color: '#ef4444', fontSize: 12 }}>{error}</div>}
        {!loading && conversations.length === 0 && (
          <div style={{ padding: 16, color: 'var(--text-subtle)', fontSize: 12 }}>No conversations yet.</div>
        )}
        {conversations.map((c) => {
          const active = c.id === activeId;
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
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
