// devops/llm-testing/adapters/api-adapter.ts
// REST API adapter — direct HTTP calls to backend.

import { getLogger } from '../../../src/lib/logger.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { TestCase, TestConfig, TestResult, TestSurface } from '../types.js'
import type { SurfaceAdapter } from './surface-adapter.js'

const log = getLogger('llm-testing:api')

export class ApiAdapter implements SurfaceAdapter {
  readonly name: TestSurface = 'api'
  private config!: TestConfig
  private registry?: UnifiedCapabilityRegistry

  async init(config: TestConfig, registry?: UnifiedCapabilityRegistry): Promise<void> {
    this.config = config
    this.registry = registry
  }

  async discoverCapabilities(): Promise<TestCase[]> {
    // ONE ENTRY POINT: derive endpoints from the live registry's api-surface
    // capabilities so the API test suite always tracks the canonical set.
    if (this.registry) {
      return this.registry
        .list({ surface: 'api' })
        .map((cap) => ({
          id: `api-${cap.slug}`,
          surface: 'api' as TestSurface,
          capability: cap.slug,
          action: `Call ${cap.apiEndpoint?.method ?? 'GET'} ${cap.apiEndpoint?.path ?? cap.slug}`,
          expected: 'Endpoint responds 2xx',
          input: {
            method: cap.apiEndpoint?.method ?? 'GET',
            path: cap.apiEndpoint?.path ?? `/api/capabilities/${cap.id}/execute`,
          },
        }))
    }

    log.warn('No registry wired to ApiAdapter; using fallback smoke list')
    const endpoints = [
      { method: 'GET', path: '/api/health', capability: 'health_check', action: 'Health check', expected: 'Returns 200 OK' },
      { method: 'GET', path: '/api/conversations', capability: 'conversation_list', action: 'List conversations', expected: 'Returns array of conversations' },
      { method: 'GET', path: '/api/capabilities', capability: 'capability_list', action: 'List capabilities', expected: 'Returns array of capabilities' },
    ]
    return endpoints.map((ep, i) => ({
      id: `api-${ep.capability}-${i}`,
      surface: 'api' as TestSurface,
      capability: ep.capability,
      action: ep.action,
      expected: ep.expected,
      input: { method: ep.method, path: ep.path },
    }))
  }

  async execute(test: TestCase): Promise<TestResult> {
    const start = Date.now()
    const method = (test.input?.method as string) ?? 'GET'
    const path = (test.input?.path as string) ?? '/api/health'
    const body = test.input?.body as Record<string, unknown> | undefined
    const baseUrl = `http://localhost:${this.config.backendPort}`

    try {
      const resp = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'llm-testing/1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      })

      const text = await resp.text()
      const durationMs = Date.now() - start

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = text
      }

      const status: 'pass' | 'fail' = resp.ok ? 'pass' : 'fail'

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: `HTTP ${resp.status}: ${text.slice(0, 500)}`,
        status,
        durationMs,
        timestamp: new Date().toISOString(),
        ...(status === 'fail' ? { error: `HTTP ${resp.status}`, fix: `Check endpoint ${method} ${path}` } : {}),
      }
    } catch (err) {
      const durationMs = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: msg,
        status: 'error',
        durationMs,
        timestamp: new Date().toISOString(),
        error: msg,
      }
    }
  }

  async cleanup(): Promise<void> {}
}
