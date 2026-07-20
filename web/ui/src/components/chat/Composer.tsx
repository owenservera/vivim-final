'use client';

/**
 * components/chat/Composer.tsx — Moment 2: Send a Message (Streaming)
 * --------------------------------------------------------------------
 * Composer + message history for a single conversation. Sends via
 * `POST /api/conversations/:id/messages` and renders streamed response
 * chunks delivered over WebSocket `conversation:<id>` topic
 * (`conversation:block` / `conversation:complete` / `conversation:error`).
 * Per spec FR-003/FR-004 and AC 1-5.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessage, getMessages } from '@/sdk/backend-client';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import { StreamingIndicator } from '@/components/canvas/StreamingIndicator';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface ComposerProps {
  conversationId: string | null;
  wsStatus: ReturnType<typeof useWebSocket>['status'];
  wsMessage?: WsMessage | null;
}

export function Composer({ conversationId, wsStatus, wsMessage }: ComposerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [lastEvent, setLastEvent] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async (id: string) => {
    const res = await getMessages(id).catch(() => null);
    if (res?.ok) setMessages((res.data?.messages ?? []) as Message[]);
  }, []);

  useEffect(() => {
    setMessages([]);
    setStreamingText('');
    setStreaming(false);
    if (conversationId) loadHistory(conversationId);
  }, [conversationId, loadHistory]);

  // Handle streamed WS events for this conversation (driven by wsMessage prop).
  useEffect(() => {
    const msg = wsMessage;
    if (!msg || !conversationId) return;
    if (msg.type === 'conversation:block') {
      const payload = msg.payload as { conversationId?: string; block?: { text?: string; content?: string } };
      if (payload?.conversationId !== conversationId) return;
      const chunk = payload.block?.text ?? payload.block?.content ?? '';
      setStreaming(true);
      setStreamingText((t) => t + chunk);
      setLastEvent('block');
    } else if (msg.type === 'conversation:complete') {
      const payload = msg.payload as { conversationId?: string };
      if (payload?.conversationId !== conversationId) return;
      setStreaming(false);
      setLastEvent('complete');
    } else if (msg.type === 'conversation:error') {
      const payload = msg.payload as { conversationId?: string; error?: string };
      if (payload?.conversationId !== conversationId) return;
      setStreaming(false);
      setLastEvent(`error: ${payload.error ?? 'unknown'}`);
    }
  }, [wsMessage, conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    if (!streaming && streamingText) {
      // Persist completed streamed text as an assistant message.
      const completed = streamingText;
      setMessages((prev) => [
        ...prev,
        { id: `stream-${Date.now()}`, role: 'assistant', content: completed, createdAt: new Date().toISOString() },
      ]);
      setStreamingText('');
    }
  }, [conversationId, streaming, streamingText]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText]);

  const send = async () => {
    if (!conversationId || !draft.trim()) return;
    const text = draft.trim();
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    setStreamingText('');
    setStreaming(true);
    const res = await sendMessage(conversationId, text).catch(() => null);
    if (res?.ok && res.data) {
      setMessages((prev) => [...prev, res.data as Message]);
    } else if (!res?.ok) {
      setStreaming(false);
      setLastEvent(`send failed: ${res?.error ?? 'unknown'}`);
    }
  };

  if (!conversationId) {
    return (
      <div
        data-moment="2"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-subtle)',
          fontFamily: 'ui-sans-serif, system-ui',
          fontSize: 13,
        }}
      >
        Select or create a conversation to start messaging.
      </div>
    );
  }

  return (
    <div
      data-moment="2"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
        minHeight: 0,
      }}
    >
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '8px 12px',
              borderRadius: 10,
              background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)',
              color: m.role === 'user' ? 'var(--accent-foreground, #fff)' : 'var(--text)',
              border: '1px solid var(--border)',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.content}
          </div>
        ))}
        {streaming && (
          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: '80%',
              padding: '8px 12px',
              borderRadius: 10,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {streamingText}
            <span style={{ opacity: 0.5 }}>▍</span>
          </div>
        )}
      </div>

      <StreamingIndicator wsStatus={wsStatus} isStreaming={streaming} lastEvent={lastEvent} />

      <div style={{ display: 'flex', gap: 8, padding: 10, borderTop: '1px solid var(--border)' }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message… (Enter to send)"
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            padding: '8px 10px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!draft.trim()}
          style={{
            padding: '8px 16px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: draft.trim() ? 'var(--accent)' : 'var(--bg-subtle)',
            color: draft.trim() ? 'var(--accent-foreground, #fff)' : 'var(--text-muted)',
            cursor: draft.trim() ? 'pointer' : 'not-allowed',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
