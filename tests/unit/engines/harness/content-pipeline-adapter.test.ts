import { describe, expect, it } from 'bun:test'
import { reconstructCapture } from '../../../../src/engines/harness/content-pipeline-adapter.js'

describe('content-pipeline-adapter', () => {
  describe('reconstructCapture', () => {
    it('returns empty array for undefined', () => {
      expect(reconstructCapture(undefined)).toEqual([])
    })

    it('returns empty array for empty string', () => {
      expect(reconstructCapture('')).toEqual([])
    })

    it('returns single text block for plain text', () => {
      const blocks = reconstructCapture('Hello world')
      expect(blocks).toEqual([{ blockKind: 'text', blockData: 'Hello world' }])
    })

    it('splits on double newlines into paragraphs', () => {
      const blocks = reconstructCapture('Para 1\n\nPara 2\n\nPara 3')
      expect(blocks).toHaveLength(3)
      expect(blocks[0]).toEqual({ blockKind: 'text', blockData: 'Para 1' })
      expect(blocks[1]).toEqual({ blockKind: 'text', blockData: 'Para 2' })
      expect(blocks[2]).toEqual({ blockKind: 'text', blockData: 'Para 3' })
    })

    it('detects code fences as code blocks', () => {
      const input = '```\nconst x = 1\n```'
      const blocks = reconstructCapture(input)
      expect(blocks).toEqual([{ blockKind: 'code', blockData: 'const x = 1' }])
    })

    it('mixes text and code blocks', () => {
      const input = 'Some text\n\n```\ncode here\n```\n\nMore text'
      const blocks = reconstructCapture(input)
      expect(blocks).toHaveLength(3)
      expect(blocks[0]!.blockKind).toBe('text')
      expect(blocks[1]!.blockKind).toBe('code')
      expect(blocks[2]!.blockKind).toBe('text')
    })

    it('trims whitespace from blocks', () => {
      const blocks = reconstructCapture('  hello  \n\n  world  ')
      expect(blocks[0]!.blockData).toBe('hello')
      expect(blocks[1]!.blockData).toBe('world')
    })

    it('filters out empty paragraphs', () => {
      const blocks = reconstructCapture('a\n\n\n\nb')
      expect(blocks).toHaveLength(2)
    })
  })
})
