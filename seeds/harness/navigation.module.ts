// seeds/harness/navigation.module.ts
// Navigation harness module — navigate to URLs and wait for page readiness

import type {
  HarnessContext,
  HarnessModule,
  HarnessModuleResult,
} from '../../src/engines/harness-runtime.js'

const navigationModule: HarnessModule = {
  name: 'navigation',
  version: 1,
  inputSchema: {
    action: 'navigate|wait_for|get_current_url',
    url: 'string',
    selector: 'string',
    timeoutMs: 'number',
  },
  outputSchema: { ok: 'boolean', action: 'string', url: 'string', error: 'string' },
  preconditions: ['chrome_running'],
  postconditions: ['page_loaded'],

  async execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult> {
    const action = input.action as string
    const url = input.url as string | undefined
    const selector = input.selector as string | undefined
    const timeoutMs = (input.timeoutMs as number) || 30000

    try {
      switch (action) {
        case 'navigate': {
          if (!url) return { ok: false, output: {}, error: 'url required for navigate' }
          ctx.emitTelemetry({
            type: 'network_intercept',
            moduleId: 'navigation',
            data: { action: 'navigate', url },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'navigate', url } }
        }
        case 'wait_for': {
          if (!selector) return { ok: false, output: {}, error: 'selector required for wait_for' }
          const el = await ctx.waitFor(selector, timeoutMs)
          if (!el) return { ok: false, output: {}, error: `Selector not found: ${selector}` }
          ctx.emitTelemetry({
            type: 'selector_hit',
            moduleId: 'navigation',
            data: { action: 'wait_for', selector },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'wait_for' } }
        }
        case 'get_current_url': {
          const pageState = ctx.getPageState()
          return { ok: true, output: { action: 'get_current_url', url: pageState.url } }
        }
        default: {
          return { ok: false, output: {}, error: `Unknown action: ${action}` }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.emitTelemetry({
        type: 'error',
        moduleId: 'navigation',
        data: { action, message },
        ts: Date.now(),
      })
      return { ok: false, output: {}, error: message }
    }
  },
}

export default navigationModule
