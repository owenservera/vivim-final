// seeds/harness/selector.module.ts
// Selector harness module — DOM querying and element interaction

import type {
  HarnessContext,
  HarnessModule,
  HarnessModuleResult,
} from '../../src/engines/harness-runtime.js'

const selectorModule: HarnessModule = {
  name: 'selector',
  version: 1,
  inputSchema: {
    action: 'query|query_all|wait_for|click|get_text|get_attribute',
    selector: 'string',
    attribute: 'string',
    timeoutMs: 'number',
  },
  outputSchema: {
    ok: 'boolean',
    action: 'string',
    elements: 'array',
    text: 'string',
    attribute: 'string',
    error: 'string',
  },
  preconditions: ['page_loaded'],
  postconditions: [],

  async execute(input: Record<string, unknown>, ctx: HarnessContext): Promise<HarnessModuleResult> {
    const action = input.action as string
    const selector = input.selector as string
    const attribute = input.attribute as string | undefined
    const timeoutMs = (input.timeoutMs as number) || 5000

    if (!selector) {
      return { ok: false, output: {}, error: 'selector required' }
    }

    try {
      switch (action) {
        case 'query': {
          const el = await ctx.query(selector)
          if (!el) {
            ctx.emitTelemetry({
              type: 'selector_miss',
              moduleId: 'selector',
              data: { selector },
              ts: Date.now(),
            })
            return { ok: false, output: {}, error: `Element not found: ${selector}` }
          }
          ctx.emitTelemetry({
            type: 'selector_hit',
            moduleId: 'selector',
            data: { selector },
            ts: Date.now(),
          })
          return {
            ok: true,
            output: {
              action: 'query',
              elements: [{ tagName: el.tagName, text: el.text, attributes: el.attributes }],
            },
          }
        }
        case 'query_all': {
          const els = await ctx.queryAll(selector)
          ctx.emitTelemetry({
            type: 'selector_hit',
            moduleId: 'selector',
            data: { selector, count: els.length },
            ts: Date.now(),
          })
          return {
            ok: true,
            output: {
              action: 'query_all',
              elements: els.map((e) => ({
                tagName: e.tagName,
                text: e.text,
                attributes: e.attributes,
              })),
            },
          }
        }
        case 'wait_for': {
          const el = await ctx.waitFor(selector, timeoutMs)
          if (!el) {
            ctx.emitTelemetry({
              type: 'selector_miss',
              moduleId: 'selector',
              data: { selector, timeoutMs },
              ts: Date.now(),
            })
            return { ok: false, output: {}, error: `Timeout waiting for: ${selector}` }
          }
          ctx.emitTelemetry({
            type: 'selector_hit',
            moduleId: 'selector',
            data: { selector },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'wait_for' } }
        }
        case 'click': {
          const el = await ctx.query(selector)
          if (!el) {
            ctx.emitTelemetry({
              type: 'selector_miss',
              moduleId: 'selector',
              data: { selector, action: 'click' },
              ts: Date.now(),
            })
            return { ok: false, output: {}, error: `Cannot click: element not found: ${selector}` }
          }
          ctx.emitTelemetry({
            type: 'dom_interaction',
            moduleId: 'selector',
            data: { action: 'click', selector },
            ts: Date.now(),
          })
          return { ok: true, output: { action: 'click' } }
        }
        case 'get_text': {
          const el = await ctx.query(selector)
          if (!el) return { ok: false, output: {}, error: `Element not found: ${selector}` }
          return { ok: true, output: { action: 'get_text', text: el.text } }
        }
        case 'get_attribute': {
          if (!attribute)
            return { ok: false, output: {}, error: 'attribute required for get_attribute' }
          const el = await ctx.query(selector)
          if (!el) return { ok: false, output: {}, error: `Element not found: ${selector}` }
          const value = el.attributes[attribute] ?? null
          return { ok: true, output: { action: 'get_attribute', attribute, value } }
        }
        default: {
          return { ok: false, output: {}, error: `Unknown action: ${action}` }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      ctx.emitTelemetry({
        type: 'error',
        moduleId: 'selector',
        data: { action, message },
        ts: Date.now(),
      })
      return { ok: false, output: {}, error: message }
    }
  },
}

export default selectorModule
