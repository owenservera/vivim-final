import { describe, expect, test } from 'bun:test'
import { BrowserCapabilityRegistry } from '../../../src/engines/browser-automation/registry.js'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import { buildConvenienceTools, buildTools } from '../../../src/mcp/browser-tools.js'
import type { ToolCtx } from '../../../src/mcp/browser-tools.js'

/**
 * Minimal governor stub — BrowserCapabilityRegistry only touches the governor
 * inside handlers, so registration + tool mapping need no real Chrome.
 */
function makeStubGovernor(): ChromeGovernor {
  return {
    evaluate: async () => false,
  } as unknown as ChromeGovernor
}

function makeCtx(): ToolCtx {
  return {
    getSlaveId: async () => 'generic:default:abc',
    registry: null as never,
    governor: null as never,
    session: null as never,
  }
}

describe('buildTools (Layer 1 registry mapping)', () => {
  const registry = new BrowserCapabilityRegistry(makeStubGovernor(), null as never)
  const tools = buildTools(registry, makeCtx())

  test('produces exactly one tool per registry capability', () => {
    expect(tools.length).toBe(registry.list().length)
    expect(tools.length).toBeGreaterThan(100)
  })

  test('tool names transform auto:<axis>:<action> → browser_<axis>_<action>', () => {
    const names = new Set(tools.map((t) => t.name))
    for (const def of registry.list()) {
      const [axis, action] = def.id.split(':').slice(1)
      expect(names.has(`browser_${axis}_${action}`)).toBe(true)
    }
  })

  test('known capabilities map to expected tool names', () => {
    const names = new Set(tools.map((t) => t.name))
    expect(names.has('browser_nav_navigate')).toBe(true)
    expect(names.has('browser_input_click')).toBe(true)
    expect(names.has('browser_extract_markdown')).toBe(true)
    expect(names.has('browser_tab_open')).toBe(true)
    expect(names.has('browser_wait_wait-selector')).toBe(true)
  })

  test('description copied from def.description', () => {
    const tool = tools.find((t) => t.name === 'browser_nav_navigate')!
    const def = registry.resolve('auto:nav:navigate')
    expect(tool.description).toBe(def.description)
  })

  test('input schema is JSON-Schema-derived from def.params', () => {
    const tool = tools.find((t) => t.name === 'browser_wait_wait-selector')!
    expect(tool.inputSchema.type).toBe('object')
    expect((tool.inputSchema.properties as Record<string, unknown>).selector).toEqual({
      type: 'string',
    })
    expect((tool.inputSchema.properties as Record<string, unknown>).timeoutMs).toEqual({
      type: 'number',
      default: 5000,
    })
    expect(tool.inputSchema.required).toEqual(['selector'])
  })

  test('meta carries axis, id, and trust metadata', () => {
    const tool = tools.find((t) => t.name === 'browser_nav_navigate')!
    expect(tool.meta?.axis).toBe('nav')
    expect(tool.meta?.id).toBe('auto:nav:navigate')
    expect(tool.meta?.trust).toBeTruthy()
  })

  test('handler invokes the registry and returns CapResult as text', async () => {
    const tool = tools.find((t) => t.name === 'browser_wait_wait-fixed')!
    const result = await tool.handler({ ms: 1 })
    expect(result.isError).toBeFalsy()
    expect(result.content[0]?.type).toBe('text')
    const payload = JSON.parse(result.content[0]?.text ?? '{}')
    expect(payload.ok).toBe(true)
  })

  test('handler surfaces capability errors as isError', async () => {
    // wait-selector against a stub governor whose evaluate returns false → timeout
    const registry2 = new BrowserCapabilityRegistry(makeStubGovernor(), null as never)
    const tools2 = buildTools(registry2, makeCtx())
    const tool = tools2.find((t) => t.name === 'browser_wait_wait-selector')!
    const result = await tool.handler({ selector: '#never', timeoutMs: 1 })
    expect(result.isError).toBe(true)
  })
})

// ── Layer 2 convenience tools ────────────────────────────────────────────────

const SERP_HTML = `
<div class="g uEierd" data-text-ad="1"><h3>Sponsored ad</h3><a href="/url?q=ads">buy</a></div>
<div class="g">
  <h3>opencode - The AI Agent</h3>
  <a href="/url?q=https%3A%2F%2Fopencode.example.com%2F"><h3>opencode</h3></a>
  <div class="VwiC3b">An open-source AI coding agent.</div>
</div>
`

/** Governor stub that answers evaluate with the SERP html and records calls. */
function makeSerpGovernor(): ChromeGovernor {
  const calls: string[] = []
  return {
    calls,
    evaluate: async (_id: string, expr: string) => {
      calls.push(expr)
      if (expr.includes('outerHTML')) return SERP_HTML
      return null
    },
    captureScreenshot: async () => 'iVBORw0KGgo=' as unknown as string,
  } as unknown as ChromeGovernor
}

