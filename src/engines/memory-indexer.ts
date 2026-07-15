// src/engines/memory-indexer.ts
// Unit 33.1 — Continuous Indexing Pipeline.
// Subscribes to conversation/message write events on the CapabilityEventBus,
// debounces them into batches, embeds new content through an EmbeddingProvider,
// and upserts the vectors into the memory graph (memory_embedding). A resumable
// cursor ensures restarts don't re-index, and idempotent upserts prevent fan-out.

import { createHash } from 'node:crypto'
import type { SemanticSearchStore } from '../storage/contracts/semantic-search-store.js'
import type { CapabilityEventBus, EngineEvent } from './capability-event-bus.js'
import type { EmbeddingProvider } from './semantic-search.js'

export interface IndexCursorStore {
  get(): string | null
  set(cursor: string): void
}

export class InMemoryCursorStore implements IndexCursorStore {
  private value: string | null = null
  get(): string | null {
    return this.value
  }
  set(cursor: string): void {
    this.value = cursor
  }
}

interface IndexJob {
  id: string
  content: string
}

export interface MemoryIndexerOptions {
  bus: CapabilityEventBus
  embeddings: EmbeddingProvider
  store: SemanticSearchStore
  // Event type that carries a freshly-written message. Defaults to the
  // conversation-complete event emitted by ConversationManager.
  eventType?: string
  // Debounce window before a batch is flushed (ms).
  debounceMs?: number
  // Max embeddings computed in parallel.
  concurrency?: number
  // Persisted resume cursor (last-indexed message id).
  cursor?: IndexCursorStore
  // Extracts { id, content } from an event payload. Overridable for tests.
  extract?: (event: EngineEvent) => IndexJob | null
  // Optional hook to feed each indexed chunk into a downstream consumer (e.g.
  // KnowledgeExtractor.extractIncremental) — wires 33.2 into the pipeline.
  onIndex?: (job: IndexJob) => Promise<void>
}

function defaultExtract(event: EngineEvent): IndexJob | null {
  const any = event as unknown as { message?: { id?: string; content?: string } }
  const msg = any.message
  if (msg && typeof msg.id === 'string' && typeof msg.content === 'string') {
    return { id: msg.id, content: msg.content }
  }
  return null
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

export class MemoryIndexer {
  private readonly eventType: string
  private readonly debounceMs: number
  private readonly concurrency: number
  private readonly extract: (event: EngineEvent) => IndexJob | null
  private readonly cursor: IndexCursorStore

  private queue: IndexJob[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private cursorValue: string | null
  private stopped = false
  private unsub: (() => void) | null = null

  constructor(private readonly opts: MemoryIndexerOptions) {
    this.eventType = opts.eventType ?? 'conversation:complete'
    this.debounceMs = opts.debounceMs ?? 50
    this.concurrency = opts.concurrency ?? 2
    this.extract = opts.extract ?? defaultExtract
    this.cursor = opts.cursor ?? new InMemoryCursorStore()
    this.cursorValue = this.cursor.get()
  }

  start(): void {
    this.stopped = false
    this.unsub = this.opts.bus.on(this.eventType, (event) => this.onEvent(event))
  }

  stop(): void {
    this.stopped = true
    this.unsub?.()
    this.unsub = null
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  getCursor(): string | null {
    return this.cursorValue
  }

  private onEvent(event: EngineEvent): void {
    if (this.stopped) return
    const job = this.extract(event)
    if (!job) return
    // Resume guard: never re-index content at or before the cursor.
    if (this.cursorValue && job.id <= this.cursorValue) return
    this.queue.push(job)
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.timer || this.stopped) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, this.debounceMs)
  }

  /** Flush queued jobs, respecting the concurrency cap. Safe to call manually. */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return
    const batch = this.queue.splice(0, this.queue.length)

    for (let i = 0; i < batch.length; i += this.concurrency) {
      const slice = batch.slice(i, i + this.concurrency)
      await Promise.all(slice.map((job) => this.indexOne(job)))
    }

    // Advance the cursor to the highest message id seen in this batch.
    let max = this.cursorValue
    for (const job of batch) {
      if (max === null || job.id > max) max = job.id
    }
    this.cursorValue = max
    if (max !== null) this.cursor.set(max)
  }

  private async indexOne(job: IndexJob): Promise<void> {
    const contentHash = hashContent(job.content)
    const entityType = 'message'
    const entityId = job.id
    // Deterministic id → upsert is idempotent (no fan-out on restart/re-emit).
    const id = `emb_${entityType}_${entityId}`
    const vec = await this.opts.embeddings.embed(job.content)
    await this.opts.store.upsertEmbedding({
      id,
      entityType,
      entityId,
      embedding: JSON.stringify(vec),
      model: this.opts.embeddings.name,
      dimensions: vec.length,
      contentHash,
      createdAt: Date.now(),
    })
    if (this.opts.onIndex) {
      await this.opts.onIndex(job)
    }
  }
}
