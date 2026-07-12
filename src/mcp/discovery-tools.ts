// src/mcp/discovery-tools.ts
// MCP discovery tools — Phase 22.10-22.15

import type { DiscoveryMcpServer } from './server.js'
import type { DiscoveryServerContext } from './types.js'

export function registerDiscoveryTools(
  server: DiscoveryMcpServer,
  ctx: DiscoveryServerContext,
): void {
  // ── 22.10: Session + Navigation (6 tools) ──────────────────────────

  server.tool(
    'discover_start',
    'Start a provider discovery session for a URL',
    { url: 'string', shapeHint: 'string?', providerNameHint: 'string?' },
    async (args) => {
      const session = await ctx.discoveryEngine.createSession(args.url as string, {
        shapeHint: args.shapeHint as string | undefined,
        providerNameHint: args.providerNameHint as string | undefined,
      })
      return { content: [{ type: 'text', text: JSON.stringify(session) }] }
    },
  )

  server.tool(
    'discover_get_session',
    'Get current state of a discovery session',
    { sessionId: 'string' },
    async (args) => {
      const session = await ctx.discoveryEngine.getSession(args.sessionId as string)
      if (!session) {
        return { content: [{ type: 'text', text: 'Session not found' }], isError: true }
      }
      return { content: [{ type: 'text', text: JSON.stringify(session) }] }
    },
  )

  server.tool(
    'discover_list_sessions',
    'List all discovery sessions with optional status filter',
    { status: 'string?', limit: 'number?' },
    async (args) => {
      const sessions = await ctx.discoveryEngine.listSessions({
        status: args.status as string | undefined,
        limit: args.limit as number | undefined,
      })
      return { content: [{ type: 'text', text: JSON.stringify(sessions) }] }
    },
  )

  server.tool(
    'discover_delete_session',
    'Delete a discovery session',
    { sessionId: 'string' },
    async (args) => {
      await ctx.discoveryEngine.deleteSession(args.sessionId as string)
      return { content: [{ type: 'text', text: 'Session deleted' }] }
    },
  )

  server.tool(
    'discover_navigate',
    'Navigate Chrome to a URL within a session',
    { sessionId: 'string', url: 'string' },
    async (args) => {
      const state = await ctx.discoveryEngine.navigate(args.sessionId as string, args.url as string)
      return { content: [{ type: 'text', text: JSON.stringify(state) }] }
    },
  )

  server.tool(
    'discover_page_state',
    'Get current page state for a session',
    { sessionId: 'string' },
    async (args) => {
      const state = await ctx.discoveryEngine.getPageState(args.sessionId as string)
      return { content: [{ type: 'text', text: JSON.stringify(state) }] }
    },
  )

  // ── 22.11: DOM + Interaction (7 tools) ─────────────────────────────

  server.tool(
    'discover_get_dom',
    'Get DOM snapshot of the current page',
    { sessionId: 'string' },
    async (args) => {
      const snapshot = await ctx.discoveryEngine.getDomSnapshot(args.sessionId as string)
      return { content: [{ type: 'text', text: JSON.stringify(snapshot) }] }
    },
  )

  server.tool(
    'discover_a11y_tree',
    'Get accessibility tree of the current page',
    { sessionId: 'string' },
    async (args) => {
      const tree = await ctx.discoveryEngine.getAccessibilityTree(args.sessionId as string)
      return { content: [{ type: 'text', text: JSON.stringify(tree) }] }
    },
  )

  server.tool(
    'discover_evaluate',
    'Evaluate a JavaScript expression in the page context',
    { sessionId: 'string', expression: 'string' },
    async (args) => {
      const result = await ctx.discoveryEngine.evaluate(
        args.sessionId as string,
        args.expression as string,
      )
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.tool(
    'discover_click',
    'Click an element by CSS selector',
    { sessionId: 'string', selector: 'string', waitAfterMs: 'number?' },
    async (args) => {
      const result = await ctx.discoveryEngine.click(
        args.sessionId as string,
        args.selector as string,
        {
          waitAfterMs: args.waitAfterMs as number | undefined,
        },
      )
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.tool(
    'discover_type',
    'Type text into an element by CSS selector',
    { sessionId: 'string', selector: 'string', text: 'string', submit: 'boolean?' },
    async (args) => {
      const result = await ctx.discoveryEngine.type(
        args.sessionId as string,
        args.selector as string,
        args.text as string,
        {
          submit: args.submit as boolean | undefined,
        },
      )
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.tool(
    'discover_scroll',
    'Scroll the page in a direction',
    { sessionId: 'string', direction: 'string', amount: 'number?' },
    async (args) => {
      await ctx.discoveryEngine.scroll(
        args.sessionId as string,
        args.direction as 'up' | 'down' | 'left' | 'right',
        args.amount as number | undefined,
      )
      return { content: [{ type: 'text', text: 'Scrolled' }] }
    },
  )

  server.tool(
    'discover_hover',
    'Hover over an element by CSS selector',
    { sessionId: 'string', selector: 'string' },
    async (args) => {
      await ctx.discoveryEngine.hover(args.sessionId as string, args.selector as string)
      return { content: [{ type: 'text', text: 'Hovered' }] }
    },
  )

  // ── 22.12: Network Observation (4 tools) ───────────────────────────

  server.tool(
    'discover_observe_start',
    'Start network observation for a session',
    { sessionId: 'string', pattern: 'string?' },
    async (args) => {
      await ctx.discoveryEngine.startObservation(
        args.sessionId as string,
        args.pattern as string | undefined,
      )
      return { content: [{ type: 'text', text: 'Observation started' }] }
    },
  )

  server.tool(
    'discover_observe_stop',
    'Stop network observation for a session',
    { sessionId: 'string' },
    async (args) => {
      await ctx.discoveryEngine.stopObservation(args.sessionId as string)
      return { content: [{ type: 'text', text: 'Observation stopped' }] }
    },
  )

  server.tool(
    'discover_observe_list',
    'List network observations for a session',
    { sessionId: 'string', limit: 'number?' },
    async (args) => {
      const obs = await ctx.discoveryEngine.getObservations(args.sessionId as string, {
        limit: args.limit as number | undefined,
      })
      return { content: [{ type: 'text', text: JSON.stringify(obs) }] }
    },
  )

  server.tool(
    'discover_intercept',
    'Intercept a network response matching a pattern',
    { sessionId: 'string', pattern: 'string', timeoutMs: 'number?' },
    async (args) => {
      const body = await ctx.discoveryEngine.interceptResponse(
        args.sessionId as string,
        args.pattern as string,
        args.timeoutMs as number | undefined,
      )
      return { content: [{ type: 'text', text: body || 'No matching response' }] }
    },
  )

  // ── 22.13: Analysis + Manifest (6 tools) ───────────────────────────

  server.tool(
    'discover_match_shape',
    'Match the page DOM against known capability shapes',
    { sessionId: 'string' },
    async (args) => {
      const match = await ctx.discoveryEngine.matchShape(args.sessionId as string)
      return { content: [{ type: 'text', text: match ? JSON.stringify(match) : 'No shape match' }] }
    },
  )

  server.tool(
    'discover_infer_capabilities',
    'Infer capabilities from the page DOM',
    { sessionId: 'string' },
    async (args) => {
      const caps = await ctx.discoveryEngine.inferCapabilities(args.sessionId as string)
      return { content: [{ type: 'text', text: JSON.stringify(caps) }] }
    },
  )

  server.tool(
    'detect_parser_format',
    'Detect the parser format for the current page',
    { sessionId: 'string' },
    async (args) => {
      const format = await ctx.discoveryEngine.detectParserFormat(args.sessionId as string)
      return { content: [{ type: 'text', text: format ?? 'unknown' }] }
    },
  )

  server.tool(
    'discover_generate_manifest',
    'Generate a provider manifest draft from the discovery session',
    { sessionId: 'string' },
    async (args) => {
      const manifest = await ctx.discoveryEngine.generateManifest(args.sessionId as string)
      return { content: [{ type: 'text', text: JSON.stringify(manifest) }] }
    },
  )

  server.tool(
    'discover_validate_manifest',
    'Validate a provider manifest',
    { manifest: 'object' },
    async (args) => {
      const result = await ctx.discoveryEngine.validateManifest(args.manifest)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.tool(
    'discover_edit_manifest',
    'Edit a manifest draft with specific changes',
    { sessionId: 'string', edits: 'object' },
    async (args) => {
      const manifest = await ctx.discoveryEngine.editManifest(
        args.sessionId as string,
        args.edits as Record<string, unknown>,
      )
      return { content: [{ type: 'text', text: JSON.stringify(manifest) }] }
    },
  )

  // ── 22.14: Parser Testing (2 tools) ────────────────────────────────

  server.tool(
    'discover_test_parser',
    'Test parser against a provider URL',
    { sessionId: 'string', url: 'string' },
    async (args) => {
      const session = await ctx.discoveryEngine.getSession(args.sessionId as string)
      if (!session) {
        return { content: [{ type: 'text', text: 'Session not found' }], isError: true }
      }
      const format = await ctx.discoveryEngine.detectParserFormat(args.sessionId as string)
      return { content: [{ type: 'text', text: JSON.stringify({ format, url: args.url }) }] }
    },
  )

  server.tool(
    'discover_capture_response',
    'Capture a network response for parser testing',
    { sessionId: 'string', pattern: 'string' },
    async (args) => {
      const body = await ctx.discoveryEngine.interceptResponse(
        args.sessionId as string,
        args.pattern as string,
        5000,
      )
      return { content: [{ type: 'text', text: body || 'No response captured' }] }
    },
  )

  // ── 22.15: Registration (2 tools) ──────────────────────────────────

  server.tool(
    'discover_approve',
    'Approve a discovery session and register the provider',
    { sessionId: 'string' },
    async (args) => {
      const result = await ctx.discoveryEngine.approve(args.sessionId as string)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.tool(
    'discover_reject',
    'Reject a discovery session',
    { sessionId: 'string', reason: 'string' },
    async (args) => {
      await ctx.discoveryEngine.reject(args.sessionId as string, args.reason as string)
      return { content: [{ type: 'text', text: 'Session rejected' }] }
    },
  )
}
