import { describe, expect, it } from 'bun:test'
import {
  isContextRef,
  resolveContextRef,
} from '../../../../src/engines/command-language/context-ref.js'
import { ContextNotFoundError } from '../../../../src/errors.js'

describe('context-ref', () => {
  describe('resolveContextRef', () => {
    const ctx = {
      lastAssistantText: 'the answer is 42',
      lastUserPrompt: 'what is the meaning of life',
      activeConvId: 'conv-1',
      activeProvider: 'claude',
    }

    it('resolves ~last', () => {
      expect(resolveContextRef('~last', ctx)).toBe('the answer is 42')
    })

    it('resolves ~this', () => {
      expect(resolveContextRef('~this', ctx)).toBe('what is the meaning of life')
    })

    it('resolves ~msg:ID', () => {
      expect(resolveContextRef('~msg:abc123', ctx)).toBe('[message:abc123]')
    })

    it('resolves ~conv:ID', () => {
      expect(resolveContextRef('~conv:xyz', ctx)).toBe('[conversation:xyz]')
    })

    it('resolves ~file:path', () => {
      expect(resolveContextRef('~file:src/main.ts', ctx)).toBe('[file:src/main.ts]')
    })

    it('resolves ~active', () => {
      expect(resolveContextRef('~active', ctx)).toBe('conv-1')
    })

    it('resolves ~provider', () => {
      expect(resolveContextRef('~provider', ctx)).toBe('claude')
    })

    it('throws ContextNotFoundError for ~last when missing', () => {
      expect(() => resolveContextRef('~last', {} as any)).toThrow(ContextNotFoundError)
    })

    it('throws ContextNotFoundError for ~this when missing', () => {
      expect(() => resolveContextRef('~this', {} as any)).toThrow(ContextNotFoundError)
    })

    it('throws ContextNotFoundError for ~active when missing', () => {
      expect(() => resolveContextRef('~active', {} as any)).toThrow(ContextNotFoundError)
    })

    it('returns as-is for unknown refs', () => {
      expect(resolveContextRef('hello', ctx)).toBe('hello')
    })
  })

  describe('isContextRef', () => {
    it('returns true for ~last', () => {
      expect(isContextRef('~last')).toBe(true)
    })

    it('returns true for ~msg:ID', () => {
      expect(isContextRef('~msg:123')).toBe(true)
    })

    it('returns false for regular text', () => {
      expect(isContextRef('hello')).toBe(false)
    })
  })
})