function makeFullCtx(governor: ChromeGovernor): ToolCtx {
  const registry = new BrowserCapabilityRegistry(governor, null as never)
  let quitCalls = 0
  const ctx: ToolCtx = {
    getSlaveId: async () => 'generic:default:abc',
    registry,
    governor,
    session: {
      status: async () => ({
        url: 'https://opencode.example.com/',
        title: 'opencode',
        readyState: 'complete',
      }),
      quit: async () => {
        quitCalls += 1
        return { ok: true }
      },
    },
  }
  return Object.assign(ctx, { quitCalls: () => quitCalls })
}

describe('buildConvenienceTools (Layer 2)', () => {
  test('registers the 7 documented convenience tools', () => {
    const gov = makeSerpGovernor()
    const tools = buildConvenienceTools(makeFullCtx(gov))
    const names = tools.map((t) => t.name).sort()
    expect(names).toEqual(
      [
        'google_search',
        'browser_open',
        'browser_extract',
        'browser_screenshot',
        'browser_list_caps',
        'browser_status',
        'browser_quit',
      ].sort(),
    )
  })

  test('google_search navigates to google and returns parsed organic results', async () => {
    const gov = makeSerpGovernor()
    const tools = buildConvenienceTools(makeFullCtx(gov))
    const tool = tools.find((t) => t.name === 'google_search')!
    const result = await tool.handler({ query: 'opencode', numResults: 10 })
    expect(result.isError).toBeFalsy()
    const payload = JSON.parse(result.content[0]?.text ?? '[]')
    expect(payload.length).toBe(1)
    expect(payload[0]!.title).toBe('opencode - The AI Agent')
    expect(payload[0]!.url).toBe('https://opencode.example.com/')
    expect(payload[0]!.snippet).toContain('open-source')
    // must have hit the nav capability + the html extraction
    expect(gov.calls.length).toBeGreaterThan(1)
  })

  test('browser_open invokes the navigate capability', async () => {
    const gov = makeSerpGovernor()
    const tools = buildConvenienceTools(makeFullCtx(gov))
    const tool = tools.find((t) => t.name === 'browser_open')!
    const result = await tool.handler({ url: 'https://example.com/' })
    expect(result.isError).toBeFalsy()
    const payload = JSON.parse(result.content[0]?.text ?? '{}')
    expect(payload.ok).toBe(true)
  })

  test('browser_extract returns page markdown text', async () => {
    const gov = makeSerpGovernor()
    const tools = buildConvenienceTools(makeFullCtx(gov))
    const tool = tools.find((t) => t.name === 'browser_extract')!
    const result = await tool.handler({})
    expect(result.isError).toBeFalsy()
    expect(result.content[0]?.type).toBe('text')
  })

  test('browser_screenshot returns base64 data', async () => {
    const gov = makeSerpGovernor()
    const tools = buildConvenienceTools(makeFullCtx(gov))
    const tool = tools.find((t) => t.name === 'browser_screenshot')!
    const result = await tool.handler({})
    expect(result.isError).toBeFalsy()
    expect(result.content[0]?.text).toContain('iVBORw0KGgo=')
  })

  test('browser_list_caps reports capability ids', async () => {
    const gov = makeSerpGovernor()
    const tools = buildConvenienceTools(makeFullCtx(gov))
    const tool = tools.find((t) => t.name === 'browser_list_caps')!
    const result = await tool.handler({})
    expect(result.isError).toBeFalsy()
    const payload = JSON.parse(result.content[0]?.text ?? '[]')
    expect(payload.some((c: { id: string }) => c.id === 'auto:nav:navigate')).toBe(true)
  })

  test('browser_status reports the session state', async () => {
    const gov = makeSerpGovernor()
    const tools = buildConvenienceTools(makeFullCtx(gov))
    const tool = tools.find((t) => t.name === 'browser_status')!
    const result = await tool.handler({})
    expect(result.isError).toBeFalsy()
    const payload = JSON.parse(result.content[0]?.text ?? '{}')
    expect(payload.url).toBe('https://opencode.example.com/')
  })

  test('browser_quit closes the session', async () => {
    const gov = makeSerpGovernor()
    const ctx = makeFullCtx(gov) as ToolCtx & { quitCalls: () => number }
    const tools = buildConvenienceTools(ctx)
    const tool = tools.find((t) => t.name === 'browser_quit')!
    const result = await tool.handler({})
    expect(result.isError).toBeFalsy()
    expect(ctx.quitCalls()).toBe(1)
  })

  test('handler errors surface as isError', async () => {
    const gov = {
      evaluate: async () => {
        throw new Error('cdp unavailable')
      },
    } as unknown as ChromeGovernor
    const tools = buildConvenienceTools(makeFullCtx(gov))
    const tool = tools.find((t) => t.name === 'browser_extract')!
    const result = await tool.handler({})
    expect(result.isError).toBe(true)
  })
})
