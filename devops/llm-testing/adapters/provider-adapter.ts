// devops/llm-testing/adapters/provider-adapter.ts
// Provider Chrome slave adapter — uses open-claude-in-chrome_* tools.
// Rate limit: 5s delay, max 10 prompts per provider per session.
// Intelligent model selection: queries LocalAgentStore for available models,
// generates per-model test cases, and verifies multi-turn context retention.

import { getLogger } from '../../../src/lib/logger.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { LocalAgentStore } from '../../../src/storage/contracts/local-agent-store.js'
import type { AgenticStoreContract } from '../../../src/storage/contracts/agentic-store.js'
import type { EventRecordStore } from '../../../src/engines/event-record-store.js'
import type { KnowledgeStore } from '../knowledge-store.js'
import type { TestCase, TestConfig, TestResult, TestSurface } from '../types.js'
import type { SurfaceAdapter } from './surface-adapter.js'
import type { OpenCodeClient } from '../../../src/engines/opencode/opencode-client.js'
import type { OpenCodeIngest } from '../../../src/engines/opencode/opencode-ingest.js'

const log = getLogger('llm-testing:provider')

/**
 * Local peer providers (no Chrome slave). `opencode` is vivim's bundled
 * local LLM: a supervised `opencode serve` subprocess reachable over HTTP/SSE.
 * These are exercised through their native client, not the browser bridge.
 */
const LOCAL_PROVIDERS = new Set(['opencode'])

export interface ChromeToolBridge {
  launch(provider: string): Promise<void>
  navigate(url: string): Promise<void>
  find(query: string): Promise<string | null>
  click(ref: string): Promise<void>
  type(ref: string, text: string): Promise<void>
  pressKey(key: string): Promise<void>
  screenshot(filename: string): Promise<string>
  waitForTimeout(ms: number): Promise<void>
  readConsoleMessages(pattern?: string): Promise<string[]>
}

const PROVIDER_URLS: Record<string, string> = {
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
}

const RATE_LIMIT_DELAY_MS = 5000
const MAX_PROMPTS_PER_SESSION = 10
const RESPONSE_TIMEOUT_MS = 30000

export class ProviderAdapter implements SurfaceAdapter {
  readonly name: TestSurface = 'provider'
  private config!: TestConfig
  private knowledge: KnowledgeStore
  private localAgentStore: LocalAgentStore | null = null
  private agenticStore: AgenticStoreContract | null = null
  private eventRecordStore: EventRecordStore | null = null
  private bridge: ChromeToolBridge | null = null
  private opencodeClient: OpenCodeClient | null = null
  private opencodeIngest: OpenCodeIngest | null = null
  /** Active opencode session IDs per provider — enables multi-turn context. */
  private activeSessions: Map<string, string> = new Map()
  /** Cached models per provider slug (from LocalAgentStore). */
  private cachedModels: Map<string, Array<{ slug: string; displayName: string; isDefault: boolean }>> = new Map()
  /** Memory projection: provider slug → conversationId in the agent memory system. */
  private memorySessions: Map<string, string> = new Map()
  private promptCounts: Map<string, number> = new Map()
  private lastPromptTime: Map<string, number> = new Map()

  constructor(knowledge: KnowledgeStore) {
    this.knowledge = knowledge
  }

  setBridge(bridge: ChromeToolBridge) {
    this.bridge = bridge
  }

  /**
   * Wire the local opencode peer-provider client. Called from the orchestrator
   * when `globalThis.__opencodeServe` is available so local-provider tests can
   * talk to `opencode serve` instead of a Chrome slave.
   */
  setOpenCodeClient(client: OpenCodeClient | null) {
    this.opencodeClient = client
  }

  /**
   * Wire the LocalAgentStore so discoverCapabilities() can query available
   * models and generate intelligent per-model test cases.
   */
  setLocalAgentStore(store: LocalAgentStore | null) {
    this.localAgentStore = store
  }

  /**
   * Wire the AgenticStoreContract and EventRecordStore so provider test results
   * can be projected into the agent memory system.
   */
  setMemoryStores(agenticStore: AgenticStoreContract | null, eventRecordStore: EventRecordStore | null) {
    this.agenticStore = agenticStore
    this.eventRecordStore = eventRecordStore
  }

