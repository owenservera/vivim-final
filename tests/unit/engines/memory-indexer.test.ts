import { beforeEach, describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { InMemoryCursorStore, MemoryIndexer } from '../../../src/engines/memory-indexer.js'
import type { EmbeddingProvider } from '../../../src/engines/semantic-search.js'
import type { SemanticSearchStore } from '../../../src/storage/contracts/semantic-search-store.js'

function makeEmbeddings(): EmbeddingProvider {
  return {
    name: 'test-embed',
    dimensions: 4,
    embed: async (text: string) => Array.from({ length: 4 }, (_, i) => text.length + i),
    embedBatch: async (texts: string[]) =>
      texts.map((t) => Array.from({ length: 4 }, (_, i) => t.length + i)),
  }
}

function makeStore() {
  const embeddings: Array<{ entityType: string; entityId: string; contentHash: string }> = []
  const store: SemanticSearchStore = {
    async upsertEmbedding(input) {
      embeddings.push({
        entityType: input.entityType,
        entityId: input.entityId,
        contentHash: input.contentHash,
      })
    },
    async getEmbedding() {
      return null
    },
    async searchByEmbedding() {
      return []
    },
    async deleteEmbedding() {},
    async countEmbeddings() {
      return embeddings.length
    },
  }
  return { store, embeddings }
}

function msgEvent(id: string, content: string) {
  return { type: 'conversation:complete', conversationId: 'c1', message: { id, content } } as never
}

describe('MemoryIndexer (Unit 33.1)', () => {
  let bus: CapabilityEventBus
  beforeEach(() => {
    CapabilityEventBus.resetInstance()
    bus = CapabilityEventBus.getInstance()
  })

  it('indexes emitted messages into the memory graph within a bounded delay', async () => {
    const { store, embeddings } = makeStore()
    const indexer = new MemoryIndexer({ bus, embeddings: makeEmbeddings(), store })
    indexer.start()

    bus.emit(msgEvent('m1', 'hello world'))
    bus.emit(msgEvent('m2', 'foo bar'))
    bus.emit(msgEvent('m3', 'baz qux'))

    // Wait past the debounce window.
    await new Promise((r) => setTimeout(r, 80))
    await indexer.flush()

    expect(embeddings).toHaveLength(3)
    expect(embeddings.map((e) => e.entityId).sort()).toEqual(['m1', 'm2', 'm3'])
    indexer.stop()
  })

  it('resumes from the cursor on restart without re-indexing', async () => {
    const { store, embeddings } = makeStore()
    const cursor = new InMemoryCursorStore()

    const first = new MemoryIndexer({ bus, embeddings: makeEmbeddings(), store, cursor })
    first.start()
    bus.emit(msgEvent('m1', 'a'))
    bus.emit(msgEvent('m2', 'b'))
    await new Promise((r) => setTimeout(r, 80))
    await first.flush()
    first.stop()
    expect(first.getCursor()).toBe('m2')

    // Simulate a restart with the same persisted cursor.
    const second = new MemoryIndexer({ bus, embeddings: makeEmbeddings(), store, cursor })
    second.start()
    bus.emit(msgEvent('m2', 'b')) // duplicate, before cursor → skipped
    bus.emit(msgEvent('m3', 'c')) // new
    await new Promise((r) => setTimeout(r, 80))
    await second.flush()
    second.stop()

    // m2 was not re-indexed; only m3 was added.
    expect(embeddings).toHaveLength(3)
    expect(embeddings.map((e) => e.entityId).sort()).toEqual(['m1', 'm2', 'm3'])
  })

  it('respects the concurrency cap', async () => {
    const { store } = makeStore()
    let active = 0
    let maxActive = 0
    const embeddings: EmbeddingProvider = {
      name: 'test-embed',
      dimensions: 4,
      embed: async (text: string) => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise((r) => setTimeout(r, 10))
        active--
        return [text.length]
      },
      embedBatch: async (texts: string[]) => texts.map((t) => [t.length]),
    }

    const indexer = new MemoryIndexer({ bus, embeddings, store, concurrency: 2, debounceMs: 0 })
    indexer.start()
    for (let i = 1; i <= 6; i++) bus.emit(msgEvent(`m${i}`, `message ${i}`))
    await new Promise((r) => setTimeout(r, 10))
    await indexer.flush()
    indexer.stop()

    expect(maxActive).toBeLessThanOrEqual(2)
  })
})
