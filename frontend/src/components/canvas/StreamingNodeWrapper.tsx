'use client';

/**
 * components/canvas/StreamingNodeWrapper.tsx
 * --------------------------------------------------------------------
 * Wrapper that integrates useStreamSlot for canvas nodes with streaming capability.
 * Renders real-time streaming events as they arrive from /api/canvas/node/stream.
 */

import { useCallback, useMemo } from 'react';
import { useStreamSlot, type UseStreamSlotOptions, type UseStreamSlotResult } from './use-stream-slot';
import { Icon, type IconName } from './Icon';
import { ObservabilityHUD } from './ObservabilityHUD';

interface StreamingNodeWrapperProps {
  nodeId: string;
  capabilityId: string;
  /** Whether streaming should auto-start on mount. */
  autoStart?: boolean;
  /** Input to pass to the streaming endpoint. */
  input?: Record<string, unknown>;
  /** Title for the streaming node. */
  title?: string;
  /** Called when streaming completes. */
  onComplete?: (accumulatedText: string, tokensIn: number, tokensOut: number, costUsd: number) => void;
  /** Called when streaming errors. */
  onError?: (error: string) => void;
  /** Minimum height for the stream content area. */
  minHeight?: number;
}

const STREAM_KIND_ICONS: Record<string, IconName> = {
  thinking: 'cpu',
  text: 'chat',
  code: 'code',
  tool_use: 'settings',
  tool_result: 'terminal',
  image: 'image',
  citation: 'bookmark',
  error: 'alert',
  meta: 'info',
  progress: 'refresh',
  status: 'activity',
  complete: 'check',
  cost: 'tag',
  heartbeat: 'pulse',
};

const STREAM_KIND_COLORS: Record<string, string> = {
  thinking: '#8b5cf6',
  text: '#3b82f6',
  code: '#10b981',
  tool_use: '#f59e0b',
  tool_result: '#06b6d4',
  image: '#ec4899',
  citation: '#6366f1',
  error: '#ef4444',
  meta: '#64748b',
  progress: '#0ea5e9',
  status: '#22c55e',
  complete: '#22c55e',
  cost: '#f97316',
  heartbeat: '#ec4899',
};

export function StreamingNodeWrapper({
  nodeId,
  capabilityId,
  autoStart = true,
  input,
  title,
  onComplete,
  onError,
  minHeight = 200,
}: StreamingNodeWrapperProps) {
  const stream = useStreamSlot({
    nodeId,
    capabilityId,
    input,
    autoStart,
    autoReconnect: true,
  });

  const { state, events, accumulatedText, indicator, start, pause, resume, stop, session } = stream;
  const { tokensIn, tokensOut, costUsd, traceId, completedAt } = session ?? {};

  // Trigger callbacks on state changes
  if (state === 'complete' && completedAt) {
    // Only fire once - we could use a ref to track if already fired
    onComplete?.(accumulatedText, tokensIn ?? 0, tokensOut ?? 0, costUsd ?? 0);
  }

  if (state === 'error') {
    const lastError = events.find((e) => e.kind === 'error')?.message;
    onError?.(lastError ?? 'Stream error');
  }

  const handleStart = useCallback(() => {
    start();
  }, [start]);

  const handlePause = useCallback(() => {
    pause();
  }, [pause]);

  const handleResume = useCallback(() => {
    resume();
  }, [resume]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  // Render accumulated content as markdown-like text
  const content = useMemo(() => {
    if (!accumulatedText.trim()) return null;
    return (
      <div
        style={{
          padding: 12,
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--foreground)',
          fontFamily: 'var(--font-sans)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {accumulatedText}
      </div>
    );
  }, [accumulatedText]);

  // Render individual events for detailed view
  const eventLog = useMemo(() => {
    if (events.length === 0) return null;
    return (
      <div style={{ padding: 8, maxHeight: 120, overflowY: 'auto', borderTop: '1px solid var(--border)' }} className="scrollbar-thin">
        {events.map((evt, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 6px',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: STREAM_KIND_COLORS[evt.kind] ?? 'var(--muted-foreground)',
            }}
          >
            <Icon name={STREAM_KIND_ICONS[evt.kind] ?? 'circle'} size={10} style={{ color: STREAM_KIND_COLORS[evt.kind] ?? 'var(--muted-foreground)' }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {evt.kind}: {evt.content?.slice(0, 60) ?? evt.status ?? ''}
            </span>
            <span style={{ opacity: 0.5, fontSize: 9 }}>
              {new Date(evt.timestamp).toLocaleTimeString().slice(0, 8)}
            </span>
          </div>
        ))}
      </div>
    );
  }, [events]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight }}>
      {/* Streaming content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight }} className="scrollbar-thin">
        {content}
        {eventLog}
      </div>

      {/* Stream controls + indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderTop: '1px solid var(--border)',
          background: 'var(--secondary)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: indicator.color,
              boxShadow: `0 0 8px ${indicator.color}`,
              animation: indicator.icon === 'pulse' ? 'pulse 1.5s infinite' : undefined,
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', textTransform: 'capitalize' }}>
            {indicator.label}
          </span>
          {traceId && (
            <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', marginLeft: 8 }}>
              {traceId.slice(0, 12)}
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Controls */}
        <div style={{ display: 'flex', gap: 4 }}>
          {state === 'idle' && (
            <button onClick={handleStart} style={{ padding: '3px 8px', fontSize: 10, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--background)', borderRadius: 4, fontFamily: 'inherit' }}>
              Start
            </button>
          )}
          {state === 'streaming' || state === 'thinking' ? (
            <button onClick={handlePause} style={{ padding: '3px 8px', fontSize: 10, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--background)', borderRadius: 4, fontFamily: 'inherit' }}>
              Pause
            </button>
          ) : state === 'paused' ? (
            <button onClick={handleResume} style={{ padding: '3px 8px', fontSize: 10, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--background)', borderRadius: 4, fontFamily: 'inherit' }}>
              Resume
            </button>
          ) : null}
          {state !== 'idle' && (
            <button onClick={handleStop} style={{ padding: '3px 8px', fontSize: 10, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--background)', borderRadius: 4, fontFamily: 'inherit', color: 'var(--destructive)' }}>
              Stop
            </button>
          )}
        </div>

        {/* Token/cost summary */}
        {((tokensIn ?? 0) > 0 || (tokensOut ?? 0) > 0) && (
          <div style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>↑ {tokensIn ?? 0}</span>
            <span>↓ {tokensOut ?? 0}</span>
            {(costUsd ?? 0) > 0 && <span>${(costUsd ?? 0).toFixed(4)}</span>}
          </div>
        )}
      </div>

      {/* Observability HUD */}
      <ObservabilityHUD
        streamState={state}
        tokensIn={tokensIn ?? 0}
        tokensOut={tokensOut ?? 0}
        costUsd={costUsd ?? 0}
        latencyMs={state === 'streaming' ? Date.now() - (stream as any).startedAt : 0}
        traceId={traceId}
      />
    </div>
  );
}