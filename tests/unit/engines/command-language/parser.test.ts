import { describe, expect, test } from 'bun:test'
import {
  extractCommandName,
  hasPrefix,
  parseInput,
} from '../../../../src/engines/command-language/parser.js'

describe('parseInput', () => {
  // ─── Prefix Detection ────────────────────────────────────────
  test('detects slash prefix', () => {
    const r = parseInput('/health')
    expect(r.prefix).toBe('/')
    expect(r.command).toBe('health')
    expect(r.rawArgs).toBe('')
  })

  test('detects mention prefix', () => {
    const r = parseInput('@claude hello world')
    expect(r.prefix).toBe('@')
    expect(r.command).toBe('claude')
    expect(r.rawArgs).toBe('hello world')
  })

  test('detects tag prefix', () => {
    const r = parseInput('#important')
    expect(r.prefix).toBe('#')
    expect(r.command).toBe('important')
  })

  test('detects devops prefix', () => {
    const r = parseInput('!health --deep')
    expect(r.prefix).toBe('!')
    expect(r.command).toBe('health')
    expect(r.rawArgs).toBe('--deep')
  })

  test('detects context ref prefix', () => {
    const r = parseInput('~last')
    expect(r.prefix).toBe('~')
    expect(r.command).toBe('last')
  })

  test('detects capability prefix', () => {
    const r = parseInput('$cap:memory:recall')
    expect(r.prefix).toBe('$')
    expect(r.command).toBe('cap:memory:recall')
  })

  test('detects discovery prefix', () => {
    const r = parseInput('?help')
    expect(r.prefix).toBe('?')
    expect(r.command).toBe('help')
  })

  test('no prefix for plain text', () => {
    const r = parseInput('switch to claude')
    expect(r.prefix).toBeNull()
    expect(r.command).toBe('switch')
    expect(r.rawArgs).toBe('to claude')
  })

  // ─── Token Splitting ─────────────────────────────────────────
  test('splits multi-word args', () => {
    const r = parseInput('/send "hello world" to claude')
    expect(r.tokens).toEqual(['send', 'hello world', 'to', 'claude'])
  })

  test('handles single-quoted strings', () => {
    const r = parseInput("/draft 'Dear John, here is your summary'")
    expect(r.tokens).toEqual(['draft', 'Dear John, here is your summary'])
  })

  test('handles empty quoted strings', () => {
    const r = parseInput('/send ""')
    expect(r.tokens).toEqual(['send', ''])
  })

  // ─── Edge Cases ──────────────────────────────────────────────
  test('empty input returns no prefix', () => {
    const r = parseInput('')
    expect(r.prefix).toBeNull()
    expect(r.command).toBe('')
    expect(r.tokens).toEqual([])
  })

  test('whitespace-only input returns no prefix', () => {
    const r = parseInput('   \t  ')
    expect(r.prefix).toBeNull()
    expect(r.command).toBe('')
    expect(r.tokens).toEqual([])
  })

  test('prefix with no command', () => {
    const r = parseInput('/')
    expect(r.prefix).toBe('/')
    expect(r.command).toBe('')
    expect(r.tokens).toEqual([])
  })

  test('handles leading/trailing whitespace', () => {
    const r = parseInput('  /health  --deep  ')
    expect(r.prefix).toBe('/')
    expect(r.command).toBe('health')
    expect(r.rawArgs).toBe('--deep')
  })

  // ─── Combo Detection ─────────────────────────────────────────
  test('detects combo with "and"', () => {
    const r = parseInput('/health and /status')
    expect(r.isCombo).toBe(true)
  })

  test('detects combo with "then"', () => {
    const r = parseInput('/switch claude then /send hello')
    expect(r.isCombo).toBe(true)
  })

  test('detects combo with "&"', () => {
    const r = parseInput('/health & /status')
    expect(r.isCombo).toBe(true)
  })

  test('detects combo with "|"', () => {
    const r = parseInput('/health | /status')
    expect(r.isCombo).toBe(true)
  })

  test('no combo for simple command', () => {
    const r = parseInput('/health')
    expect(r.isCombo).toBe(false)
  })
})

describe('extractCommandName', () => {
  test('extracts command from prefix input', () => {
    expect(extractCommandName('/health')).toBe('health')
    expect(extractCommandName('@claude hello')).toBe('claude')
    expect(extractCommandName('!fleet status')).toBe('fleet')
  })

  test('extracts command from plain text', () => {
    expect(extractCommandName('switch to claude')).toBe('switch')
    expect(extractCommandName('help me')).toBe('help')
  })
})

describe('hasPrefix', () => {
  test('returns true for matching prefix', () => {
    expect(hasPrefix('/health', '/')).toBe(true)
    expect(hasPrefix('@claude', '@')).toBe(true)
    expect(hasPrefix('#tag', '#')).toBe(true)
  })

  test('returns false for non-matching prefix', () => {
    expect(hasPrefix('/health', '@')).toBe(false)
    expect(hasPrefix('hello', '/')).toBe(false)
  })
})
