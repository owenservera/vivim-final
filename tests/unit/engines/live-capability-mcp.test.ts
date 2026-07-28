// tests/unit/engines/live-capability-mcp.test.ts
// Unit 2.9 — LiveCapabilityRegistry MCP handler kind.

import { describe, expect, it } from 'bun:test'
import {
  type LiveCapabilityRecord,
  LiveCapabilityRegistry,
  type LiveCapabilitySpec,
  type LiveCapabilityStore,
} from '../../../src/engines/live-capability-registry.js'
import type { McpClientAdapter, ToolResult } from '../../../src/engines/mcp-client-adapter.js'
import { EngineError } from '../../../src/errors.js'

// ── Mock MCP client (in-memory, records calls) ──────────────────────────────

class MockMcp {
  connects: string[] = []
  disconnects: string[] = []
  calls: Array<{ serverId: string; toolName: string; input: Record<string, unknown> }> = []
  connected = new Set<string>()
  next: ToolResult = { content: { ok: true }, isError: false }

  isConnected(serverId: string): boolean {
    return this.connected.has(serverId)
  }

  asAdapter(): McpClientAdapter {
    return {
      connect: async (serverId: string, _url: string) => {
        this.connects.push(serverId)
        this.connected.add(serverId)
      },
      disconnect: async (serverId: string) => {
        this.disconnects.push(serverId)
        this.connected.delete(serverId)
      },
      isConnected: (serverId: string) => this.connected.has(serverId),
      callTool: async (serverId: string, toolName: string, input: Record<string, unknown>) => {
        this.calls.push({ serverId, toolName, input })
        return this.next
      },
      listTools: async () => [],
      getConnections: () => [],
    } as unknown as McpClientAdapter
  }
}

// ── In-memory live store ─────────────────────────────────────────────────────

function makeStore(): LiveCapabilityStore {
  const map = new Map<string, LiveCapabilityRecord>()
  return {
    async create(r) {
      map.set(r.id, r)
    },
    async listActive() {
      return [...map.values()].filter((r) => r.isActive)
    },
    async get(id) {
      return map.get(id) ?? null
    },
    async revoke(id) {
      const r = map.get(id)
      if (r) r.isActive = false
    },
  }
}

class SilentBus {
  emit() {}
}

const mcpSpec: LiveCapabilitySpec = {
  slug: 'mcp_cap',
  name: 'MCP Cap',
  description: 'delegates to an external MCP tool',
  handlerSpec: { kind: 'mcp', serverId: 'srv-1', toolName: 'do_thing', url: 'http://mcp.local' },
  inputSchema: { type: 'object' },
  surfaces: ['cli', 'api'],
  registeredBy: 'tester',
}

describe('LiveCapabilityRegistry — mcp handler', () => {
  it('invokes callTool with the configured serverId/toolName/input', async () => {
    const mcp = new MockMcp()
    const reg = new LiveCapabilityRegistry(
      makeStore(),
      new SilentBus() as never,
      undefined,
      mcp.asAdapter(),
    )
    const id = await reg.registerLive(mcpSpec)
    // biome-ignore lint/style/noNonNullAssertion: capability was just registered above
    const cap = reg.get(`live:${id}`)!
    const out = await cap.handler?.({ a: 1 }, {} as any)
    expect(mcp.calls).toHaveLength(1)
    expect(mcp.calls[0]).toMatchObject({ serverId: 'srv-1', toolName: 'do_thing', input: { a: 1 } })
    expect(out).toEqual({ ok: true })
  })

  it('lazily connects then reuses the warm connection across invocations', async () => {
    const mcp = new MockMcp()
    const reg = new LiveCapabilityRegistry(
      makeStore(),
      new SilentBus() as never,
      undefined,
      mcp.asAdapter(),
    )
    const id = await reg.registerLive(mcpSpec)
    // biome-ignore lint/style/noNonNullAssertion: capability was just registered above
    const cap = reg.get(`live:${id}`)!
    await cap.handler?.({ x: 1 }, {} as any)
    await cap.handler?.({ x: 2 }, {} as any)
    expect(mcp.connects).toEqual(['srv-1']) // connected once, reused
    expect(mcp.calls).toHaveLength(2)
  })

  it('disconnects the MCP connection on revoke', async () => {
    const mcp = new MockMcp()
    const reg = new LiveCapabilityRegistry(
      makeStore(),
      new SilentBus() as never,
      undefined,
      mcp.asAdapter(),
    )
    const id = await reg.registerLive(mcpSpec)
    // biome-ignore lint/style/noNonNullAssertion: capability was just registered above
    const cap = reg.get(`live:${id}`)!
    await cap.handler?.({}, {} as any) // establishes connection
    expect(mcp.isConnected('srv-1')).toBe(true)
    await reg.revokeLive(id)
    expect(mcp.disconnects).toEqual(['srv-1'])
    expect(mcp.isConnected('srv-1')).toBe(false)
  })

  it('surfaces an MCP tool failure (isError) as a capability error', async () => {
    const mcp = new MockMcp()
    mcp.next = { content: { error: 'boom' }, isError: true }
    const reg = new LiveCapabilityRegistry(
      makeStore(),
      new SilentBus() as never,
      undefined,
      mcp.asAdapter(),
    )
    const id = await reg.registerLive(mcpSpec)
    // biome-ignore lint/style/noNonNullAssertion: capability was just registered above
    const cap = reg.get(`live:${id}`)!
    await expect(cap.handler?.({}, {} as any)).rejects.toThrow(EngineError)
  })

  it('throws when no McpClientAdapter is wired', async () => {
    const reg = new LiveCapabilityRegistry(makeStore(), new SilentBus() as never)
    const id = await reg.registerLive(mcpSpec)
    // biome-ignore lint/style/noNonNullAssertion: capability was just registered above
    const cap = reg.get(`live:${id}`)!
    await expect(cap.handler?.({}, {} as any)).rejects.toThrow(/requires an McpClientAdapter/)
  })
})
