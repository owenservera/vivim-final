import { beforeEach, describe, expect, it } from 'bun:test'
import { IndexingPipeline } from '../../../src/engines/indexing-pipeline.js'
import type { SemanticSearchEngine } from '../../../src/engines/semantic-search.js'

function mockSemantic(): { engine: SemanticSearchEngine; indexed: Array<{ text: string; entityType: string; entityId: string }> } {
  const indexed: Array<{ text: string; entityType: string; entityId: string }> = []
  return {
    engine: {
      indexBatch: async (items: Array<{ text: string; entityType: string; entityId: string }>) => {
        indexed.push(...items)
      },
    } as unknown as SemanticSearchEngine,
    indexed,
  }
}

describe('IndexingPipeline', () => {
  let semantic: ReturnType<typeof mockSemantic>
  let pipeline: IndexingPipeline

  beforeEach(() => {
    semantic = mockSemantic()
    pipeline = new IndexingPipeline(semantic.engine, 100) // 100ms debounce for tests
  })

  it('enqueues and flushes after debounce', async () => {
    pipeline.enqueue('Hello world', 'message', 'msg1')

    expect(pipeline.pendingCount).toBe(1)

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 150))

    expect(semantic.indexed).toHaveLength(1)
    expect(semantic.indexed[0].text).toBe('Hello world')
    expect(semantic.indexed[0].entityType).toBe('message')
    expect(semantic.indexed[0].entityId).toBe('msg1')
    expect(pipeline.pendingCount).toBe(0)
  })

  it('skips reindex for same content hash', async () => {
    pipeline.enqueue('Hello world', 'message', 'msg1')
    pipeline.enqueue('Hello world', 'message', 'msg1') // duplicate

    await new Promise((r) => setTimeout(r, 150))

    // Should only index once
    expect(semantic.indexed).toHaveLength(1)
  })

  it('indexes different content for same id', async () => {
    pipeline.enqueue('Hello world', 'message', 'msg1')
    pipeline.enqueue('Hello world updated', 'message', 'msg1') // same id, different content

    await new Promise((r) => setTimeout(r, 150))

    // Should index twice
    expect(semantic.indexed).toHaveLength(2)
  })

  it('batches multiple items in single flush', async () => {
    // Enqueue multiple items quickly
    for (let i = 0; i < 5; i++) {
      pipeline.enqueue(`Message ${i}`, 'message', `msg${i}`)
    }

    expect(pipeline.pendingCount).toBe(5)

    await new Promise((r) => setTimeout(r, 150))

    // All 5 should be indexed in one batch
    expect(semantic.indexed).toHaveLength(5)
    expect(pipeline.pendingCount).toBe(0)
  })

  it('flushNow processes pending items immediately', async () => {
    pipeline.enqueue('Hello world', 'message', 'msg1')

    expect(pipeline.pendingCount).toBe(1)

    await pipeline.flushNow()

    expect(semantic.indexed).toHaveLength(1)
    expect(pipeline.pendingCount).toBe(0)
  })
})
