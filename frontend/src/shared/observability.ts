/**
 * shared/observability.ts
 * --------------------------------------------------------------------
 * V6 #10 — Observability & Trust.
 *
 * Per-node cost/latency HUD + trace waterfall (visual flame graph).
 */

export interface NodeObservability {
  nodeId: string;
  /** Total tokens in/out for this node's last execution. */
  tokensIn: number;
  tokensOut: number;
  /** Cost in USD. */
  costUsd: number;
  /** Latency in ms (last execution). */
  latencyMs: number;
  /** Provider used. */
  providerId?: string;
  /** Capability executed. */
  capabilityId?: string;
  /** Trace id. */
  traceId?: string;
  /** Number of stream events. */
  eventCount: number;
  /** Last updated. */
  updatedAt: number;
}

export interface TraceSpan {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  engine: string;
  startedAt: number;
  durationMs: number;
  ok: boolean;
  /** Depth in the span tree (for flame graph layout). */
  depth: number;
  /** Children spans. */
  children: TraceSpan[];
  /** Cost attribution. */
  costUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
}

export interface TraceWaterfall {
  traceId: string;
  rootSpan: TraceSpan;
  /** Total duration (root span). */
  totalDurationMs: number;
  /** Total cost. */
  totalCostUsd: number;
  /** Total tokens. */
  totalTokensIn: number;
  totalTokensOut: number;
  /** All spans flattened (for rendering). */
  allSpans: Array<{ span: TraceSpan; x: number; width: number; color: string }>;
}

export const COST_COLOR = (costUsd: number): string => {
  if (costUsd === 0) return '#9ca3af';
  if (costUsd < 0.001) return '#10b981';
  if (costUsd < 0.01) return '#f59e0b';
  return '#ef4444';
};

export const LATENCY_COLOR = (ms: number): string => {
  if (ms < 100) return '#10b981';
  if (ms < 500) return '#f59e0b';
  return '#ef4444';
};

/** Format cost for the HUD. */
export function formatCost(usd: number): string {
  if (usd === 0) return '—';
  if (usd < 0.001) return `$${usd.toFixed(5)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

/** Format tokens for the HUD. */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Format latency for the HUD. */
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
