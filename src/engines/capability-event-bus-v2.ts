// src/engines/capability-event-bus-v2.ts
// CapabilityEventBusV2 — production-grade in-process pub/sub.
// Fixes: error isolation, event envelopes, wildcards, ring buffer, DLQ, publishAndWait.
// Parallel implementation; v1 remains for backward compatibility.

import { EngineError } from '../errors.js'
import { ulid } from '../ids.js'
import { getLogger } from '../lib/logger.js'

const log = getLogger('capability-event-bus-v2')

// ── Event Envelope ──────────────────────────────────────────────────────────

export interface EventEnvelope<T = unknown> {
  event: T
  metadata: {
    eventId: string
    timestamp: number
    source: string
    correlationId?: string
    causationId?: string
  }
}

// ── Handler Types ───────────────────────────────────────────────────────────

export type AsyncEventHandler<T = unknown> = (event: EventEnvelope<T>) => void | Promise<void>

export interface HandlerEntry {
  id: string
  handler: AsyncEventHandler
  once: boolean
}

// ── DLQ Entry ───────────────────────────────────────────────────────────────

export interface DLQEntry {
  envelope: EventEnvelope
  error: Error
  attempts: number
  timestamp: number
}

// ── CapabilityEventBusV2 ─────────────────────────────────────────────────────

export class CapabilityEventBusV2 {
  private handlers = new Map<string, HandlerEntry[]>()
  private wildcardHandlers: HandlerEntry[] = []
  private ringBuffer: EventEnvelope[] = []
  private ringCapacity = 1000
  private ringHead = 0
  private ringCount = 0
  private dlq: DLQEntry[] = []
  private dlqMaxSize = 100

  // ── Publish (fire-and-forget) ──────────────────────────────────────────

  publish<T>(
    source: string,
    kind: string,
    event: T,
    opts?: {
      correlationId?: string
      causationId?: string
    },
  ): string {
    const eventId = ulid()
    const envelope: EventEnvelope<T> = {
      event,
      metadata: {
        eventId,
        timestamp: Date.now(),
        source,
        correlationId: opts?.correlationId,
        causationId: opts?.causationId,
      },
    }

    this.enqueue(envelope)
    this.dispatch(kind, envelope)
    return eventId
  }

  // ── Publish and Wait (awaitable) ───────────────────────────────────────

  async publishAndWait<T>(
    source: string,
    kind: string,
    event: T,
    opts?: {
      correlationId?: string
      causationId?: string
    },
  ): Promise<{ eventId: string; failures: Array<{ handlerId: string; error: Error }> }> {
    const eventId = ulid()
    const envelope: EventEnvelope<T> = {
      event,
      metadata: {
        eventId,
        timestamp: Date.now(),
        source,
        correlationId: opts?.correlationId,
        causationId: opts?.causationId,
      },
    }

    this.enqueue(envelope)
    const failures = await this.dispatchAndWait(kind, envelope)
    return { eventId, failures }
  }

  // ── Subscribe (persistent) ────────────────────────────────────────────

  on<T>(kind: string, handler: AsyncEventHandler<T>): () => void {
    const entry: HandlerEntry = {
      id: ulid(),
      handler: handler as AsyncEventHandler,
      once: false,
    }

    if (kind === '*') {
      this.wildcardHandlers.push(entry)
      return () => {
        this.wildcardHandlers = this.wildcardHandlers.filter((e) => e.id !== entry.id)
      }
    }

    let entries = this.handlers.get(kind)
    if (!entries) {
      entries = []
      this.handlers.set(kind, entries)
    }
    entries.push(entry)

    return () => {
      const list = this.handlers.get(kind)
      if (list) {
        const idx = list.findIndex((e) => e.id === entry.id)
        if (idx >= 0) list.splice(idx, 1)
      }
    }
  }

  // ── Subscribe (once) ──────────────────────────────────────────────────

