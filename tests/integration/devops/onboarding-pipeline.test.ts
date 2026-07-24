// tests/integration/devops/onboarding-pipeline.test.ts
// Integration test for the full 8-phase onboarding pipeline:
//   discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
//
// Heavy engine dependencies are mocked via mock.module so the test runs in
// Bun's test runner without a real browser or DB.

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = process.cwd()
const RUNTIME_DIR = join(PROJECT_ROOT, '.runtime')
const SPECS_DIR = join(PROJECT_ROOT, 'specs')
const CHROME_PROFILES_DIR = join(PROJECT_ROOT, 'chrome-profiles')

beforeEach(() => {
  mock.restore()
  for (const dir of [RUNTIME_DIR, SPECS_DIR, CHROME_PROFILES_DIR]) {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
  }

  const fakeProfile = join(CHROME_PROFILES_DIR, 'mock-provider', 'default-user')
  mkdirSync(fakeProfile, { recursive: true })
  writeFileSync(join(fakeProfile, 'Cookies'), 'fake-cookies')

  mock.module('../../../src/engines/protocol-discovery.js', () => ({
    ProtocolDiscoveryEngine: class {
      async discover(_url: string) {
        return {
          detectedFramework: 'mock',
          primaryComposer: { selector: '#composer', confidence: 0.9 },
          primarySendButton: { selector: 'button[aria-label="Send"]', confidence: 0.9 },
          confidence: 0.9,
        }
      }
    },
  }))

  mock.module('../../../src/engines/streaming-response-analyzer.js', () => ({
    StreamingResponseAnalyzer: class {
      analyze(_captured: string) {
        return {
          transport: 'mock-sse',
          dataPath: 'choices[].delta.content',
          confidence: 0.85,
          logicCode:
            'function(module, exports) { exports.default = { name: "mock", version: 1, providerId: "mock", parse() { return [{type:"text",text:"ok"}] }, detectCompletion() { return true }, getConfidence() { return 0.85 } } }',
        }
      }
    },
  }))

  mock.module('../../../src/engines/selector-healer.js', () => ({
    SelectorHealer: class {
      async heal() {
        return {
          healed: { type: 'css', selector: 'button[aria-label="Send"]' },
          strategy: 'text_match',
          confidence: 0.9,
          originalSelector: { type: 'css', selector: 'div#composer' },
        }
      }
    },
  }))

  mock.module('../../../src/engines/semantic-grounding.js', () => ({
    SemanticGroundingEngine: class {},
  }))

  mock.module('../../../src/storage/db.js', () => ({
    getDb: () => ({
      prisma: {
        parser: { findFirst: async () => null },
      },
    }),
  }))

  mock.module('../../../src/storage/impl/parser-store-impl.js', () => ({
    ParserStoreImpl: class {
      async getActiveParser(_providerId: string) {
        return {
          id: 'p1',
          providerId: 'mock',
          name: 'mock',
          version: '1',
          logicCode: `function parse(rawBody) { return [{type:"text",text:"hello"}]; }
function detectCompletion(rawBody) { return true; }
function getConfidence(rawBody) { return 0.85; }
module.exports.default = { name: "mock", version: 1, providerId: "mock", parse: parse, detectCompletion: detectCompletion, getConfidence: getConfidence };`,
          logicType: 'inline',
          isActive: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      }
    },
  }))

  mock.module('../../../src/engines/parser-repair.js', () => ({
    repairLowConfidenceParser: async () => ({
      repaired: false,
      beforeConfidence: 0,
      afterConfidence: 0,
    }),
    generateParserModuleCode: (_provider: string, _captured: string) => 'mock-code',
  }))

  mock.module('../../../src/engines/stream-parser.js', () => ({
    StreamParserEngine: class {},
  }))

  mock.module('node:child_process', () => ({
    spawn: () => ({
      stdout: { on: () => {} },
      stderr: { on: () => {} },
      on: (_ev: string, cb: (c: number | null) => void) => cb(0),
    }),
  }))

  mock.module('../../../devops/runtime-test/test-cap.js', () => ({
    testCapability: async (_slug: string) => ({ ok: true, error: undefined, output: null }),
  }))

  mock.module('../../../devops/frontend-automation-tester.js', () => ({
    testFrontend: async (_provider: string, _capability: string) => ({
      ok: true,
      detail: 'frontend ok',
    }),
  }))

  mock.module('../../../devops/unified-gate.js', () => ({
    runUnifiedGate: async () => ({ passed: true }),
  }))

  mock.module('../../../devops/speckit-converge-bridge.js', () => ({
    unifiedConverge: async () => ({ tasksAppended: 0 }),
  }))

  mock.module('../../../devops/runtime-test/cdp-resolver.js', () => ({
    resolveCdpForProvider: async () => ({
      client: {
        send: async () => ({ result: { value: { found: true, visible: true } } }),
        connected: true,
        on: () => {},
        off: () => {},
        disconnect: async () => {},
      },
      sessionId: 'mock-session',
      wsUrl: 'ws://localhost:9222',
    }),
  }))

  mock.module('../../../src/executor/profile-allocator.js', () => ({
    ProfileAllocator: class {
      async isAuthenticated(_profileDir: string) {
        return true
      }
    },
  }))
})

// ── Tests ──────────────────────────────────────────────────────

describe('runOnboard integration pipeline', () => {
  it('completes all 8 phases when every phase succeeds', async () => {
    const { runOnboard } = await import('../../../devops/onboard-controller.js')
    const report = await runOnboard({
      goal: 'onboard mock-provider.com',
    })

    expect(report.ok).toBe(true)
    expect(report.completed).toEqual([
      'discover',
      'infer',
      'test-selectors',
      'test-parse',
      'test-cap',
      'test-frontend',
      'verify',
      'converge',
    ])
    expect(report.failedAt).toBeUndefined()
    expect(report.convergenceTasks).toHaveLength(0)
  })
})
