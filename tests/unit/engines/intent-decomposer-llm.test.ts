// tests/unit/engines/intent-decomposer-llm.test.ts
// Unit 2.2 — IntentDecomposer LLM strategy.

import { describe, expect, it } from 'bun:test'
import { IntentDecomposer } from '../../../src/engines/intent-decomposer.js'
import type {
  DecomposeContext,
  IntentDecomposerStore,
} from '../../../src/engines/intent-decomposer.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

class MockStore implements IntentDecomposerStore {
  async listTemplates() {
    return []
  }
  async getTemplate() {
    return null
  }
}

class MockRegistry {
  list() {
    return [
      { slug: 'navigate', description: 'Go to a URL' },
      { slug: 'extract', description: 'Extract data' },
      { slug: 'search', description: 'Search the web' },
    ]
  }
  getBySlug(slug: string) {
    return this.list().find((c) => c.slug === slug) ?? undefined
  }
}

class MockLLM {
  calls: string[] = []
  nextResponse = '{"nodes":[],"edges":[],"strategy":"llm"}'

  async complete(prompt: string) {
    this.calls.push(prompt)
    return this.nextResponse
  }
}

const ctx: DecomposeContext = {
  availableCapabilities: ['navigate', 'extract', 'search'],
}

describe('IntentDecomposer — LLM strategy', () => {
  it('returns DAG with strategy=llm when LLM emits valid JSON', async () => {
    const llm = new MockLLM()
    llm.nextResponse =
      '{"nodes":[{"id":"n1","capabilitySlug":"navigate","inputMapping":{"url":"https://example.com"},"dependsOn":[]}],"edges":[],"strategy":"llm"}'
    const decomposer = new IntentDecomposer(
      new MockStore(),
      new MockRegistry() as never,
      llm as never,
    )
    const dag = await decomposer.decomposeWithLlm('go to example.com', ctx)
    expect(dag).not.toBeNull()
    expect(dag?.strategy).toBe('llm')
    expect(dag?.nodes).toHaveLength(1)
    expect(dag?.nodes[0]?.capabilitySlug).toBe('navigate')
  })

  it('returns null on malformed JSON', async () => {
    const llm = new MockLLM()
    llm.nextResponse = 'this is not json at all'
    const decomposer = new IntentDecomposer(
      new MockStore(),
      new MockRegistry() as never,
      llm as never,
    )
    const dag = await decomposer.decomposeWithLlm('anything', ctx)
    expect(dag).toBeNull()
  })

  it('returns null when DAG references an unregistered slug', async () => {
    const llm = new MockLLM()
    llm.nextResponse =
      '{"nodes":[{"id":"n1","capabilitySlug":"nonexistent","inputMapping":{},"dependsOn":[]}],"edges":[],"strategy":"llm"}'
    const decomposer = new IntentDecomposer(
      new MockStore(),
      new MockRegistry() as never,
      llm as never,
    )
    const dag = await decomposer.decomposeWithLlm('use fake tool', ctx)
    expect(dag).toBeNull()
  })

  it('injects the capability catalog into the prompt', async () => {
    const llm = new MockLLM()
    const decomposer = new IntentDecomposer(
      new MockStore(),
      new MockRegistry() as never,
      llm as never,
    )
    await decomposer.decomposeWithLlm('test', ctx)
    expect(llm.calls[0]).toContain('navigate')
    expect(llm.calls[0]).toContain('extract')
    expect(llm.calls[0]).toContain('search')
  })

  it('returns null when no LLM adapter is wired', async () => {
    const decomposer = new IntentDecomposer(new MockStore(), new MockRegistry() as never)
    const dag = await decomposer.decomposeWithLlm('anything', ctx)
    expect(dag).toBeNull()
  })
})
