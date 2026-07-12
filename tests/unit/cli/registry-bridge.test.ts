// tests/unit/cli/registry-bridge.test.ts
import { describe, expect, it } from 'bun:test'
import { CommandRegistry } from '../../../src/cli/command-registry.js'
import { syncCliFromUnified } from '../../../src/cli/commands/registry-bridge.js'
import {
  type UnifiedCapability,
  UnifiedCapabilityRegistry,
} from '../../../src/engines/unified-registry.js'

function makeCap(id: string): UnifiedCapability {
  return {
    id,
    slug: id,
    name: `cmd-${id}`,
    description: `Command ${id}`,
    category: 'test',
    surfaces: ['cli'],
    inputSchema: { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] },
    outputSchema: { type: 'object' },
    handler: async (input) => ({ ok: true, input }),
    cliCommand: { name: `cmd-${id}`, aliases: [], examples: [] },
    isAsync: true,
    requiresConfirmation: false,
    tags: [],
  }
}

describe('syncCliFromUnified', () => {
  it('capabilities appear as CLI commands', () => {
    const unified = new UnifiedCapabilityRegistry()
    const cli = new CommandRegistry()
    unified.register(makeCap('a'))
    unified.register(makeCap('b'))
    syncCliFromUnified(unified, cli)
    const cmds = cli.list()
    expect(cmds.length).toBe(2)
    expect(cmds.map((c) => c.name)).toContain('cmd-a')
    expect(cmds.map((c) => c.name)).toContain('cmd-b')
  })

  it('CLI command execution routes to registry handler', async () => {
    const unified = new UnifiedCapabilityRegistry()
    const cli = new CommandRegistry()
    unified.register(makeCap('a'))
    syncCliFromUnified(unified, cli)
    const cmd = cli.find('cmd-a')
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe('cmd-a')
    expect(cmd!.description).toBe('Command a')
    // Verify handler calls registry.execute with correct cap id
    const result = await cmd!.handler({ input: 'world' })
    expect(result.data).toEqual({ ok: true, input: { input: 'world' } })
  })
})
