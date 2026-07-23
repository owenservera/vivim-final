// tests/unit/engines/content-unit-decomposer.test.ts
// decomposeToContentUnits — ContentBlock[] → ContentUnitRow[] mapping.
import { describe, expect, it } from 'bun:test'
import { decomposeToContentUnits } from '../../../src/engines/content-unit-decomposer.js'
import type { ContentBlock } from '../../../src/schema/streaming.js'

let counter = 0
const idGen = () => `cu-${++counter}`

describe('decomposeToContentUnits', () => {
  it('decomposes text blocks', () => {
    const blocks: ContentBlock[] = [{ type: 'text', text: 'hello world' }]
    const units = decomposeToContentUnits(blocks, 'conv-1', 'msg-1', idGen)
    expect(units).toHaveLength(1)
    expect(units[0]!.unitType).toBe('text')
    expect(units[0]!.content).toBe('hello world')
    expect(units[0]!.mimeType).toBe('text/plain')
    expect(units[0]!.conversationId).toBe('conv-1')
    expect(units[0]!.messageId).toBe('msg-1')
    expect(units[0]!.sequenceIndex).toBe(0)
  })

  it('decomposes reasoning blocks', () => {
    const blocks: ContentBlock[] = [{ type: 'reasoning', text: 'thinking...' }]
    const units = decomposeToContentUnits(blocks, 'c', 'm', idGen)
    expect(units[0]!.unitType).toBe('reasoning')
    expect(units[0]!.content).toBe('thinking...')
  })

  it('decomposes code blocks with language', () => {
    const blocks: ContentBlock[] = [{ type: 'code', text: 'console.log("hi")', language: 'javascript' }]
    const units = decomposeToContentUnits(blocks, 'c', 'm', idGen)
    expect(units[0]!.unitType).toBe('code')
    expect(units[0]!.mimeType).toBe('text/x-javascript')
    expect(JSON.parse(units[0]!.metadataJson).language).toBe('javascript')
  })

  it('decomposes file blocks', () => {
    const blocks: ContentBlock[] = [{ type: 'file', url: 'https://example.com/img.png', mediaType: 'image/png', filename: 'img.png' }]
    const units = decomposeToContentUnits(blocks, 'c', 'm', idGen)
    expect(units[0]!.unitType).toBe('file')
    expect(units[0]!.content).toBe('https://example.com/img.png')
    expect(units[0]!.mimeType).toBe('image/png')
  })

  it('decomposes tool-call blocks', () => {
    const blocks: ContentBlock[] = [{ type: 'tool-call', toolName: 'bash', input: 'ls', toolCallId: 'tc1', state: 'running' }]
    const units = decomposeToContentUnits(blocks, 'c', 'm', idGen)
    expect(units[0]!.unitType).toBe('tool-call')
    expect(units[0]!.mimeType).toBe('application/json')
    const parsed = JSON.parse(units[0]!.content)
    expect(parsed.toolName).toBe('bash')
  })

  it('decomposes tool-result blocks', () => {
    const blocks: ContentBlock[] = [{ type: 'tool-result', output: 'file1.txt', toolCallId: 'tc1', isError: false }]
    const units = decomposeToContentUnits(blocks, 'c', 'm', idGen)
    expect(units[0]!.unitType).toBe('tool-result')
    expect(units[0]!.content).toBe('"file1.txt"')
  })

  it('decomposes error blocks', () => {
    const blocks: ContentBlock[] = [{ type: 'error', message: 'something failed', code: 'E001' }]
    const units = decomposeToContentUnits(blocks, 'c', 'm', idGen)
    expect(units[0]!.unitType).toBe('error')
    expect(units[0]!.content).toBe('something failed')
  })

  it('decomposes meta blocks', () => {
    const blocks: ContentBlock[] = [{ type: 'meta', key: 'model', value: 'gpt-4' }]
    const units = decomposeToContentUnits(blocks, 'c', 'm', idGen)
    expect(units[0]!.unitType).toBe('meta')
    const parsed = JSON.parse(units[0]!.content)
    expect(parsed.key).toBe('model')
    expect(parsed.value).toBe('gpt-4')
  })

  it('decomposes multiple blocks with correct sequenceIndex', () => {
    const blocks: ContentBlock[] = [
      { type: 'text', text: 'a' },
      { type: 'text', text: 'b' },
      { type: 'text', text: 'c' },
    ]
    const units = decomposeToContentUnits(blocks, 'c', 'm', idGen)
    expect(units).toHaveLength(3)
    expect(units[0]!.sequenceIndex).toBe(0)
    expect(units[1]!.sequenceIndex).toBe(1)
    expect(units[2]!.sequenceIndex).toBe(2)
  })

  it('returns empty array for empty input', () => {
    expect(decomposeToContentUnits([], 'c', 'm')).toEqual([])
  })
})
