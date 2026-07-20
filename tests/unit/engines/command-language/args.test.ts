import { describe, expect, test } from 'bun:test'
import { validateArgs } from '../../../../src/engines/command-language/args.js'
import type { ArgSpec, CommandContext } from '../../../../src/engines/command-language/types.js'

const ctx: CommandContext = {
  activeProvider: 'chatgpt',
  activeConvId: 'conv-1',
  activeAccountId: 'account-1',
  lastAssistantText: 'Last response here',
  lastAssistantAt: Date.now(),
  lastUserPrompt: 'Last prompt',
  gmailAccounts: [{ hash: 'hash1', email: 'test@gmail.com' }],
  dueMemoryCount: 3,
  panelStatus: 'connected',
  activeTags: ['important', 'work'],
  recentCommands: ['health', 'send'],
  sessionState: {},
}

describe('validateArgs', () => {
  // ─── Required Args ───────────────────────────────────────────
  test('passes with all required args', () => {
    const specs: ArgSpec[] = [
      { name: 'message', kind: 'text', placeholder: 'Enter message', required: true },
    ]
    const raw = { message: 'hello' }
    const result = validateArgs(specs, raw, ctx)
    expect(result.ok).toBe(true)
  })

  test('fails when required arg missing', () => {
    const specs: ArgSpec[] = [
      { name: 'message', kind: 'text', placeholder: 'Enter message', required: true },
    ]
    const raw = {}
    const result = validateArgs(specs, raw, ctx)
    expect(result.ok).toBe(false)
  })

  // ─── Optional Args ───────────────────────────────────────────
  test('passes with missing optional arg', () => {
    const specs: ArgSpec[] = [
      { name: 'count', kind: 'text', placeholder: 'Count', required: false },
    ]
    const raw = {}
    const result = validateArgs(specs, raw, ctx)
    expect(result.ok).toBe(true)
  })

  // ─── Default Values ──────────────────────────────────────────
  test('applies static default', () => {
    const specs: ArgSpec[] = [
      { name: 'count', kind: 'text', placeholder: 'Count', required: false, default: '10' },
    ]
    const raw = {}
    const result = validateArgs(specs, raw, ctx)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.count).toBe('10')
    }
  })

  test('applies context-injected default', () => {
    const specs: ArgSpec[] = [
      {
        name: 'provider',
        kind: 'provider',
        placeholder: 'Provider',
        required: false,
        default: (c) => c.activeProvider,
      },
    ]
    const raw = {}
    const result = validateArgs(specs, raw, ctx)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.provider).toBe('chatgpt')
    }
  })

  // ─── Validation ──────────────────────────────────────────────
  test('rejects invalid value via custom validation', () => {
    const specs: ArgSpec[] = [
      {
        name: 'email',
        kind: 'email',
        placeholder: 'Email',
        required: true,
        validation: (v) => (v.includes('@') ? null : 'Invalid email'),
      },
    ]
    const raw = { email: 'not-an-email' }
    const result = validateArgs(specs, raw, ctx)
    expect(result.ok).toBe(false)
  })

  test('passes valid value via custom validation', () => {
    const specs: ArgSpec[] = [
      {
        name: 'email',
        kind: 'email',
        placeholder: 'Email',
        required: true,
        validation: (v) => (v.includes('@') ? null : 'Invalid email'),
      },
    ]
    const raw = { email: 'test@example.com' }
    const result = validateArgs(specs, raw, ctx)
    expect(result.ok).toBe(true)
  })

  // ─── Choice Args ─────────────────────────────────────────────
  test('passes valid choice value', () => {
    const specs: ArgSpec[] = [
      {
        name: 'format',
        kind: 'choice',
        placeholder: 'Format',
        required: true,
        options: [
          { value: 'json', label: 'JSON' },
          { value: 'csv', label: 'CSV' },
        ],
      },
    ]
    const raw = { format: 'json' }
    const result = validateArgs(specs, raw, ctx)
    expect(result.ok).toBe(true)
  })

  test('rejects invalid choice value', () => {
    const specs: ArgSpec[] = [
      {
        name: 'format',
        kind: 'choice',
        placeholder: 'Format',
        required: true,
        options: [
          { value: 'json', label: 'JSON' },
          { value: 'csv', label: 'CSV' },
        ],
      },
    ]
    const raw = { format: 'xml' }
    const result = validateArgs(specs, raw, ctx)
    expect(result.ok).toBe(false)
  })

  // ─── No Specs ────────────────────────────────────────────────
  test('passes with empty specs', () => {
    const result = validateArgs([], {}, ctx)
    expect(result.ok).toBe(true)
  })
})
