'use client';

/**
 * components/canvas/ObservabilityHUD.tsx (V6 #10)
 * --------------------------------------------------------------------
 * Per-node cost/latency HUD. Shows in the node header:
 *   - Stream state indicator (pulsing dot)
 *   - Token count (in/out)
 *   - Cost in USD
 *   - Latency in ms
 *   - Trace id (truncated)
 *
 * Subtle, non-intrusive. Colors: green (cheap/fast), amber, red.
 */

import type { StreamState } from '../../shared/streaming';
import { STREAM_STATE_INDICATOR } from '../../shared/streaming';
import { formatCost, formatTokens, formatLatency, COST_COLOR, LATENCY_COLOR } from '../../shared/observability';

export interface ObservabilityHUDProps {
  streamState: StreamState;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  traceId?: string;
  /** Compact mode (for small nodes). */
  compact?: boolean;
}

export function ObservabilityHUD({
  streamState,
  tokensIn,
  tokensOut,
  costUsd,
  latencyMs,
  traceId,
  compact = false,
}: ObservabilityHUDProps) {
  const indicator = STREAM_STATE_INDICATOR[streamState];
  const isStreaming = streamState === 'streaming' || streamState === 'thinking' || streamState === 'connecting';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 4 : 8,
        fontSize: 9,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        color: 'var(--text-subtle)',
      }}
    >
      {/* Stream state indicator */}
      <span
        style={{
          color: indicator.color,
          fontWeight: 700,
          animation: isStreaming ? 'pulse 1.5s ease-in-out infinite' : 'none',
          fontSize: 11,
        }}
      >
        {indicator.icon}
      </span>

      {!compact && (
        <>
          {/* Token count */}
          {tokensOut > 0 && (
            <span title={`${tokensIn} in / ${tokensOut} out tokens`}>
              <span style={{ color: formatTokens(tokensOut) === '0' ? 'var(--text-subtle)' : 'var(--text-muted)' }}>
                ↑{formatTokens(tokensIn)} ↓{formatTokens(tokensOut)}
              </span>
            </span>
          )}

          {/* Cost */}
          {costUsd > 0 && (
            <span
              style={{ color: COST_COLOR(costUsd), fontWeight: 600 }}
              title={`Cost: $${costUsd.toFixed(6)}`}
            >
              {formatCost(costUsd)}
            </span>
          )}

          {/* Latency */}
          {latencyMs > 0 && (
            <span style={{ color: LATENCY_COLOR(latencyMs) }} title={`Latency: ${latencyMs}ms`}>
              {formatLatency(latencyMs)}
            </span>
          )}

          {/* Trace id */}
          {traceId && (
            <span
              style={{ color: 'var(--text-subtle)', cursor: 'pointer' }}
              title={`Trace: ${traceId}`}
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard?.writeText(traceId);
              }}
            >
              {traceId.slice(0, 8)}…
            </span>
          )}
        </>
      )}

      {compact && (tokensOut > 0 || costUsd > 0) && (
        <span style={{ color: COST_COLOR(costUsd) }}>
          {formatTokens(tokensOut)} · {formatCost(costUsd)}
        </span>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
