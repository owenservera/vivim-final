// devops/llm-testing/adapters/ui-adapter.ts
// Frontend UI adapter — Playwright-based browser automation.
// Uses open-claude-in-chrome_* tools via the orchestrator.

import { getLogger } from '../../../src/lib/logger.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { TestCase, TestConfig, TestResult, TestSurface } from '../types.js'
import type { SurfaceAdapter } from './surface-adapter.js'

const log = getLogger('llm-testing:ui')

export interface PlaywrightBridge {
  navigate(url: string): Promise<void>
  find(query: string): Promise<string | null>
  click(ref: string): Promise<void>
  type(ref: string, text: string): Promise<void>
  screenshot(filename: string): Promise<string>
  readConsoleMessages(pattern?: string): Promise<string[]>
  readNetworkRequests(urlPattern?: string): Promise<string[]>
  waitForTimeout(ms: number): Promise<void>
}

export class UiAdapter implements SurfaceAdapter {
  readonly name: TestSurface = 'ui'
  private config!: TestConfig
  private bridge: PlaywrightBridge | null = null

  setBridge(bridge: PlaywrightBridge) {
    this.bridge = bridge
  }

  async init(config: TestConfig, _registry?: UnifiedCapabilityRegistry): Promise<void> {
    this.config = config
  }

  async discoverCapabilities(): Promise<TestCase[]> {
    return [
      {
        id: 'ui-conversation_list',
        surface: 'ui',
        capability: 'conversation_list',
        action: 'Navigate to frontend, verify conversation list renders',
        expected: 'Conversation list sidebar visible',
      },
      {
        id: 'ui-conversation_send',
        surface: 'ui',
        capability: 'conversation_send',
        action: 'Type message in composer, press Enter',
        expected: 'Message sent, response streams in ChatSurface',
        input: { message: 'Hello from LLM testing' },
      },
      {
        id: 'ui-conversation_create',
        surface: 'ui',
        capability: 'conversation_create',
        action: 'Click new conversation button',
        expected: 'New conversation created',
      },
      {
        id: 'ui-health_indicator',
        surface: 'ui',
        capability: 'health_check',
        action: 'Verify health indicator shows green',
        expected: 'Health indicator visible and green',
      },
      {
        id: 'ui-command_palette',
        surface: 'ui',
        capability: 'command_palette',
        action: 'Open command palette (Ctrl+K)',
        expected: 'Command palette modal opens',
      },
    ]
  }

  async execute(test: TestCase): Promise<TestResult> {
    const start = Date.now()

    if (!this.bridge) {
      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: 'No Playwright bridge connected',
        status: 'error',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        error: 'Playwright bridge not initialized',
      }
    }

    try {
      const baseUrl = `http://localhost:${this.config.frontendPort}`
      await this.bridge.navigate(baseUrl)
      await this.bridge.waitForTimeout(2000)

      let actual = ''
      let status: 'pass' | 'fail' | 'error' = 'pass'
      let error: string | undefined
      let fix: string | undefined

      if (test.input?.message) {
        const composer = await this.bridge.find('composer input or textarea')
        if (!composer) {
          status = 'fail'
          actual = 'Composer input not found'
          error = 'Composer input not found on page'
          fix = 'Check frontend page is loaded and composer element exists'
        } else {
          await this.bridge.type(composer, test.input.message as string)
          await this.bridge.click(composer)
          await this.bridge.waitForTimeout(3000)
          actual = 'Message typed and Enter pressed'
        }
      } else if (test.input?.selector) {
        const el = await this.bridge.find(test.input.selector as string)
        if (!el) {
          status = 'fail'
          actual = `Element not found: ${test.input.selector}`
          error = `Selector not found: ${test.input.selector}`
        } else {
          await this.bridge.click(el)
          actual = `Clicked element: ${test.input.selector}`
        }
      } else {
        const el = await this.bridge.find(test.action)
        actual = el ? `Found: ${test.action}` : `Not found: ${test.action}`
        status = el ? 'pass' : 'fail'
      }

      const screenshotPath = await this.bridge.screenshot(`ui-${test.id}`)
      const consoleLogs = await this.bridge.readConsoleMessages('error|warning')

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual,
        status,
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        screenshot: screenshotPath,
        consoleLogs,
        error,
        fix,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: msg,
        status: 'error',
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        error: msg,
      }
    }
  }

  async cleanup(): Promise<void> {
    this.bridge = null
  }
}