  once<T>(kind: string, handler: AsyncEventHandler<T>): () => void {
    const entry: HandlerEntry = {
      id: ulid(),
      handler: handler as AsyncEventHandler,
      once: true,
    }

    let entries = this.handlers.get(kind)
    if (!entries) {
      entries = []
      this.handlers.set(kind, entries)
    }
    entries.push(entry)

    return () => {
      const list = this.handlers.get(kind)
      if (list) {
        const idx = list.findIndex((e) => e.id !== entry.id)
        if (idx >= 0) list.splice(idx, 1)
      }
    }
  }

  // ── Wildcard subscription ──────────────────────────────────────────────

  onAny(handler: AsyncEventHandler): () => void {
    return this.on('*', handler)
  }

  // ── Internal: dispatch with error isolation ────────────────────────────

  private dispatch(kind: string, envelope: EventEnvelope): void {
    const exactHandlers = [...(this.handlers.get(kind) ?? [])]
    const wildcardSnap = [...this.wildcardHandlers]
    const _onceHandlers = exactHandlers.filter((h) => h.once)
    const remaining = exactHandlers.filter((h) => !h.once)
    this.handlers.set(kind, remaining)

    for (const entry of [...exactHandlers, ...wildcardSnap]) {
      Promise.resolve()
        .then(() => entry.handler(envelope))
        .catch((err) => {
          log.error({ kind, handlerId: entry.id, err }, '[bus] handler failed')
          this.addToDLQ(envelope, err instanceof Error ? err : new EngineError(String(err)))
        })
    }
  }

  private async dispatchAndWait(
    kind: string,
    envelope: EventEnvelope,
  ): Promise<Array<{ handlerId: string; error: Error }>> {
    const exactHandlers = [...(this.handlers.get(kind) ?? [])]
    const wildcardSnap = [...this.wildcardHandlers]
    const all = [...exactHandlers, ...wildcardSnap]

    const _onceHandlers = exactHandlers.filter((h) => h.once)
    const remaining = exactHandlers.filter((h) => !h.once)
    this.handlers.set(kind, remaining)

    const failures: Array<{ handlerId: string; error: Error }> = []

    await Promise.allSettled(
      all.map((entry) =>
        Promise.resolve()
          .then(() => entry.handler(envelope))
          .catch((err) => {
            const error = err instanceof Error ? err : new EngineError(String(err))
            failures.push({ handlerId: entry.id, error })
            this.addToDLQ(envelope, error)
          }),
      ),
    )

    return failures
  }

  // ── Internal: ring buffer (O(1) circular) ─────────────────────────────

  private enqueue(envelope: EventEnvelope): void {
    if (this.ringCount === this.ringCapacity) {
      this.ringHead = (this.ringHead + 1) % this.ringCapacity
    } else {
      this.ringCount++
    }
    this.ringBuffer[(this.ringHead + this.ringCount - 1) % this.ringCapacity] = envelope
  }

  // ── Internal: DLQ ─────────────────────────────────────────────────────────

  private addToDLQ(envelope: EventEnvelope, error: Error): void {
    if (this.dlq.length >= this.dlqMaxSize) {
      this.dlq.shift()
    }
    this.dlq.push({
      envelope,
      error,
      attempts: 1,
      timestamp: Date.now(),
    })
  }

  getDLQ(): DLQEntry[] {
    return [...this.dlq]
  }

  clearDLQ(): void {
    this.dlq = []
  }

  // ── Snapshot (ring buffer contents) ───────────────────────────────────────

  snapshot(): EventEnvelope[] {
    const result: EventEnvelope[] = []
    for (let i = 0; i < this.ringCount; i++) {
      const idx = (this.ringHead + i) % this.ringCapacity
      if (this.ringBuffer[idx]) result.push(this.ringBuffer[idx])
    }
    return result
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  removeAllListeners(kind?: string): void {
    if (kind) {
      this.handlers.delete(kind)
    } else {
      this.handlers.clear()
      this.wildcardHandlers = []
    }
  }
}
