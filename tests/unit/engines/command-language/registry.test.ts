import { describe, expect, test } from 'bun:test'
import { CommandLanguageRegistry } from '../../../../src/engines/command-language/registry.js'
import type {
  CommandContext,
  UnifiedCommandSpec,
} from '../../../../src/engines/command-language/types.js'

const ctx: CommandContext = {
  activeProvider: 'chatgpt',
  activeConvId: 'conv-1',
  activeAccountId: 'account-1',
  lastAssistantText: null,
  lastAssistantAt: null,
  lastUserPrompt: null,
  gmailAccounts: [],
  dueMemoryCount: 0,
  panelStatus: 'connected',
  activeTags: [],
  recentCommands: [],
  sessionState: {},
}

const makeSpec = (overrides: Partial<UnifiedCommandSpec>): UnifiedCommandSpec => ({
  id: 'test-cmd',
  prefix: '/',
  namespace: 'test',
  title: 'Test Command',
  category: 'system',
  surfaces: ['cli'],
  run: async () => ({ ok: true, toast: 'done' }),
  ...overrides,
})

describe('CommandLanguageRegistry', () => {
  // ─── Register ────────────────────────────────────────────────
  test('registers a command', () => {
    const reg = new CommandLanguageRegistry()
    const spec = makeSpec({ id: 'health' })
    reg.register(spec)
    expect(reg.getById('health')).toBe(spec)
  })

  test('deduplicates by id', () => {
    const reg = new CommandLanguageRegistry()
    const spec1 = makeSpec({ id: 'health', title: 'Health v1' })
    const spec2 = makeSpec({ id: 'health', title: 'Health v2' })
    reg.register(spec1)
    reg.register(spec2)
    expect(reg.getById('health')?.title).toBe('Health v1')
  })

  // ─── Lookup by Id ────────────────────────────────────────────
  test('getById returns undefined for unknown id', () => {
    const reg = new CommandLanguageRegistry()
    expect(reg.getById('unknown')).toBeUndefined()
  })

  // ─── List by Prefix ──────────────────────────────────────────
  test('listByPrefix filters correctly', () => {
    const reg = new CommandLanguageRegistry()
    reg.register(makeSpec({ id: 'slash-cmd', prefix: '/' }))
    reg.register(makeSpec({ id: 'mention-cmd', prefix: '@' }))
    reg.register(makeSpec({ id: 'slash-cmd2', prefix: '/' }))

    const slashCmds = reg.listByPrefix('/')
    expect(slashCmds.length).toBe(2)
    expect(slashCmds.every((s) => s.prefix === '/')).toBe(true)
  })

  test('listByPrefix returns empty for no matches', () => {
    const reg = new CommandLanguageRegistry()
    expect(reg.listByPrefix('$')).toEqual([])
  })

  // ─── List by Category ────────────────────────────────────────
  test('listByCategory filters correctly', () => {
    const reg = new CommandLanguageRegistry()
    reg.register(makeSpec({ id: 'sys', category: 'system' }))
    reg.register(makeSpec({ id: 'conv', category: 'conversation' }))
    reg.register(makeSpec({ id: 'sys2', category: 'system' }))

    const sysCmds = reg.listByCategory('system')
    expect(sysCmds.length).toBe(2)
    expect(sysCmds.every((s) => s.category === 'system')).toBe(true)
  })

  // ─── Get All ─────────────────────────────────────────────────
  test('getAll returns all registered commands', () => {
    const reg = new CommandLanguageRegistry()
    reg.register(makeSpec({ id: 'a' }))
    reg.register(makeSpec({ id: 'b' }))
    reg.register(makeSpec({ id: 'c' }))
    expect(reg.getAll().length).toBe(3)
  })

  // ─── Resolve ─────────────────────────────────────────────────
  test('resolve returns matching spec', () => {
    const reg = new CommandLanguageRegistry()
    reg.register(makeSpec({ id: 'health' }))
    const result = reg.resolve(
      { prefix: '/', command: 'health', rawArgs: '', tokens: ['health'], isCombo: false },
      ctx,
    )
    expect(result?.id).toBe('health')
  })

  test('resolve returns null for no match', () => {
    const reg = new CommandLanguageRegistry()
    reg.register(makeSpec({ id: 'health' }))
    const result = reg.resolve(
      { prefix: '/', command: 'unknown', rawArgs: '', tokens: ['unknown'], isCombo: false },
      ctx,
    )
    expect(result).toBeNull()
  })

  // ─── MRU ─────────────────────────────────────────────────────
  test('getMRU returns recent commands', () => {
    const reg = new CommandLanguageRegistry()
    reg.recordMRU('health')
    reg.recordMRU('send')
    const mru = reg.getMRU()
    expect(mru).toContain('health')
    expect(mru).toContain('send')
  })

  test('recordMRU deduplicates', () => {
    const reg = new CommandLanguageRegistry()
    reg.recordMRU('health')
    reg.recordMRU('health')
    reg.recordMRU('send')
    expect(reg.getMRU().filter((id) => id === 'health').length).toBe(1)
  })

  test('getMRU respects limit', () => {
    const reg = new CommandLanguageRegistry()
    for (let i = 0; i < 20; i++) reg.recordMRU(`cmd-${i}`)
    expect(reg.getMRU().length).toBeLessThanOrEqual(10)
  })
})
