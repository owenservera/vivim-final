'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIO } from '@/sdk/web';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import { StreamingIndicator } from '@/components/canvas/StreamingIndicator';
import { EmptyState } from './EmptyState';
import { RenderBlocks, type ContentBlock } from './MessageBlock';
import { LatencyBreakdown, type TimingInfo } from './LatencyBreakdown';
import { ComposerShell, defaultChatScope } from './ComposerShell';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { TypingIndicator } from './TypingIndicator';
import { Copy, RefreshCw, Pencil } from 'lucide-react';
import { useConversation } from '@/sdk/web/use-conversation';
import { useToast } from '@/hooks/useToast';
import { Toast } from '@/components/canvas/Toast';

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
  onRetryMessage?: (text: string) => void;
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = escapeRegex(query);
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: 'var(--color-warning)', color: 'black', borderRadius: 2, padding: '0 2px' }}>{part}</mark>
      : part
  );
}

export function Composer({ conversationId, wsStatus, wsMessage, onRetryMessage }: ComposerProps) {
  const io = useIO();
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

  const { create: createConversationLocal } = useConversation();
  const { copied, copy: copyToClipboard } = useCopyToClipboard();
  const { toast, showToast } = useToast();
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const conversationIdRef = useRef(conversationId);
  useEffect(() => { conversationIdRef.current = conversationId; });

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
    try {
      const res = await io.get<{ messages?: Message[] }>(`/api/conversations/${encodeURIComponent(id)}/messages`);
      if (res.data?.messages) setMessages(res.data.messages);
    } catch {
      // network error — keep current state
    }
  }, [io]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const handleRetry = useCallback((text: string) => {
    onRetryMessage?.(text);
  }, [onRetryMessage]);

  const handleCopy = useCallback(async (text: string) => {
    await copyToClipboard(text);
    showToast('ok', 'Copied!');
  }, [copyToClipboard, showToast]);

  const getMessageText = useCallback((m: Message): string => {
    return [
      m.content,
      ...(m.blocks?.map(b => b.content) ?? []),
    ].join(' ');
  }, []);

  const filteredMessages = searchOpen && searchQuery.trim()
    ? messages.filter(m => getMessageText(m).toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const roleBadge = (role: string) => {
    switch (role) {
      case 'user':
        return <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>U</span>;
      case 'assistant':
        return <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AI</span>;
      case 'system':
        return <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>S</span>;
      default:
        return null;
    }
  };

  if (!conversationId) {
    return <EmptyState onCreateConversation={createConversationLocal} />;
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
        {toast && <Toast kind={toast.kind} message={toast.msg} autoDismiss={1500} />}
        {/* Search overlay */}
        {searchOpen && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
            }}
          >
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              style={{
                flex: 1,
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 8px',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 12,
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filteredMessages.length}/{messages.length}
            </span>
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 2 }}
            >
              ×
            </button>
          </div>
        )}

        {filteredMessages.map((m, i) => {
          const prev = i > 0 ? filteredMessages[i - 1] : null;
          const sameRole = prev?.role === m.role;
          const isHovered = hoveredMessageId === m.id;

          return (
            <div
              key={m.id}
              onMouseEnter={() => setHoveredMessageId(m.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
              style={{
                position: 'relative',
                marginTop: sameRole ? 2 : 8,
                transition: 'margin-top 0.2s ease',
              }}
            >
              {/* Role badge */}
              <div
                style={{
                  position: 'absolute',
                  top: -4,
                  left: m.role === 'user' ? 'auto' : 4,
                  right: m.role === 'user' ? 4 : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                {roleBadge(m.role)}
              </div>

              {/* Hover action bar */}
              {isHovered && (
                <div
                  style={{
                    position: 'absolute',
                    top: -22,
                    right: 4,
                    display: 'flex',
                    gap: 2,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '2px',
                    zIndex: 10,
                  }}
                >
                  <button
                    onClick={() => handleCopy(m.content)}
                    title="Copy"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={() => handleRetry(m.content)}
                    title="Retry"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <RefreshCw size={12} />
                  </button>
                  <button
                    title="Edit (coming soon)"
                    disabled
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'not-allowed',
                      padding: '2px 4px',
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.5,
                    }}
                  >
                    <Pencil size={12} />
                  </button>
                </div>
              )}

              <div
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
                {m.blocks && m.blocks.length > 0 ? (
                  <RenderBlocks blocks={m.blocks} />
                ) : (
                  searchOpen && searchQuery.trim()
                    ? highlightText(m.content, searchQuery)
                    : m.content
                )}
              </div>
              {m.role === 'assistant' && m.timing && (
                <LatencyBreakdown timing={m.timing} />
              )}
            </div>
          );
        })}

        {streaming && (
          <div>
            {streamingBlocks.length === 0 && <TypingIndicator delay={500} />}
            <div
              className={streamingBlocks.length > 0 ? 'streaming-reveal' : ''}
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
                <span className="streaming-cursor" />
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
