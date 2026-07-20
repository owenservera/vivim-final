import { EngineError } from '../../errors.js'
import { ulid } from '../../ids.js'
import { getLogger } from '../../lib/logger.js'
import type { KernelStore, TraceSpan } from '../../storage/contracts/kernel-store.js'

const log = getLogger('kernel:tracer')

export class KernelTracer {
  private ringBuffer: TraceSpan[] = []
  private ringCapacity: number
  private activeSpans = new Map<string, TraceSpan>()
  private store: KernelStore | null = null
  private persistThreshold: number

  constructor(opts?: {
    ringCapacity?: number
    persistThreshold?: number
    store?: KernelStore
  }) {
    this.ringCapacity = opts?.ringCapacity ?? 500
    this.persistThreshold = opts?.persistThreshold ?? 450
    this.store = opts?.store ?? null
  }

  newTraceId(): string {
    return ulid()
  }

  async span<T>(
    name: string,
    parent: string | null,
    fn: () => Promise<T>,
    attrs?: Record<string, unknown>,
  ): Promise<T> {
    const spanId = this.start(name, parent, attrs)
    try {
      const result = await fn()
      await this.end(spanId)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new EngineError(String(err))
      await this.error(spanId, error)
      throw err
    }
  }

  start(name: string, parent: string | null, attrs?: Record<string, unknown>): string {
    const id = ulid()
    const traceId = parent ? this.getTraceIdFromParent(parent) : ulid()
    const span: TraceSpan = {
      id,
      traceId,
      parentId: parent,
      name,
      startTime: Date.now(),
      status: 'ok',
      attrs: attrs ?? {},
    }
    this.ringBuffer.push(span)
    this.activeSpans.set(id, span)
    this.checkOverflow()
    return id
  }

  async end(spanId: string, extra?: Record<string, unknown>): Promise<void> {
    const span = this.activeSpans.get(spanId) ?? this.ringBuffer.find((s) => s.id === spanId)
    if (!span) return
    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime
    if (extra) span.attrs = { ...span.attrs, ...extra }
    this.activeSpans.delete(spanId)
  }

  async error(spanId: string, error: Error): Promise<void> {
    const span = this.activeSpans.get(spanId) ?? this.ringBuffer.find((s) => s.id === spanId)
    if (!span) return
    span.endTime = Date.now()
    span.duration = span.endTime - span.startTime
    span.status = 'error'
    span.error = error.message
    this.activeSpans.delete(spanId)
  }

  getTrace(traceId: string): TraceSpan[] {
    return this.ringBuffer.filter((s) => s.traceId === traceId)
  }

  getRecentSpans(limit = 20): TraceSpan[] {
    return this.ringBuffer.slice(-limit)
  }

  getSpansByEngine(engineId: string, limit = 20): TraceSpan[] {
    return this.ringBuffer.filter((s) => s.engineId === engineId).slice(-limit)
  }

  getActiveSpans(): TraceSpan[] {
    return [...this.activeSpans.values()]
  }

  private getTraceIdFromParent(spanId: string): string {
    const parent = this.ringBuffer.find((s) => s.id === spanId)
    return parent?.traceId ?? ulid()
  }

  private checkOverflow(): void {
    if (this.ringBuffer.length >= this.persistThreshold && this.store) {
      const batch = this.ringBuffer.splice(0, this.ringBuffer.length - this.ringCapacity)
      this.store
        .batchInsertSpans(
          batch.map((s) => ({
            traceId: s.traceId,
            parentId: s.parentId,
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            duration: s.duration,
            status: s.status,
            error: s.error,
            attrs: s.attrs,
            engineId: s.engineId,
          })),
        )
        .catch((err) => log.error({ err }, '[tracer] persist batch failed'))
    }
  }
}
