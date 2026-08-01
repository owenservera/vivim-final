// tests/unit/engines/embedding-minilm.test.ts
import { describe, expect, it } from 'bun:test'
import { MiniLMEmbeddingEngine } from '../../../src/engines/embedding-minilm.js'

describe('MiniLMEmbeddingEngine', () => {
  it('instantiates embedding engine', () => {
    const engine = new MiniLMEmbeddingEngine()
    expect(engine).toBeDefined()
  })
})
