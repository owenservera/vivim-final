import { describe, expect, test } from 'bun:test'
import {
  getSuggestions,
  resolveCommand,
} from '../../../../src/engines/command-language/resolver.js'
import type {
  CommandContext,
  ParsedCommand,
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

const registry: UnifiedCommandSpec[] = [
  {
    id: 'health',
    namespace: 'system',
    title: 'Health Check',
    prefix: '/',
    category: 'system',
    surfaces: ['cli', 'api'],
    run: async () => ({ ok: true, toast: 'healthy' }),
  },
  {
    id: 'send_message',
    namespace: 'conversation',
    title: 'Send Message',
    prefix: '/',
    category: 'conversation',
    surfaces: ['cli', 'api'],
    run: async () => ({ ok: true, toast: 'sent' }),
    aliases: ['msg', 'message'],
  },
  {
    id: 'switch_provider',
    namespace: 'provider',
    title: 'Switch Provider',
    prefix: '/',
    category: 'provider',
    surfaces: ['cli', 'api'],
    run: async () => ({ ok: true, toast: 'switched' }),
    aliases: ['sw'],
  },
  {
    id: 'mention_claude',
    namespace: 'provider',
    title: 'Claude Provider',
    prefix: '@',
    category: 'provider',
    surfaces: ['cli', 'api'],
    run: async () => ({ ok: true, toast: 'claude' }),
  },
  {
    id: 'mention_chatgpt',
    namespace: 'provider',
    title: 'ChatGPT Provider',
    prefix: '@',
    category: 'provider',
    surfaces: ['cli', 'api'],
    run: async () => ({ ok: true, toast: 'chatgpt' }),
    aliases: ['gpt'],
  },
  {
    id: 'devops_health',
    namespace: 'devops',
    title: 'DevOps Health',
    prefix: '!',
    category: 'system',
    surfaces: ['cli'],
    run: async () => ({ ok: true, toast: 'healthy' }),
  },
]

describe('resolveCommand', () => {
  // ─── Exact Match ─────────────────────────────────────────────
  test('resolves exact command name', () => {
    const parsed: ParsedCommand = {
      prefix: '/',
      command: 'health',
      rawArgs: '',
      tokens: ['health'],
      isCombo: false,
    }
    const result = resolveCommand(parsed, ctx, registry)
    expect(result?.id).toBe('health')
  })

  test('resolves alias', () => {
    const parsed: ParsedCommand = {
      prefix: '/',
      command: 'sw',
      rawArgs: '',
      tokens: ['sw'],
      isCombo: false,
    }
    const result = resolveCommand(parsed, ctx, registry)
    expect(result?.id).toBe('switch_provider')
  })

  // ─── Fuzzy Matching ──────────────────────────────────────────
  test('resolves partial match', () => {
    const parsed: ParsedCommand = {
      prefix: '/',
      command: 'heal',
      rawArgs: '',
      tokens: ['heal'],
      isCombo: false,
    }
    const result = resolveCommand(parsed, ctx, registry)
    expect(result?.id).toBe('health')
  })

  test('resolves close spelling', () => {
    const parsed: ParsedCommand = {
      prefix: '/',
      command: 'helth',
      rawArgs: '',
      tokens: ['helth'],
      isCombo: false,
    }
    const result = resolveCommand(parsed, ctx, registry)
    expect(result?.id).toBe('health')
  })

  // ─── Prefix Filtering ────────────────────────────────────────
  test('filters by prefix /', () => {
    const parsed: ParsedCommand = {
      prefix: '/',
      command: 'health',
      rawArgs: '',
      tokens: ['health'],
      isCombo: false,
    }
    const result = resolveCommand(parsed, ctx, registry)
    expect(result?.prefix).toBe('/')
  })

  test('filters by prefix @', () => {
    const parsed: ParsedCommand = {
      prefix: '@',
      command: 'claude',
      rawArgs: '',
      tokens: ['claude'],
      isCombo: false,
    }
    const result = resolveCommand(parsed, ctx, registry)
    expect(result?.id).toBe('mention_claude')
  })

  test('filters by prefix !', () => {
    const parsed: ParsedCommand = {
      prefix: '!',
      command: 'health',
      rawArgs: '',
      tokens: ['health'],
      isCombo: false,
    }
    const result = resolveCommand(parsed, ctx, registry)
    expect(result?.id).toBe('devops_health')
  })

  // ─── MRU Ranking ─────────────────────────────────────────────
  test('MRU boosts recently used command', () => {
    const parsed: ParsedCommand = {
      prefix: '/',
      command: 'heal',
      rawArgs: '',
      tokens: ['heal'],
      isCombo: false,
    }

    // Without MRU
    const withoutMRU = resolveCommand(parsed, ctx, registry)
    // With MRU — same result but score higher
    const withMRU = resolveCommand(parsed, ctx, registry, ['health'])
    expect(withMRU?.id).toBe('health')
    expect(withoutMRU?.id).toBe('health')
  })

  // ─── No Match ────────────────────────────────────────────────
  test('returns null for no match', () => {
    const parsed: ParsedCommand = {
      prefix: '/',
      command: 'zzzznonexistent',
      rawArgs: '',
      tokens: ['zzzznonexistent'],
      isCombo: false,
    }
    const result = resolveCommand(parsed, ctx, registry)
    expect(result).toBeNull()
  })

  // ─── Visibility Gate ─────────────────────────────────────────
  test('respects when gate', () => {
    const gated: UnifiedCommandSpec[] = [
      ...registry,
      {
        id: 'hidden',
        namespace: 'system',
        title: 'Hidden Command',
        prefix: '/',
        category: 'system',
        surfaces: ['cli'],
        when: () => false,
        run: async () => ({ ok: true, toast: 'hidden' }),
      },
    ]
    const parsed: ParsedCommand = {
      prefix: '/',
      command: 'hidden',
      rawArgs: '',
      tokens: ['hidden'],
      isCombo: false,
    }
    const result = resolveCommand(parsed, ctx, gated)
    expect(result).toBeNull()
  })
})

describe('getSuggestions', () => {
  test('returns top N suggestions', () => {
    const results = getSuggestions('h', ctx, registry, [], 3)
    expect(results.length).toBeLessThanOrEqual(3)
    expect(results.some((r) => r.spec.id === 'health')).toBe(true)
  })

  test('returns empty for no matches', () => {
    const results = getSuggestions('zzzznonexistent', ctx, registry)
    expect(results).toEqual([])
  })
})
