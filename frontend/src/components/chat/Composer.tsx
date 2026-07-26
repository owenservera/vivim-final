'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMessages } from '@/sdk/backend-client';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import { StreamingIndicator } from '@/components/canvas/StreamingIndicator';
import { EmptyState } from './EmptyState';
import { RenderBlocks, type ContentBlock } from './MessageBlock';
import { LatencyBreakdown, type TimingInfo } from './LatencyBreakdown';
import { ComposerShell, defaultChatScope } from './ComposerShell';

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
  const [streaming, setStreaming] = useState(false);
  const [streamingBlocks, setStreamingBlocks] = useState<ContentBlock[]>([]);
  const [streamingTiming, setStreamingTiming] = useState<TimingInfo | null>(null);
  const [lastEvent, setLastEvent] = useState<string | undefined>();
  const [optimisticText, setOptimisticText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pendingBlocksRef = useRef<PendingBlock[]>([]);
  const pendingTimingRef = useRef<TimingInfo | null>(null);
  const rafRef = useRef<number | null>(null);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

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
    setLastEvent(undefined);
    setOptimisticText(null);
    pendingBlocksRef.current.splice(0);
    pendingTimingRef.current = null;
    if (conversationId) loadHistory(conversationId);
  }, [conversationId, loadHistory]);

  useEffect(() => {
    const msg = wsMessage;
    const activeId = conversationIdRef.current;
    if (!msg || !activeId) return;
    if (msg.type === 'conversation:block') {
      const payload = msg.payload as {
        conversationId?: string;
        block?: { type?: string; kind?: string; text?: string; content?: string };
        timing?: TimingInfo;
      };
      if (payload?.conversationId !== activeId) return;
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
      if (payload?.conversationId !== activeId) return;
      setStreaming(false);
      setLastEvent('complete');
      setStreamingBlocks([]);
      setStreamingTiming(null);
      pendingTimingRef.current = null;
      pendingBlocksRef.current.splice(0);
      loadHistory(activeId);
    } else if (msg.type === 'conversation:error') {
      const payload = msg.payload as { conversationId?: string; error?: string };
      if (payload?.conversationId !== activeId) return;
      setStreaming(false);
      setLastEvent(`error: ${payload.error ?? 'unknown'}`);
    }
    // scheduleFlush is intentionally excluded to avoid re-running on every render
  }, [wsMessage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingBlocks]);

  // Called when ComposerShell completes a send
  const handleShellResult = useCallback((ok: boolean, error?: string) => {
    if (!ok) {
      setLastEvent(`send failed: ${error ?? 'unknown'}`);
    }
  }, []);

  // Called when ComposerShell streaming state changes
  const handleStreamingChange = useCallback((val: boolean) => {
    setStreaming(val);
    if (val) {
      setOptimisticText(null);
    }
  }, []);

  if (!conversationId) {
    return <EmptyState />;
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

      <ComposerShell
        scope={defaultChatScope()}
        conversationId={conversationId}
        providerId={null}
        onSendResult={handleShellResult}
        onStreamingChange={handleStreamingChange}
      />
    </div>
  );
}
