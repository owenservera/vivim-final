import { beforeEach, describe, expect, test } from 'bun:test'
import {
  ManifestInferenceEngine,
  type ProviderManifest,
} from '../../../src/engines/manifest-inference.js'
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

describe('ManifestInferenceEngine', () => {
  let engine: ManifestInferenceEngine

  beforeEach(() => {
    engine = new ManifestInferenceEngine()
  })

  test('infer creates manifest from session draft', async () => {
    const result = await engine.infer(makeSession())
    expect(result.manifest.slug).toBe('test-provider')
    expect(result.manifest.version).toBe('1.0.0')
    expect(result.warnings).toBeInstanceOf(Array)
  })

  test('infer warns when slug is unknown', async () => {
    const session = makeSession({
      manifestDraft: {
        slug: 'unknown',
        displayName: 'Test',
        description: 'A test',
        shapeId: 'custom',
        baseUrl: 'https://example.com',
        capabilities: ['send'],
        endpoints: [],
        parserFormat: 'json',
      },
    })
    const result = await engine.infer(session)
    expect(result.requiredEdits).toContain('slug')
  })

  test('infer warns when capabilities empty', async () => {
    const session = makeSession({
      manifestDraft: {
        slug: 'test',
        displayName: 'Test',
        description: 'A test',
        shapeId: 'chat_app',
        baseUrl: 'https://example.com',
        capabilities: [],
        endpoints: [],
        parserFormat: 'json',
      },
    })
    const result = await engine.infer(session)
    expect(result.warnings.some((w) => w.includes('No capabilities'))).toBe(true)
  })

  test('infer warns on low confidence', async () => {
    const session = makeSession({ confidence: 0.3 })
    const result = await engine.infer(session)
    expect(result.warnings.some((w) => w.includes('Low shape detection'))).toBe(true)
  })

  test('applyEdits modifies manifest fields', async () => {
    const manifest: ProviderManifest = {
      slug: 'old',
      displayName: 'Old',
      description: 'old',
      version: '1.0.0',
      baseUrl: 'https://example.com',
      shapeId: 'chat_app',
      capabilities: ['send_message'],
      endpoints: [],
      parser: { format: 'sse', archetype: 'claude', fallbackStrategy: 'plain_text' },
    }
    const result = await engine.applyEdits(manifest, { slug: 'new', displayName: 'New' })
    expect(result.slug).toBe('new')
    expect(result.displayName).toBe('New')
  })

  test('validate catches invalid slug', async () => {
    const manifest: ProviderManifest = {
      slug: 'a',
      displayName: 'Test',
      description: '',
      version: '1.0.0',
      baseUrl: 'not-a-url',
      shapeId: 'chat_app',
      capabilities: [],
      endpoints: [],
      parser: { format: 'sse', archetype: 'generic', fallbackStrategy: 'raw' },
    }
    const result = await engine.validate(manifest)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('validate passes for valid manifest', async () => {
    const manifest: ProviderManifest = {
      slug: 'good-provider',
      displayName: 'Good',
      description: 'ok',
      version: '1.0.0',
      baseUrl: 'https://example.com',
      shapeId: 'chat_app',
      capabilities: ['send_message'],
      endpoints: [{ type: 'api', path: '/api' }],
      parser: { format: 'sse', archetype: 'claude', fallbackStrategy: 'plain_text' },
    }
    const result = await engine.validate(manifest)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
