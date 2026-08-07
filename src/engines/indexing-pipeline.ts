// src/engines/indexing-pipeline.ts
// IndexingPipeline — automatic indexing of messages and facts with debouncing.
// Enqueues content for embedding and flushes in batches to avoid flooding the embedder.

import { catchDebug } from '../lib/catch-logger.js'
import type { SemanticSearchEngine } from './semantic-search.js'

interface IndexJob {
  text: string
  type: string
  id: string
  hash: string
}

function hashContent(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return hash.toString(36)
}

export class IndexingPipeline {
  private queue: IndexJob[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private seenHashes = new Map<string, string>()

  constructor(
    private semantic: SemanticSearchEngine,
    private debounceMs = 500,
  ) {}

  /**
   * Enqueue content for indexing. Called from recordEpisode / assertFact.
   * Skips reindex if content hash hasn't changed.
   */
  enqueue(text: string, type: string, id: string): void {
    const hash = hashContent(text)
    if (this.seenHashes.get(id) === hash) return // no content change -> skip reindex
    this.seenHashes.set(id, hash)
    this.queue.push({ text, type, id, hash })
    this.schedule()
  }

  private schedule(): void {
    if (this.timer) return
    this.timer = setTimeout(() => void this.flush(), this.debounceMs)
  }

  private async flush(): Promise<void> {
    this.timer = null
    const batch = this.queue.splice(0)
    if (batch.length === 0) return

    try {
      await this.semantic.indexBatch(
        batch.map((b) => ({
          text: b.text,
          entityType: b.type,
          entityId: b.id,
        })),
      )
    } catch {
      catchDebug(_err, 'engines:indexing-pipeline:63')
      // Log error but don't crash — indexing is best-effort
    }
  }

  /**
   * Force flush any pending items (for testing or shutdown).
   */
  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.flush()
  }

  /**
   * Get queue size for monitoring.
   */
  get pendingCount(): number {
    return this.queue.length
  }
}
