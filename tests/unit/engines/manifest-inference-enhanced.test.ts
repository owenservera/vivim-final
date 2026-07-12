import { beforeEach, describe, expect, test } from 'bun:test'
import { ManifestInferenceEngine } from '../../../src/engines/manifest-inference.js'
import type { DiscoverySession } from '../../../src/engines/provider-discovery.js'

function makeSession(overrides?: Partial<DiscoverySession>): DiscoverySession {
  return {
    id: 's1',
    url: 'https://example.com',
    status: 'complete',
    shapeId: null,
    confidence: 0.8,
    detectedCapabilities: [],
    interactiveElements: [],
    parserFormat: 'sse',
    manifestDraft: {
      slug: 'test-provider',
      displayName: 'Test',
      description: 'A test',
      shapeId: 'chat_app',
      baseUrl: 'https://example.com',
      capabilities: ['send_message'],
      endpoints: [{ type: 'api', path: '/api' }],
      parserFormat: 'sse',
    },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('ManifestInferenceEngine (Phase 22)', () => {
  let engine: ManifestInferenceEngine

  beforeEach(() => {
    engine = new ManifestInferenceEngine()
  })

  describe('infer', () => {
    test('produces field confidence scores', async () => {
      const result = await engine.infer(makeSession())
      expect(result.fieldConfidence).toBeDefined()
      expect(typeof result.fieldConfidence.slug).toBe('number')
      expect(typeof result.fieldConfidence.capabilities).toBe('number')
    })

    test('flags low-confidence fields in needsReview', async () => {
      const result = await engine.infer(makeSession({ confidence: 0.3, parserFormat: null }))
      expect(result.needsReview).toContain('parserFormat')
    })

    test('tracks LLM-inferred fields', async () => {
      const result = await engine.infer(makeSession({ shapeId: null }))
      expect(result.llmInferred).toContain('displayName')
    })

    test('generates warnings for low confidence', async () => {
      const result = await engine.infer(makeSession({ confidence: 0.3 }))
      expect(result.warnings.some((w) => w.includes('Low'))).toBe(true)
    })
  })

  describe('validate', () => {
    test('validates a valid manifest', async () => {
      const result = await engine.validate({
        slug: 'test-slug',
        displayName: 'Test',
        description: 'Desc',
        version: '1.0.0',
        baseUrl: 'https://example.com',
        shapeId: 'chat_app',
        capabilities: ['send_message'],
        endpoints: [{ type: 'api', path: '/' }],
        parser: { format: 'sse', archetype: 'claude', fallbackStrategy: 'plain_text' },
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('returns errors for invalid slug', async () => {
      const result = await engine.validate({
        slug: 'a',
        displayName: 'Test',
        description: 'Desc',
        version: '1.0.0',
        baseUrl: 'https://example.com',
        shapeId: 'chat_app',
        capabilities: [],
        endpoints: [],
        parser: { format: 'sse', archetype: 'claude', fallbackStrategy: 'plain_text' },
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('slug'))).toBe(true)
    })

    test('returns warnings for empty capabilities', async () => {
      const result = await engine.validate({
        slug: 'test',
        displayName: 'Test',
        description: 'Desc',
        version: '1.0.0',
        baseUrl: 'https://example.com',
        shapeId: 'chat_app',
        capabilities: [],
        endpoints: [{ type: 'api', path: '/' }],
        parser: { format: 'sse', archetype: 'claude', fallbackStrategy: 'plain_text' },
      })
      expect(result.warnings.some((w) => w.includes('capabilities'))).toBe(true)
    })
  })

  describe('applyEdits', () => {
    test('applies slug edit', async () => {
      const manifest = {
        slug: 'old',
        displayName: 'Test',
        description: 'Desc',
        version: '1.0.0',
        baseUrl: 'https://example.com',
        shapeId: 'chat_app',
        capabilities: ['send_message'],
        endpoints: [{ type: 'api', path: '/' }],
        parser: { format: 'sse', archetype: 'claude', fallbackStrategy: 'plain_text' as const },
      }
      const result = await engine.applyEdits(manifest, { slug: 'new-slug' })
      expect(result.slug).toBe('new-slug')
    })
  })
})
