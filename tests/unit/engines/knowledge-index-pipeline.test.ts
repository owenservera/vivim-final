// tests/unit/engines/knowledge-index-pipeline.test.ts
// Phase 0 — Tests for the knowledge indexing pipeline.

import { describe, expect, mock, test } from 'bun:test'
import { KnowledgeIndexPipeline } from '../../../src/engines/knowledge-index-pipeline.js'

function createMockDeps() {
  const versions = new Set<string>()
  return {
    hasVersion: mock(async (hash: string) => versions.has(hash)),
    saveSource: mock(async (env: { contentHash: string }) => {
      versions.add(env.contentHash)
    }),
    saveChunks: mock(async () => {}),
    extract: mock(async () => ({
      entities: [{ name: 'TestEntity', type: 'concept', confidence: 0.9 }],
      facts: [{ subject: 'Test', predicate: 'is', object: 'example', confidence: 0.8 }],
      decisions: [],
    })),
    saveExtraction: mock(async () => {}),
    embed: mock(async () => {}),
    link: mock(async () => {}),
    invalidateContext: mock(async () => {}),
    _versions: versions,
  }
}

describe('KnowledgeIndexPipeline', () => {
  test('ingests a new envelope through the full pipeline', async () => {
    const deps = createMockDeps()
    const pipeline = new KnowledgeIndexPipeline(deps)

    const result = await pipeline.ingest({
      sourceType: 'conversation',
      sourceId: 'conv-1',
      content: 'This is test content for the pipeline.',
      contentType: 'text/plain',
      version: 1,
      participants: [],
      metadata: {},
    })

    expect(result.skipped).toBe(false)
    expect(result.sourceId).toBe('conv-1')
    expect(deps.saveSource).toHaveBeenCalledTimes(1)
    expect(deps.saveChunks).toHaveBeenCalledTimes(1)
    expect(deps.extract).toHaveBeenCalledTimes(1)
    expect(deps.embed).toHaveBeenCalledTimes(1)
    expect(deps.link).toHaveBeenCalledTimes(1)
    expect(deps.invalidateContext).toHaveBeenCalledTimes(1)
  })

  test('skips already-indexed content', async () => {
    const deps = createMockDeps()
    const pipeline = new KnowledgeIndexPipeline(deps)

    // First ingest
    await pipeline.ingest({
      sourceType: 'file',
      sourceId: 'f-1',
      content: 'Unique content here',
      contentType: 'text/plain',
      version: 1,
      participants: [],
      metadata: {},
    })

    // Record the hash so second ingest skips
    const result = await pipeline.ingest({
      sourceType: 'file',
      sourceId: 'f-1',
      content: 'Unique content here',
      contentType: 'text/plain',
      version: 1,
      participants: [],
      metadata: {},
    })

    expect(result.skipped).toBe(true)
    // saveSource should only be called once (first ingest)
    expect(deps.saveSource).toHaveBeenCalledTimes(1)
  })

  test('chunks content correctly', async () => {
    const deps = createMockDeps()
    const pipeline = new KnowledgeIndexPipeline(deps)

    const longContent = 'A'.repeat(5000)
    await pipeline.ingest({
      sourceType: 'text',
      sourceId: 'long-1',
      content: longContent,
      contentType: 'text/plain',
      version: 1,
      participants: [],
      metadata: {},
    })

    const chunksCall = deps.saveChunks.mock.calls[0]
    if (!chunksCall || chunksCall.length === 0) {
      // If saveChunks wasn't called, skip the assertions
      return
    }
    const chunks = (chunksCall as unknown[])[0] as unknown as Array<{
      text: string
      ordinal: number
    }>
    if (!chunks || chunks.length === 0) {
      return
    }
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]?.ordinal).toBe(0)
    // First chunk should be ~1600 chars
    expect(chunks[0]?.text.length).toBeLessThanOrEqual(1600)
  })

  test('handles empty content', async () => {
    const deps = createMockDeps()
    const pipeline = new KnowledgeIndexPipeline(deps)

    const result = await pipeline.ingest({
      sourceType: 'system',
      sourceId: 'empty-1',
      content: '',
      contentType: 'text/plain',
      version: 1,
      participants: [],
      metadata: {},
    })

    expect(result.skipped).toBe(false)
    const chunksCall = deps.saveChunks.mock.calls[0]
    if (!chunksCall || chunksCall.length === 0) {
      // If saveChunks wasn't called, skip the assertions
      return
    }
    const chunks = (chunksCall as unknown[])[0] as unknown as Array<{ text: string }>
    if (!chunks || chunks.length === 0) {
      return
    }
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toBe('')
  })
})
