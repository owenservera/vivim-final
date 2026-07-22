'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessage, getMessages } from '@/sdk/backend-client';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import { StreamingIndicator } from '@/components/canvas/StreamingIndicator';
import { classify } from '@/ml/prerouter';
import { useMlStore } from '@/ml/ml-store';
import { RenderBlocks, type ContentBlock } from './MessageBlock';
import { LatencyBreakdown, type TimingInfo } from './LatencyBreakdown';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  blocks?: ContentBlock[];
  timing?: TimingInfo;
  createdAt: string;
}

interface ComposerProps {
  conversationId: string | null;
  wsStatus: ReturnType<typeof useWebSocket>['status'];
  wsMessage?: WsMessage | null;
}

interface PendingBlock {
  kind: string;
  text: string;
}

function normalizeKind(raw: string | undefined): string {
  const map: Record<string, string> = {
    text: 'text',
    reasoning: 'thinking',
    code: 'code',
    file: 'file',
    'tool-call': 'tool-call',
    'tool-result': 'tool-result',
    meta: 'meta',
    error: 'error',
    'step-start': 'step-start',
  }
  return map[raw ?? ''] ?? 'text'
}

export function Composer({ conversationId, wsStatus, wsMessage }: ComposerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingBlocks, setStreamingBlocks] = useState<ContentBlock[]>([]);
  const [streamingTiming, setStreamingTiming] = useState<TimingInfo | null>(null);
  const [lastEvent, setLastEvent] = useState<string | undefined>();
  const [localSuggestion, setLocalSuggestion] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pendingBlocksRef = useRef<PendingBlock[]>([]);
  const pendingTimingRef = useRef<TimingInfo | null>(null);
  const rafRef = useRef<number | null>(null);

  // RAF-batched flush for streaming blocks
  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const batch = pendingBlocksRef.current.splice(0);
      if (batch.length > 0) {
        setStreamingBlocks((prev) => [
          ...prev,
          ...batch.map((b, i) => ({
            kind: b.kind,
            content: b.text,
            index: prev.length + i,
          })),
        ]);
      }
      if (pendingTimingRef.current) {
        setStreamingTiming(pendingTimingRef.current);
        pendingTimingRef.current = null;
      }
    });
  }, []);

  const loadHistory = useCallback(async (id: string) => {
    const res = await getMessages(id).catch(() => null);
    if (res?.ok) setMessages((res.data?.messages ?? []) as Message[]);
  }, []);

  useEffect(() => {
    setMessages([]);
    setStreamingBlocks([]);
    setStreamingTiming(null);
    setStreaming(false);
    if (conversationId) loadHistory(conversationId);
  }, [conversationId, loadHistory]);

  useEffect(() => {
    const msg = wsMessage;
    if (!msg || !conversationId) return;
    if (msg.type === 'conversation:block') {
      const payload = msg.payload as {
        conversationId?: string;
        block?: { type?: string; kind?: string; text?: string; content?: string };
        timing?: TimingInfo;
      };
      if (payload?.conversationId !== conversationId) return;
      setStreaming(true);
      const kind = normalizeKind(payload.block?.type ?? payload.block?.kind);
      const chunk = payload.block?.text ?? payload.block?.content ?? '';
      if (chunk) {
        pendingBlocksRef.current.push({ kind, text: chunk });
        scheduleFlush();
      }
      if (payload.timing) {
        pendingTimingRef.current = payload.timing;
        scheduleFlush();
      }
      setLastEvent('block');
    } else if (msg.type === 'conversation:complete') {
      const payload = msg.payload as { conversationId?: string; timing?: TimingInfo };
      if (payload?.conversationId !== conversationId) return;
      // Flush any remaining buffered blocks
      const batch = pendingBlocksRef.current.splice(0);
      const finalTiming = payload.timing ?? pendingTimingRef.current;
      setStreaming(false);
      setLastEvent('complete');
      // Persist completed blocks as an assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: `stream-${Date.now()}`,
          role: 'assistant',
          content: '',
          blocks:
            batch.length > 0
              ? batch.map((b, i) => ({ kind: b.kind, content: b.text, index: i }))
              : undefined,
          timing: finalTiming ?? undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingBlocks([]);
      setStreamingTiming(null);
      pendingTimingRef.current = null;
    } else if (msg.type === 'conversation:error') {
      const payload = msg.payload as { conversationId?: string; error?: string };
      if (payload?.conversationId !== conversationId) return;
      setStreaming(false);
      setLastEvent(`error: ${payload.error ?? 'unknown'}`);
    }
    // scheduleFlush is intentionally excluded to avoid re-running on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsMessage, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streamingBlocks]);

  const [lastError, setLastError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const retryLast = useCallback(async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || !conversationId) return;
    setRetrying(true);
    setLastError(null);
    setStreaming(true);
    setStreamingBlocks([]);
    setStreamingTiming(null);
    const res = await sendMessage(conversationId, lastUser.content).catch(() => null);
    if (!res?.ok) {
      setStreaming(false);
      setLastError(res?.error ?? 'Retry failed');
    }
    setRetrying(false);
  }, [conversationId, messages]);

  const send = async () => {
    if (!conversationId || !draft.trim()) return;
    const text = draft.trim();
    setLastError(null);

    const route = classify(text);
    if (route.route === 'local' && route.action) {
      useMlStore.getState().recordLocalAction();
      setLocalSuggestion(`Local action detected: ${route.action} (remote fallback used)`);
    } else {
      setLocalSuggestion(null);
    }

    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    setStreamingBlocks([]);
    setStreamingTiming(null);
    setStreaming(true);
    const res = await sendMessage(conversationId, text).catch(() => null);
    if (res?.ok) {
      if (res.data?.error) setLastEvent(`send note: ${res.data.error}`);
    } else if (!res?.ok) {
      setStreaming(false);
      setLastEvent(`send failed: ${res?.error ?? 'unknown'}`);
      setLastError(res?.error ?? 'Send failed');
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
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {messages.map((m) => (
          <div key={m.id}>
            <div
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: 10,
                background:
                  m.role === 'user' ? 'var(--accent)' : 'var(--bg-elevated)',
                color:
                  m.role === 'user'
                    ? 'var(--accent-foreground, #fff)'
                    : 'var(--text)',
                border: '1px solid var(--border)',
                fontSize: 13,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.blocks && m.blocks.length > 0 ? (
                <RenderBlocks blocks={m.blocks} />
              ) : (
                m.content
              )}
            </div>
            {m.role === 'assistant' && m.timing && (
              <LatencyBreakdown timing={m.timing} />
            )}
          </div>
        ))}
        {streaming && (
          <div>
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
              {streamingBlocks.length > 0 ? (
                <RenderBlocks blocks={streamingBlocks} />
              ) : (
                <span style={{ opacity: 0.5 }}>▍</span>
              )}
            </div>
            {streamingTiming && <LatencyBreakdown timing={streamingTiming} />}
          </div>
        )}
      </div>

      <StreamingIndicator
        wsStatus={wsStatus}
        isStreaming={streaming}
        lastEvent={lastEvent}
      />

      {localSuggestion && (
        <div
          style={{
            margin: '0 10px',
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            fontSize: 12,
            opacity: 0.85,
          }}
        >
          {localSuggestion}
        </div>
      )}

      {lastError && (
        <div
          style={{
            margin: '0 10px',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid #ef4444',
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>{lastError}</span>
          <button
            type="button"
            onClick={retryLast}
            disabled={retrying}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 4,
              border: '1px solid #ef4444',
              background: retrying ? 'transparent' : '#ef4444',
              color: retrying ? '#ef4444' : '#fff',
              cursor: retrying ? 'not-allowed' : 'pointer',
            }}
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 10,
          borderTop: '1px solid var(--border)',
        }}
      >
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
            color: draft.trim()
              ? 'var(--accent-foreground, #fff)'
              : 'var(--text-muted)',
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
