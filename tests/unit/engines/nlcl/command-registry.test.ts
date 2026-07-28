import { beforeEach, describe, expect, it } from 'bun:test'
import { CommandPatternRegistry } from '../../../../src/engines/nlcl/command-registry.js'
import type { CommandPattern } from '../../../../src/engines/nlcl/types.js'
import { EngineError } from '../../../../src/errors.js'

function makePattern(overrides: Partial<CommandPattern> = {}): CommandPattern {
  return {
    id: 'test_pattern_1',
    intent: 'test_intent',
    description: 'test description',
    category: 'test',
    surfaces: ['cli'],
    aliases: ['test alias'],
    examples: ['test example'],
    patterns: [{ regex: /test/, keywords: ['test'], priority: 1, extract: () => null } as any],
    inputSchema: {} as any,
    outputSchema: {} as any,
    executor: 'test' as any,
    execute: async () => null,
    requiresConfirmation: false,
    classification: 'action' as any,
    aiFallback: false,
    tags: ['test-tag'],
    ...overrides,
  }
}

describe('command-registry', () => {
  let registry: CommandPatternRegistry

  beforeEach(() => {
    registry = new CommandPatternRegistry()
  })

  describe('register + get', () => {
    it('registers and retrieves a pattern', () => {
      const pattern = makePattern()
      registry.register(pattern)
      expect(registry.get('test_pattern_1')).toBe(pattern)
    })

    it('throws on duplicate id', () => {
      registry.register(makePattern())
      expect(() => registry.register(makePattern())).toThrow(EngineError)
    })

    it('throws on duplicate intent', () => {
      registry.register(makePattern({ id: 'a', intent: 'shared' }))
      expect(() => registry.register(makePattern({ id: 'b', intent: 'shared' }))).toThrow(
        EngineError,
      )
    })
  })

  describe('unregister', () => {
    it('removes a pattern', () => {
      registry.register(makePattern())
      registry.unregister('test_pattern_1')
      expect(registry.get('test_pattern_1')).toBeUndefined()
    })

    it('throws for unknown id', () => {
      expect(() => registry.unregister('nonexistent')).toThrow(EngineError)
    })
  })

  describe('getByIntent', () => {
    it('finds pattern by intent', () => {
      const pattern = makePattern()
      registry.register(pattern)
      expect(registry.getByIntent('test_intent')).toBe(pattern)
    })

    it('returns undefined for unknown intent', () => {
      expect(registry.getByIntent('unknown')).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns all patterns', () => {
      registry.register(makePattern({ id: 'a', intent: 'ia' }))
      registry.register(makePattern({ id: 'b', intent: 'ib' }))
      expect(registry.list()).toHaveLength(2)
    })

    it('filters by surface', () => {
      registry.register(makePattern({ id: 'a', intent: 'ia', surfaces: ['cli'] }))
      registry.register(makePattern({ id: 'b', intent: 'ib', surfaces: ['ui'] }))
      expect(registry.list({ surface: 'cli' })).toHaveLength(1)
    })

    it('filters by category', () => {
      registry.register(makePattern({ id: 'a', intent: 'ia', category: 'cat1' }))
      registry.register(makePattern({ id: 'b', intent: 'ib', category: 'cat2' }))
      expect(registry.list({ category: 'cat1' })).toHaveLength(1)
    })
  })

  describe('onRegister callback', () => {
    it('fires callback on registration', () => {
      const received: CommandPattern[] = []
      registry.onRegister((p) => received.push(p))
      registry.register(makePattern())
      expect(received).toHaveLength(1)
      expect(received[0]!.id).toBe('test_pattern_1')
    })

    it('returns unsubscribe function', () => {
      const received: CommandPattern[] = []
      const unsub = registry.onRegister((p) => received.push(p))
      registry.register(makePattern({ id: 'a', intent: 'ia' }))
      unsub()
      registry.register(makePattern({ id: 'b', intent: 'ib' }))
      expect(received).toHaveLength(1)
    })
  })

  describe('size', () => {
    it('returns correct count', () => {
      expect(registry.size()).toBe(0)
      registry.register(makePattern({ id: 'a', intent: 'ia' }))
      registry.register(makePattern({ id: 'b', intent: 'ib' }))
      expect(registry.size()).toBe(2)
    })
  })

  describe('search', () => {
    it('finds by id substring', () => {
      registry.register(makePattern({ id: 'my_pattern' }))
      expect(registry.search('my_pat')).toHaveLength(1)
    })

    it('finds by alias', () => {
      registry.register(makePattern({ aliases: ['open file'] }))
      expect(registry.search('open')).toHaveLength(1)
    })

    it('returns empty for no match', () => {
      expect(registry.search('nonexistent')).toHaveLength(0)
    })
  })

  describe('listByCategory', () => {
    it('groups by category', () => {
      registry.register(makePattern({ id: 'a', intent: 'ia', category: 'cat1' }))
      registry.register(makePattern({ id: 'b', intent: 'ib', category: 'cat2' }))
      registry.register(makePattern({ id: 'c', intent: 'ic', category: 'cat1' }))
      const grouped = registry.listByCategory()
      expect(Object.keys(grouped)).toHaveLength(2)
      expect(grouped.cat1).toHaveLength(2)
      expect(grouped.cat2).toHaveLength(1)
    })
  })

  describe('getPattern (alias)', () => {
    it('returns same as get', () => {
      const pattern = makePattern()
      registry.register(pattern)
      expect(registry.getPattern('test_pattern_1')).toBe(pattern)
    })
  })
})