  async init(config: TestConfig, _registry?: UnifiedCapabilityRegistry): Promise<void> {
    this.config = config
  }

  async discoverCapabilities(): Promise<TestCase[]> {
    const tests: TestCase[] = []

    for (const slug of this.config.providers) {
      const isLocal = LOCAL_PROVIDERS.has(slug)

      if (isLocal && this.localAgentStore) {
        // Intelligent model discovery: query the store for available models
        const provider = await this.localAgentStore.getAgentProvider(slug)
        const models = provider?.models ?? []
        this.cachedModels.set(slug, models)

        if (models.length === 0) {
          // No models found — still test basic connectivity
          tests.push({
            id: `provider-${slug}-send`,
            surface: 'provider',
            capability: 'opencode_send',
            action: `Send a message to ${slug} (local provider, no models configured)`,
            expected: `${slug} streams a response`,
            input: { provider: slug, message: 'Hello from LLM testing' },
          })
        } else {
          // Generate per-model test cases
          for (const model of models) {
            tests.push({
              id: `provider-${slug}-send-${model.slug.split('/').pop()}`,
              surface: 'provider',
              capability: 'opencode_send',
              action: `Send a message to ${slug} via ${model.displayName}`,
              expected: `${slug} streams a response using ${model.displayName}`,
              input: { provider: slug, model: model.slug, message: 'Hello from LLM testing' },
            })
          }

          // Multi-turn context retention test (uses first model)
          tests.push({
            id: `provider-${slug}-multiturn`,
            surface: 'provider',
            capability: 'opencode_multiturn',
            action: `Verify multi-turn context retention on ${slug}`,
            expected: `${slug} retains context across messages`,
            input: {
              provider: slug,
              model: models[0].slug,
              messages: [
                'My secret code is BLUE-ELEPHANT-42. Remember this.',
                'What was the secret code I just told you?',
              ],
              expectedInResponse: 'BLUE-ELEPHANT-42',
            },
          })
        }
      } else {
        // Chrome slave path (webapp providers)
        tests.push({
          id: `provider-${slug}-send`,
          surface: 'provider',
          capability: 'conversation_send',
          action: `Send a message to ${slug}`,
          expected: `${slug} streams a response`,
          input: { provider: slug, message: 'Hello from LLM testing' },
        })
      }
    }

    return tests
  }

  async execute(test: TestCase): Promise<TestResult> {
    const result = await this.runTest(test)
    // T16 — project every provider test result into the agent memory system.
    await this.recordToMemory(test, result).catch(() => {})
    return result
  }

  private async runTest(test: TestCase): Promise<TestResult> {
    const start = Date.now()
    const provider = (test.input?.provider as string) ?? 'gemini'
    const message = (test.input?.message as string) ?? 'Hello'

    if (LOCAL_PROVIDERS.has(provider)) {
      return this.executeLocalProvider(test, provider, message, start)
    }

    if (!this.bridge) {
      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: 'No Chrome tool bridge connected',
        status: 'error',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        error: 'Chrome tool bridge not initialized',
      }
    }

