// seeds/harness/composer.module.ts
// Composer harness module — interact with chat composer element

import type {
  HarnessContext,
  HarnessModule,
  HarnessModuleResult,
} from '../../src/engines/harness-runtime.js'

const composerModule: HarnessModule = {
  name: 'composer',
  version: 1,
  inputSchema: { action: 'focus|type|clear|send|get_content', text: 'string', selector: 'string' },
  outputSchema: { ok: 'boolean', action: 'string', content: 'string', error: 'string' },
  preconditions: ['page_loaded'],
  postconditions: ['composer_visible'],

  async execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult> {
    const action = input.action as string
    const text = input.text as string | undefined
    const selector = (input.selector as string) || '[contenteditable]'

    const el = await ctx.waitFor(selector, 5000)
    if (!el) {
      return { ok: false, output: {}, error: `Composer element not found: ${selector}` }
    }

    try {
      switch (action) {
        case 'focus': {
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'composer',
            data: { action: 'focus' },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'focus', content: '' } }
        }
        case 'type': {
          if (!text) return { ok: false, output: {}, error: 'text required for type action' }
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'composer',
            data: { action: 'type', length: text.length },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'type', content: el.text + text } }
        }
        case 'clear': {
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'composer',
            data: { action: 'clear' },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'clear', content: '' } }
        }
        case 'send': {
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'composer',
            data: { action: 'send' },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'send' } }
        }
        case 'get_content': {
          return { ok: true, output: { action: 'get_content', content: el.text } }
        }
        default: {
          return { ok: false, output: {}, error: `Unknown action: ${action}` }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.emitTelemetry({
        type: 'error',
        moduleId: 'composer',
        data: { action, message },
        ts: Date.now(),
      })
      return { ok: false, output: {}, error: message }
    }
  },
}

export default composerModule
