// tests/unit/engines/unified-registry.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import {
  type CapabilityContext,
  type UnifiedCapability,
  UnifiedCapabilityRegistry,
} from '../../../src/engines/unified-registry.js'

function makeCapability(overrides?: Partial<UnifiedCapability>): UnifiedCapability {
  return {
    id: 'test-cap',
    slug: 'test-cap',
    name: 'Test Capability',
    description: 'A test capability',
    category: 'testing',
    surfaces: ['cli', 'ui'],
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    outputSchema: { type: 'object' },
    handler: async (input) => ({ result: `hello ${input.name}` }),
    cliCommand: { name: 'test', aliases: ['t'], examples: ['test --name world'] },
    uiAction: { component: 'TestButton', position: 'toolbar', order: 1 },
    isAsync: true,
    requiresConfirmation: false,
    tags: ['demo'],
    ...overrides,
  }
}

const ctx: CapabilityContext = { metadata: {} }

describe('UnifiedCapabilityRegistry', () => {
  let registry: UnifiedCapabilityRegistry

  beforeEach(() => {
    registry = new UnifiedCapabilityRegistry()
  })

  it('register -> appears in list', () => {
    registry.register(makeCapability())
    const list = registry.list()
    expect(list.length).toBe(1)
    expect(list[0]!.id).toBe('test-cap')
  })

  it('execute with valid input -> handler called', async () => {
    registry.register(makeCapability())
    const result = await registry.execute('test-cap', { name: 'world' }, ctx)
    expect(result).toEqual({ result: 'hello world' })
  })

  it('execute with invalid input -> validation error', async () => {
    registry.register(makeCapability())
    await expect(registry.execute('test-cap', {}, ctx)).rejects.toThrow(
      'Missing required input: name',
    )
  })

  it('filter by surface returns correct subset', () => {
    registry.register(makeCapability({ id: 'a', slug: 'a', surfaces: ['cli'] }))
    registry.register(makeCapability({ id: 'b', slug: 'b', surfaces: ['ui'] }))
    registry.register(makeCapability({ id: 'c', slug: 'c', surfaces: ['cli', 'ui'] }))
    const cliCaps = registry.list({ surface: 'cli' })
    expect(cliCaps.length).toBe(2)
    expect(cliCaps.map((c) => c.id)).toContain('a')
    expect(cliCaps.map((c) => c.id)).toContain('c')
  })

  it('export for CLI produces correct format', () => {
    registry.register(makeCapability())
    const cli = registry.exportForCli()
    expect(cli.length).toBe(1)
    expect(cli[0]!.name).toBe('test')
    expect(cli[0]!.description).toBe('A test capability')
  })

  it('export for MCP produces correct format', () => {
    registry.register(
      makeCapability({
        surfaces: ['mcp'],
        mcpToolName: 'mcp_test',
      }),
    )
    const mcp = registry.exportForMcp()
    expect(mcp.length).toBe(1)
    expect(mcp[0]!.name).toBe('mcp_test')
    expect(mcp[0]!.inputSchema).toBeDefined()
  })

  it('get by id returns capability', () => {
    registry.register(makeCapability())
    expect(registry.get('test-cap')).not.toBeNull()
    expect(registry.get('nonexistent')).toBeNull()
  })

  it('get by slug returns capability', () => {
    registry.register(makeCapability())
    expect(registry.getBySlug('test-cap')).not.toBeNull()
  })

  it('unregister removes capability', () => {
    registry.register(makeCapability())
    registry.unregister('test-cap')
    expect(registry.get('test-cap')).toBeNull()
  })

  it('duplicate registration throws', () => {
    registry.register(makeCapability())
    expect(() => registry.register(makeCapability())).toThrow('already registered')
  })

  it('filter by category', () => {
    registry.register(makeCapability({ id: 'a', slug: 'a', category: 'cat1' }))
    registry.register(makeCapability({ id: 'b', slug: 'b', category: 'cat2' }))
    expect(registry.list({ category: 'cat1' }).length).toBe(1)
  })

  it('filter by tag', () => {
    registry.register(makeCapability({ id: 'a', slug: 'a', tags: ['important'] }))
    registry.register(makeCapability({ id: 'b', slug: 'b', tags: ['minor'] }))
    expect(registry.list({ tag: 'important' }).length).toBe(1)
  })
})
