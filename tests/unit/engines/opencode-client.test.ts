// tests/unit/engines/opencode-client.test.ts
// Unit: event grammar reuse (parseOpencodeJson) + risk-tier mapping (feature 027).

import { describe, expect, it } from 'bun:test'
import { parseOpencodeJson } from '../../../src/engines/local-agent/local-agent-executor.js'
import {
  type OpencodeEvent,
  autoDenyTier,
  riskTierForTool,
} from '../../../src/engines/opencode/types.js'

function ev(partial: Partial<OpencodeEvent>): string {
  return JSON.stringify(partial)
}

describe('parseOpencodeJson reuse (serve SSE frames)', () => {
  it('maps a text event to a text ContentBlock', () => {
    const { blocks } = parseOpencodeJson(
      ev({ type: 'text', part: { type: 'text', text: 'hello' } }),
    )
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('text')
  })

  it('maps a tool event to tool-call + tool-result', () => {
    const { blocks } = parseOpencodeJson(
      ev({
        type: 'tool_use',
        part: {
          type: 'tool',
          tool: 'read',
          callID: 'c1',
          state: { status: 'completed', output: 'out' },
        },
      }),
    )
    expect(blocks.some((b) => b.type === 'tool-call')).toBe(true)
    expect(blocks.some((b) => b.type === 'tool-result')).toBe(true)
  })

  it('maps part.tool === invalid to PERMISSION_DENIED error block', () => {
    const { blocks, permissionDenied } = parseOpencodeJson(
      ev({ type: 'tool_use', part: { type: 'tool', tool: 'invalid', callID: 'c2' } }),
    )
    expect(permissionDenied).toBe(true)
    expect(
      blocks.some(
        (b) => b.type === 'error' && (b as { code?: string }).code === 'PERMISSION_DENIED',
      ),
    ).toBe(true)
  })

  it('maps an error event to AGENT_FAILED', () => {
    const { blocks } = parseOpencodeJson(
      ev({ type: 'error', error: { name: 'X', data: { message: 'boom' } } }),
    )
    expect(
      blocks.some((b) => b.type === 'error' && (b as { code?: string }).code === 'AGENT_FAILED'),
    ).toBe(true)
  })
})

describe('risk-tier mapping (Governor, in-process)', () => {
  it('rates bash/exec as tier 4 (auto-deny)', () => {
    expect(riskTierForTool('bash')).toBe(4)
    expect(autoDenyTier(riskTierForTool('bash'))).toBe(true)
  })
  it('rates delete as tier 5 (auto-deny)', () => {
    expect(riskTierForTool('delete_file')).toBe(5)
    expect(autoDenyTier(5)).toBe(true)
  })
  it('rates read as tier 1 (allow)', () => {
    expect(riskTierForTool('read')).toBe(1)
    expect(autoDenyTier(1)).toBe(false)
  })
  it('rates edit as tier 2 (allow)', () => {
    expect(riskTierForTool('edit')).toBe(2)
  })
  it('unknown tool defaults to tier 3 (allow)', () => {
    expect(riskTierForTool('mystery')).toBe(3)
    expect(autoDenyTier(3)).toBe(false)
  })
})
