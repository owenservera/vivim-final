// src/observability/context.ts
// AsyncLocalStorage-bound trace context for end-to-end CDP command tracing.
// Phase 1: Every browser action is traceable from conversation → governor → CDP → Chrome.

import { AsyncLocalStorage } from 'node:async_hooks'

export interface TraceContext {
  traceId: string
  spanId: string
  parentSpanId?: string
  slaveId?: string
  conversationId?: string
  operation?: string
}

export const traceCtx = new AsyncLocalStorage<TraceContext>()

/**
 * Generate a random trace ID (hex string).
 */
export function generateTraceId(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

/**
 * Generate a random span ID (hex string).
 */
export function generateSpanId(): string {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

/**
 * Execute a function within a trace context. If no context is provided,
 * a new trace is created. If a context exists, a child span is created.
 */
export async function withSpan<T>(
  name: string,
  attrs: Partial<TraceContext>,
  fn: () => Promise<T>,
): Promise<T> {
  const parent = traceCtx.getStore()
  const context: TraceContext = {
    traceId: parent?.traceId ?? generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parent?.spanId,
    slaveId: attrs.slaveId ?? parent?.slaveId,
    conversationId: attrs.conversationId ?? parent?.conversationId,
    operation: name,
  }

  return traceCtx.run(context, fn)
}

/**
 * Get the current trace context (returns undefined if not in a span).
 */
export function getCurrentContext(): TraceContext | undefined {
  return traceCtx.getStore()
}

/**
 * Create a child context from the current one.
 */
export function childContext(attrs: Partial<TraceContext>): TraceContext {
  const parent = traceCtx.getStore()
  return {
    traceId: parent?.traceId ?? generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: parent?.spanId,
    slaveId: attrs.slaveId ?? parent?.slaveId,
    conversationId: attrs.conversationId ?? parent?.conversationId,
    operation: attrs.operation,
  }
}
