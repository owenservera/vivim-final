// tests/unit/engines/nlcl/pattern-match.test.ts
import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import {
  buildIntentFromPattern,
  extractPatternInput,
} from '../../../../src/engines/nlcl/pattern-match.js'
import type { CommandPattern } from '../../../../src/engines/nlcl/types.js'

function makePattern(): CommandPattern {
  return {
    id: 'send-message',
    intent: 'send_message',
    description: 'send a message',
    patterns: [
      {
        regex: /send (?:a )?message to (\w+)/i,
        priority: 1,
        extract: (m) => ({ recipient: m[1] }),
      },
    ],
    aliases: [],
    examples: [],
    inputSchema: z.object({ recipient: z.string() }),
    outputSchema: z.any(),
    executor: 'conversation',
    execute: async () => undefined,
    category: 'communication',
    surfaces: ['cli'],
    requiresConfirmation: false,
    classification: 'communication',
    aiFallback: false,
    tags: [],
  }
}

describe('extractPatternInput', () => {
  it('extracts validated params on a matching regex', () => {
    const p = makePattern()
    const out = extractPatternInput(p, 'send message to alice')
    expect(out).not.toBeNull()
    expect(out).toEqual({ recipient: 'alice' })
  })

  it('normalizes input before matching (filler + case)', () => {
    const p = makePattern()
    const out = extractPatternInput(p, 'Please SEND a message to bob')
    expect(out).toEqual({ recipient: 'bob' })
  })

  it('returns null when no regex matches', () => {
    const p = makePattern()
    expect(extractPatternInput(p, 'delete everything')).toBeNull()
  })

  it('returns null when extracted params fail schema validation', () => {
    const p = makePattern()
    // schema requires recipient:string; if extraction yields nothing it fails
    const bad: CommandPattern = {
      ...p,
      patterns: [{ regex: /do thing/i, priority: 1, extract: () => ({}) }],
    }
    expect(extractPatternInput(bad, 'do thing')).toBeNull()
  })
})

describe('buildIntentFromPattern', () => {
  it('builds a ParsedIntent with extracted input and metadata', () => {
    const p = makePattern()
    const intent = buildIntentFromPattern(p, 'send message to carol', 0.9, 'send-message')
    expect(intent.intent).toBe('send_message')
    expect(intent.patternId).toBe('send-message')
    expect(intent.input).toEqual({ recipient: 'carol' })
    expect(intent.confidence).toBe(0.9)
    expect(intent.rawInput).toBe('send message to carol')
    expect(intent.matchedPattern).toBe('send-message')
    expect(intent.alternatives).toEqual([])
    expect(typeof intent.resolvedAt).toBe('number')
  })

  it('falls back to empty input when extraction fails', () => {
    const p = makePattern()
    const bad: CommandPattern = {
      ...p,
      patterns: [{ regex: /do thing/i, priority: 1, extract: () => ({}) }],
    }
    const intent = buildIntentFromPattern(bad, 'do thing', 0.5, 'do-thing')
    expect(intent.input).toEqual({})
  })
})