    const count = this.promptCounts.get(provider) ?? 0
    if (count >= MAX_PROMPTS_PER_SESSION) {
      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: `Rate limited: ${count} prompts sent to ${provider} (max ${MAX_PROMPTS_PER_SESSION})`,
        status: 'skip',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        error: `Max prompts per session reached for ${provider}`,
      }
    }

    const lastTime = this.lastPromptTime.get(provider) ?? 0
    const elapsed = Date.now() - lastTime
    if (elapsed < RATE_LIMIT_DELAY_MS) {
      const waitMs = RATE_LIMIT_DELAY_MS - elapsed
      log.info(`Rate limit delay: waiting ${waitMs}ms for ${provider}`)
      await this.bridge.waitForTimeout(waitMs)
    }

    try {
      const knowledge = this.knowledge.getProviderKnowledge(provider)
      const url = PROVIDER_URLS[provider] ?? `https://${provider}.google.com/app`

      await this.bridge.launch(provider)
      await this.bridge.navigate(url)
      await this.bridge.waitForTimeout(3000)

      const composerSelector = knowledge?.composerSelector ?? 'textarea'
      const composer = await this.bridge.find(composerSelector)
      if (!composer) {
        return {
          id: test.id,
          surface: test.surface,
          capability: test.capability,
          action: test.action,
          expected: test.expected,
          actual: `Composer not found: ${composerSelector}`,
          status: 'fail',
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
          error: `Composer not found for ${provider}`,
          fix: knowledge
            ? `Check selector: ${composerSelector}`
            : `Add provider knowledge for ${provider}`,
        }
      }

      await this.bridge.type(composer, message)

      if (knowledge?.sendMethod === 'click-send-button' && knowledge.sendButtonSelector) {
        const sendBtn = await this.bridge.find(knowledge.sendButtonSelector)
        if (sendBtn) {
          await this.bridge.click(sendBtn)
        } else {
          await this.bridge.pressKey('Enter')
        }
      } else {
        await this.bridge.pressKey('Enter')
      }

      await this.bridge.waitForTimeout(RESPONSE_TIMEOUT_MS)

      const screenshotPath = await this.bridge.screenshot(`provider-${provider}-${test.id}`)

      this.promptCounts.set(provider, count + 1)
      this.lastPromptTime.set(provider, Date.now())

      this.knowledge.updateProviderKnowledge(provider, {
        lastTested: new Date().toISOString(),
        successRate: Math.min(1, (knowledge?.successRate ?? 0) + 0.05),
      })

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: `Message sent to ${provider}, response received`,
        status: 'pass',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        screenshot: screenshotPath,
      }
    } catch (err) {
      const durationMs = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)

      this.knowledge.updateProviderKnowledge(provider, {
        successRate: Math.max(0, (this.knowledge.getProviderKnowledge(provider)?.successRate ?? 0) - 0.1),
      })

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: msg,
        status: 'fail',
        durationMs,
        timestamp: new Date().toISOString(),
        error: msg,
        fix: `Check ${provider} Chrome slave is running`,
      }
    }
  }

  async cleanup(): Promise<void> {
    this.bridge = null
    this.promptCounts.clear()
    this.lastPromptTime.clear()
    this.activeSessions.clear()
    this.cachedModels.clear()
  }

  /**
   * Local peer-provider path (e.g. `opencode`). Talks to the native
   * `opencode serve` HTTP/SSE endpoint instead of driving a browser. Asserts
   * that the local LLM client opens a session, accepts a prompt, and streams
   * back a non-empty response. For multi-turn tests, verifies context retention.
   */
  private async executeLocalProvider(
    test: TestCase,
    provider: string,
    message: string,
    start: number,
  ): Promise<TestResult> {
    if (!this.opencodeClient) {
      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: 'Local provider client not wired (opencode serve not running?)',
        status: 'error',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        error: 'OpenCodeClient not initialized',
      }
    }

    // Check if this is a multi-turn context retention test
    const isMultiTurn = test.capability === 'opencode_multiturn'
    const messages = isMultiTurn
      ? (test.input?.messages as string[]) ?? [message]
      : [message]
    const expectedInResponse = test.input?.expectedInResponse as string | undefined
    const model = test.input?.model as string | undefined

    try {
      await this.opencodeClient.ready()

      // Reuse existing session or create new one (multi-turn context)
      const sessionKey = `${provider}:${model ?? 'default'}`
      let sessionId = this.activeSessions.get(sessionKey)

      if (!sessionId) {
        const session = await this.opencodeClient.createSession({
          model: model,
        })
        sessionId = session.sessionId
        this.activeSessions.set(sessionKey, sessionId)
        log.info(`Created session ${sessionId} for ${provider} (model: ${model})`)
      }

      // Send messages sequentially, collecting all responses
      let allResponses = ''
      for (const msg of messages) {
        const { blocks } = await this.opencodeClient.sendMessage(sessionId, msg)
        const received = blocks
          .filter((b: { type?: string; text?: string }) => b.type === 'text' && typeof b.text === 'string')
          .map((b: { text?: string }) => b.text ?? '')
          .join('')
        allResponses += received
      }

      const ok = allResponses.trim().length > 0

      // For multi-turn tests, verify context retention
      if (isMultiTurn && expectedInResponse) {
        const contextRetained = allResponses.includes(expectedInResponse)
        this.knowledge.updateProviderKnowledge(provider, {
          lastTested: new Date().toISOString(),
          successRate: Math.min(1, (this.knowledge.getProviderKnowledge(provider)?.successRate ?? 0) + 0.05),
        })

        return {
          id: test.id,
          surface: test.surface,
          capability: test.capability,
          action: test.action,
          expected: test.expected,
          actual: contextRetained
            ? `Multi-turn context retained: response contains "${expectedInResponse}" (${allResponses.length} chars)`
            : `Multi-turn context LOST: response missing "${expectedInResponse}" (${allResponses.length} chars)`,
          status: contextRetained ? 'pass' : 'fail',
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        }
      }

      this.knowledge.updateProviderKnowledge(provider, {
        lastTested: new Date().toISOString(),
        successRate: Math.min(1, (this.knowledge.getProviderKnowledge(provider)?.successRate ?? 0) + 0.05),
      })

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: ok
          ? `Local provider ${provider} streamed ${allResponses.length} chars`
          : `Local provider ${provider} produced no streamed text`,
        status: ok ? 'pass' : 'fail',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.knowledge.updateProviderKnowledge(provider, {
        successRate: Math.max(
          0,
          (this.knowledge.getProviderKnowledge(provider)?.successRate ?? 0) - 0.1,
        ),
      })
      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: msg,
        status: 'fail',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        error: msg,
        fix: `Check that 'opencode serve' is running and reachable (OPENCODE serve health)`,
      }
    }
  }

  /**
   * T16 — project a provider test result into the agent memory system so the
   * harness's findings become queryable agent memory. One conversation thread
   * per provider; the local `opencode` peer uses the OpenCode session landing
   * rows, webapp providers use the generic agent chat thread. Every result is
   * also written as a durable, hash-chained EventRecord (source:'llm-test').
   */
  private async recordToMemory(test: TestCase, result: TestResult): Promise<void> {
    const store = this.agenticStore
    if (!store) return

    const provider = (test.input?.provider as string) ?? 'unknown'
    const conversationId = await this.ensureMemorySession(provider, test)
    const prompt = (test.input?.message as string) ?? test.action

    await store
      .appendAgentMessage(conversationId, { role: 'user', text: prompt })
      .catch(() => {})

    const responseText =
      `${result.status.toUpperCase()}: ${result.actual}` +
      (result.error ? ` | error: ${result.error}` : '')
    await store
      .appendAgentMessage(conversationId, { role: 'assistant', text: responseText })
      .catch(() => {})

    if (this.eventRecordStore) {
      await this.eventRecordStore
        .append({
          source: 'llm-test',
          type: 'provider_test_result',
          entityType: 'provider_test',
          entityId: `${provider}:${test.id}`,
          providerSessionId: provider,
          payload: {
            provider,
            testId: test.id,
            capability: test.capability,
            status: result.status,
            actual: result.actual,
            expected: test.expected,
            error: result.error,
            timestamp: result.timestamp,
          },
        })
        .catch(() => {})
    }
  }

  /** Get-or-create the memory conversation thread for a provider. */
  private async ensureMemorySession(provider: string, test: TestCase): Promise<string> {
    const cached = this.memorySessions.get(provider)
    if (cached) return cached

    const store = this.agenticStore!
    let conversationId: string

    if (provider === 'opencode' && 'createOpencodeAgentSession' in store) {
      const model = test.input?.model as string | undefined
      const thread = await store.createOpencodeAgentSession({
        sessionId: `llm-test:${provider}`,
        model,
        title: `LLM-test: ${provider}`,
      })
      conversationId = thread.conversationId
    } else {
      const thread = await store.startAgentConversation(
        { kind: 'agent', id: `provider:${provider}` },
        `LLM-testing ${provider}`,
        { title: `LLM-test: ${provider}` },
      )
      conversationId = thread.conversationId
    }

    this.memorySessions.set(provider, conversationId)
    return conversationId
  }
}
