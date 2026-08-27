// tests/unit/cli/dispatch.test.ts
// Regression guard for the CLI dispatch layer (Unit 24.8 fixes):
//   - registry.resolve() matches multi-word commands (was single-token only)
//   - syncCliFromUnified warns + skips on alias collisions (was silent overwrite)
import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import type { CliCommand } from '../../../src/cli/command-registry.js'
import { CommandRegistry } from '../../../src/cli/command-registry.js'
import { syncCliFromUnified } from '../../../src/cli/commands/registry-bridge.js'

function makeCmd(name: string, subsystem: CliCommand['subsystem'] = 'cap-store'): CliCommand {
  return {
    name,
    description: `cmd ${name}`,
    subsystem,
    schema: z.object({}).passthrough(),
    examples: [],
    handler: async () => ({ data: null }),
  }
}

describe('CommandRegistry.resolve (multi-word)', () => {
  it('resolves a single-word command', () => {
    const r = new CommandRegistry()
    r.register(makeCmd('help'))
    const { command, consumed } = r.resolve(['help'])
    expect(command?.name).toBe('help')
    expect(consumed).toBe(1)
  })

  it('resolves a multi-word command (longest-prefix match)', () => {
    const r = new CommandRegistry()
    r.register(makeCmd('admin'))
    r.register(makeCmd('admin db status'))
    const { command, consumed } = r.resolve(['admin', 'db', 'status'])
    expect(command?.name).toBe('admin db status')
    expect(consumed).toBe(3)
  })

  it('prefers the longer match when both prefix and full exist', () => {
    const r = new CommandRegistry()
    r.register(makeCmd('admin'))
    r.register(makeCmd('admin db'))
    r.register(makeCmd('admin db status'))
    const { command, consumed } = r.resolve(['admin', 'db', 'status', 'extra'])
    expect(command?.name).toBe('admin db status')
    expect(consumed).toBe(3)
  })

  it('returns undefined when no command matches', () => {
    const r = new CommandRegistry()
    r.register(makeCmd('help'))
    const { command } = r.resolve(['nonexistent', 'command'])
    expect(command).toBeUndefined()
  })
})

describe('syncCliFromUnified collision guard', () => {
  function fakeRegistry(
    caps: Array<{
      id: string
      slug: string
      description: string
      name: string
      cliCommand: { name: string; aliases?: string[] }
      category?: string
    }>,
  ) {
    return {
      list: () => caps,
    } as unknown as Parameters<typeof syncCliFromUnified>[0]
  }

  it('registers non-colliding aliases without warning', () => {
    const warned: string[] = []
    // [audit] removed: console.warn capture
    try {
      const r = new CommandRegistry()
      const reg = fakeRegistry([
        {
          id: 'c1',
          slug: 'send_message',
          name: 'send_message',
          description: 'cmd send message',
          cliCommand: { name: 'send message', aliases: ['sm'] },
          category: 'conversation',
        },
        {
          id: 'c2',
          slug: 'search_memory',
          name: 'search_memory',
          description: 'cmd search memory',
          cliCommand: { name: 'search memory', aliases: ['srm'] },
          category: 'memory',
        },
      ])
      syncCliFromUnified(reg, r)
      expect(r.find('send message')).toBeDefined()
      expect(r.find('sm')).toBeDefined()
      expect(r.find('search memory')).toBeDefined()
      expect(r.find('srm')).toBeDefined()
      expect(warned).toHaveLength(0)
    } finally {
      // [audit] removed: console.warn restore
    }
  })

  it('warns and skips duplicate alias instead of overwriting', () => {
    const warned: string[] = []
    // [audit] removed: console.warn capture
    try {
      const r = new CommandRegistry()
      const reg = fakeRegistry([
        {
          id: 'c1',
          slug: 'send_message',
          name: 'send_message',
          description: 'cmd send message',
          cliCommand: { name: 'send message', aliases: ['sm'] },
          category: 'conversation',
        },
        {
          id: 'c2',
          slug: 'search_messages',
          name: 'search_messages',
          description: 'cmd search messages',
          cliCommand: { name: 'search messages', aliases: ['sm'] },
          category: 'conversation',
        },
      ])
      syncCliFromUnified(reg, r)
      // first registration wins; duplicate is skipped with a warning
      expect(r.find('sm')?.description).toBe('cmd send message')
      expect(warned.some((w) => w.includes('alias collision'))).toBe(true)
    } finally {
      // [audit] removed: console.warn restore
    }
  })
})
