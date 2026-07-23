import { describe, expect, it } from 'bun:test'
import { normalizeToolSchema, RESERVED_TOOL_NAMES } from '../../../../src/engines/memory/memory-backend.js'

describe('memory-backend', () => {
  describe('RESERVED_TOOL_NAMES', () => {
    it('contains core tool names', () => {
      expect(RESERVED_TOOL_NAMES.has('memory')).toBe(true)
      expect(RESERVED_TOOL_NAMES.has('send_message')).toBe(true)
      expect(RESERVED_TOOL_NAMES.has('read_file')).toBe(true)
      expect(RESERVED_TOOL_NAMES.has('terminal')).toBe(true)
    })

    it('is ReadonlySet (type-level)', () => {
      expect(RESERVED_TOOL_NAMES).toBeInstanceOf(Set)
      expect(RESERVED_TOOL_NAMES.size).toBeGreaterThanOrEqual(10)
    })
  })

  describe('normalizeToolSchema', () => {
    it('returns null for null input', () => {
      expect(normalizeToolSchema(null)).toBeNull()
    })

    it('returns null for non-object', () => {
      expect(normalizeToolSchema('string')).toBeNull()
      expect(normalizeToolSchema(42)).toBeNull()
    })

    it('returns null for missing name', () => {
      expect(normalizeToolSchema({ description: 'test' })).toBeNull()
    })

    it('returns null for empty name', () => {
      expect(normalizeToolSchema({ name: '', description: 'test' })).toBeNull()
    })

    it('normalizes a simple schema', () => {
      const result = normalizeToolSchema({ name: 'search', description: 'Search files', parameters: { q: 'string' } })
      expect(result).toEqual({ name: 'search', description: 'Search files', parameters: { q: 'string' } })
    })

    it('unwraps function-wrapped schema', () => {
      const wrapped = { type: 'function', function: { name: 'tool', description: 'A tool', parameters: {} } }
      const result = normalizeToolSchema(wrapped)
      expect(result).toEqual({ name: 'tool', description: 'A tool', parameters: {} })
    })

    it('defaults description to empty string', () => {
      const result = normalizeToolSchema({ name: 'tool' })
      expect(result!.description).toBe('')
    })

    it('defaults parameters to empty object', () => {
      const result = normalizeToolSchema({ name: 'tool', description: 'desc' })
      expect(result!.parameters).toEqual({})
    })
  })
})
