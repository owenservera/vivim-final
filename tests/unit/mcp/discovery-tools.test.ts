import { beforeEach, describe, expect, test } from 'bun:test'
import { CapabilityShapeRegistry } from '../../../src/engines/capability-shape-registry.js'
import { ManifestInferenceEngine } from '../../../src/engines/manifest-inference.js'
import { ProviderDiscoveryEngine } from '../../../src/engines/provider-discovery.js'
import { type DiscoveryMcpServer, createDiscoveryMcpServer } from '../../../src/mcp/server.js'

function makeGovernor() {
  const domJson = JSON.stringify({
    url: 'https://chat.example.com',
    title: 'Chat',
    forms: 0,
    inputs: [],
    buttons: [{ text: 'Send', selector: 'button' }],
    textareas: 1,
    hasCodeEditor: false,
    hasCanvas: false,
    links: [],
    images: [],
  })
  return {
    ensureRunning: async () => ({ slaveId: 's1' }),
    cdp: {
      send: async (_slaveId: string, _method: string, params?: Record<string, unknown>) => {
        const expr = (params as Record<string, unknown>)?.expression as string | undefined
        if (expr === 'document.readyState') return { result: { value: 'complete' } }
        if (expr?.includes('location.href')) return { result: { value: domJson } }
        if (_method === 'Page.navigate') return {}
        return { result: { value: domJson } }
      },
    },
  } as never
}

function makeEventBus() {
  return { emit: () => {} } as never
}

describe('Discovery MCP Server', () => {
  let server: DiscoveryMcpServer
  let discoveryEngine: ProviderDiscoveryEngine

  beforeEach(async () => {
    const governor = makeGovernor()
    const shapeRegistry = new CapabilityShapeRegistry()
    const eventBus = makeEventBus()
    discoveryEngine = new ProviderDiscoveryEngine(
      governor,
      shapeRegistry,
      null,
      null,
      null,
      eventBus,
    )
    const manifestInference = new ManifestInferenceEngine()

    server = await createDiscoveryMcpServer({
      discoveryEngine,
      manifestInference,
      shapeRegistry,
      providerRegistrar: null as never,
    })
  })

  test('registers all 27 tools', () => {
    const tools = server.listTools()
    expect(tools.length).toBe(27)
  })

  test('discover_start creates session', async () => {
    const result = await server.callTool('discover_start', { url: 'https://example.com' })
    expect(result.isError).toBeFalsy()
    const session = JSON.parse(result.content[0]!.text)
    expect(session.id).toBeTruthy()
    expect(session.status).toBe('started')
  })

  test('discover_get_session returns error for missing session', async () => {
    const result = await server.callTool('discover_get_session', { sessionId: 'unknown' })
    expect(result.isError).toBe(true)
  })

  test('discover_approve registers provider', async () => {
    const created = await server.callTool('discover_start', { url: 'https://chat.example.com' })
    const session = JSON.parse(created.content[0]!.text)

    await server.callTool('discover_navigate', {
      sessionId: session.id,
      url: 'https://chat.example.com',
    })

    const result = await server.callTool('discover_approve', { sessionId: session.id })
    expect(result.isError).toBeFalsy()
    const data = JSON.parse(result.content[0]!.text)
    expect(data.providerId).toBeTruthy()
  })

  test('discover_list_sessions returns array', async () => {
    await server.callTool('discover_start', { url: 'https://a.com' })
    await server.callTool('discover_start', { url: 'https://b.com' })
    const result = await server.callTool('discover_list_sessions', {})
    const sessions = JSON.parse(result.content[0]!.text)
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBeGreaterThanOrEqual(2)
  })

  test('unknown tool returns error', async () => {
    const result = await server.callTool('nonexistent_tool', {})
    expect(result.isError).toBe(true)
  })
})
