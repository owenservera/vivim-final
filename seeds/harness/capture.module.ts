// seeds/harness/capture.module.ts
// Capture harness module — capture network responses and DOM state

import type {
  HarnessContext,
  HarnessModule,
  HarnessModuleResult,
} from '../../src/engines/harness-runtime.js'

const captureModule: HarnessModule = {
  name: 'capture',
  version: 1,
  inputSchema: {
    action: 'start_capture|stop_capture|get_response_body|screenshot',
    pattern: 'string',
    url: 'string',
  },
  outputSchema: {
    ok: 'boolean',
    action: 'string',
    body: 'string',
    image: 'string',
    error: 'string',
  },
  preconditions: ['page_loaded'],
  postconditions: [],

  async execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult> {
    const action = input.action as string
    const pattern = input.pattern as string | undefined
    const url = input.url as string | undefined

    try {
      switch (action) {
        case 'start_capture': {
          ctx.emitTelemetry({
            type: 'network_intercept',
            moduleId: 'capture',
            data: { action: 'start_capture', pattern },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'start_capture' } }
        }
        case 'stop_capture': {
          ctx.emitTelemetry({
            type: 'network_intercept',
            moduleId: 'capture',
            data: { action: 'stop_capture' },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'stop_capture' } }
        }
        case 'get_response_body': {
          if (!pattern && !url) return { ok: false, output: {}, error: 'pattern or url required' }
          const regex = new RegExp(pattern || url || '')
          const body = await ctx.intercept(regex)
          return { ok: true, output: { action: 'get_response_body', body } }
        }
        case 'screenshot': {
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'capture',
            data: { action: 'screenshot' },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'screenshot', image: '' } }
        }
        default: {
          return { ok: false, output: {}, error: `Unknown action: ${action}` }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.emitTelemetry({
        type: 'error',
        moduleId: 'capture',
        data: { action, message },
        ts: Date.now(),
      })
      return { ok: false, output: {}, error: message }
    }
  },
}

export default captureModule
