// src/mcp/browser-tools.ts
// Layer 1: maps every BrowserCapabilityRegistry capability to an MCP tool
// (`browser_<axis>_<action>`). Layer 2 (convenience tools) is added here too
// (google_search, browser_open, browser_extract, browser_screenshot,
// browser_list_caps, browser_status, browser_quit) — see buildConvenienceTools.

import { z } from 'zod'
import type { BrowserCapabilityRegistry } from '../engines/browser-automation/registry.js'
import type { ChromeGovernor } from '../engines/chrome-governor.js'
import { parseGoogleSerp } from './serp-parser.js'
import type { McpTool } from './types.js'
import { zodToJsonSchema } from './zod-schema.js'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Context a tool handler needs at call time (slave resolved by the session). */
export interface ToolCtx {
  getSlaveId: () => Promise<string>
  registry: BrowserCapabilityRegistry
  governor: ChromeGovernor
  session: { status: () => Promise<Record<string, unknown>>; quit: () => Promise<unknown> }
}

/**
 * Layer 1 — one MCP tool per registry capability.
 * Tool name `browser_<axis>_<action>`; schema + description from the def;
 * handler routes through registry.invoke with the session-resolved slaveId.
 */
export function buildTools(registry: BrowserCapabilityRegistry, ctx: ToolCtx): McpTool[] {
  return registry.list().map((def) => {
    const [axis, action] = def.id.split(':').slice(1)
    return {
      name: `browser_${axis}_${action}`,
      description: def.description,
      inputSchema: zodToJsonSchema(def.params),
      meta: { axis, id: def.id, trust: { ...def.trust } },
      handler: async (args) => {
        try {
          const slaveId = await ctx.getSlaveId()
          const result = await registry.invoke(def.id, args, { slaveId })
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.ok,
          }
        } catch (err) {
          return {
            content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
            isError: true,
          }
        }
      },
    }
  })
}

/**
 * Layer 2 — ergonomic convenience tools layered on top of the raw capability
 * mapping. These are the tools an LLM agent most likely wants: search the web,
 * open a URL, extract page text, screenshot, introspect the registry/session.
 */
export function buildConvenienceTools(ctx: ToolCtx): McpTool[] {
  const invoke = async (
    capabilityId: string,
    args: Record<string, unknown>,
  ): Promise<{ ok: boolean; output?: unknown; detail?: string; error?: string }> => {
    const slaveId = await ctx.getSlaveId()
    return ctx.registry.invoke(capabilityId, args, { slaveId })
  }

  return [
    {
      name: 'google_search',
      description:
        'Search Google and return parsed organic results (rank, title, url, snippet). Navigates the shared browser tab.',
      inputSchema: zodToJsonSchema(
        z.object({
          query: z.string().describe('Search query'),
          numResults: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .describe('Results to request (default 10)'),
          lang: z
            .string()
            .optional()
            .describe('Google hl parameter, e.g. "en" (default) or "zh-CN"'),
        }),
      ),
      meta: { axis: 'convenience', id: 'mcp:convenience:google_search' },
      handler: async (args) => {
        try {
          const { query, numResults, lang } = args as {
            query: string
            numResults?: number
            lang?: string
          }
          const params = new URLSearchParams({ q: query, num: String(numResults ?? 10) })
          if (lang) params.set('hl', lang)
          const url = `https://www.google.com/search?${params.toString()}`
          await invoke('auto:nav:navigate', { url })
          // Google renders results async; give the page a beat to hydrate.
          await sleep(1500)
          const slaveId = await ctx.getSlaveId()
          const html = (await ctx.governor.evaluate(
            slaveId,
            'document.documentElement.outerHTML',
          )) as string
          const results = parseGoogleSerp(html)
          return {
            content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
            isError: false,
          }
        } catch (err) {
          return {
            content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
            isError: true,
          }
        }
      },
    },
    {
      name: 'browser_open',
      description: 'Open a URL in the shared browser tab (alias for navigate).',
      inputSchema: zodToJsonSchema(z.object({ url: z.string().describe('Absolute URL to open') })),
      meta: { axis: 'convenience', id: 'mcp:convenience:browser_open' },
      handler: async (args) => {
        try {
          const { url } = args as { url: string }
          const result = await invoke('auto:nav:navigate', { url })
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !result.ok,
          }
        } catch (err) {
          return {
            content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
            isError: true,
          }
        }
      },
    },
    {
      name: 'browser_extract',
      description:
        'Extract the current page body as lightweight markdown. Optionally navigates to a URL first.',
      inputSchema: zodToJsonSchema(
        z.object({ url: z.string().optional().describe('Navigate here first if set') }),
      ),
      meta: { axis: 'convenience', id: 'mcp:convenience:browser_extract' },
      handler: async (args) => {
        try {
          const { url } = args as { url?: string }
          if (url) {
            await invoke('auto:nav:navigate', { url })
            await sleep(1200)
          }
          const result = await invoke('auto:extract:markdown', {})
          const text =
            typeof result.output === 'string' ? result.output : JSON.stringify(result.output)
          return {
            content: [{ type: 'text', text }],
            isError: !result.ok,
          }
        } catch (err) {
          return {
            content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
            isError: true,
          }
        }
      },
    },
    {
      name: 'browser_screenshot',
      description: 'Capture a screenshot of the current page as base64 PNG data.',
      inputSchema: zodToJsonSchema(z.object({})),
      meta: { axis: 'convenience', id: 'mcp:convenience:browser_screenshot' },
      handler: async () => {
        try {
          const slaveId = await ctx.getSlaveId()
          const data = await ctx.governor.captureScreenshot(slaveId)
          return {
            content: [
              { type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data) },
            ],
            isError: false,
          }
        } catch (err) {
          return {
            content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
            isError: true,
          }
        }
      },
    },
    {
      name: 'browser_list_caps',
      description: 'List all registered browser automation capabilities.',
      inputSchema: zodToJsonSchema(z.object({})),
      meta: { axis: 'convenience', id: 'mcp:convenience:browser_list_caps' },
      handler: async () => {
        const caps = ctx.registry.list().map((def) => ({
          id: def.id,
          description: def.description,
        }))
        return {
          content: [{ type: 'text', text: JSON.stringify(caps, null, 2) }],
          isError: false,
        }
      },
    },
    {
      name: 'browser_status',
      description: 'Report the current browser session status (url, title, ready state).',
      inputSchema: zodToJsonSchema(z.object({})),
      meta: { axis: 'convenience', id: 'mcp:convenience:browser_status' },
      handler: async () => {
        try {
          const status = await ctx.session.status()
          return {
            content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
            isError: false,
          }
        } catch (err) {
          return {
            content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
            isError: true,
          }
        }
      },
    },
    {
      name: 'browser_quit',
      description: 'Shut down the browser session and exit the MCP server cleanly.',
      inputSchema: zodToJsonSchema(z.object({})),
      meta: { axis: 'convenience', id: 'mcp:convenience:browser_quit' },
      handler: async () => {
        try {
          await ctx.session.quit()
          return {
            content: [{ type: 'text', text: 'browser session closed' }],
            isError: false,
          }
        } catch (err) {
          return {
            content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
            isError: true,
          }
        }
      },
    },
  ]
}
