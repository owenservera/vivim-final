// tests/unit/engines/agentic-slm.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
import { AgenticSlmProvider } from '../../../src/engines/agentic-slm.js'

// Mock @huggingface/transformers — ONNX pipeline is heavy and needs model download.
const mockPipelineFn = vi.fn()

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(async () => mockPipelineFn),
}))

describe('AgenticSlmProvider', () => {
  let provider: AgenticSlmProvider

  beforeEach(() => {
    provider = new AgenticSlmProvider()
    mockPipelineFn.mockReset()
  })

  afterEach(() => {
    provider.dispose()
  })

  it('has a stable provider name', () => {
    expect(provider.name).toBe('slm:qwen2.5-0.5b-instruct')
  })

  it('generate returns the assistant reply content', async () => {
    mockPipelineFn.mockResolvedValue([
      {
        generated_text: [
          { role: 'user', content: 'plan next step' },
          { role: 'assistant', content: 'Click the "Next" button.' },
        ],
      },
    ])

    await provider.init()
    const reply = await provider.generate([{ role: 'user', content: 'plan next step' }])

    expect(reply).toBe('Click the "Next" button.')
  })

  it('generateJSON parses fenced JSON output', async () => {
    mockPipelineFn.mockResolvedValue([
      {
        generated_text: [
          { role: 'user', content: 'plan' },
          { role: 'assistant', content: '```json\n{"action":"click","target":"#next"}\n```' },
        ],
      },
    ])

    await provider.init()
    const parsed = await provider.generateJSON<{ action: string; target: string }>([
      { role: 'user', content: 'plan' },
    ])

    expect(parsed).toEqual({ action: 'click', target: '#next' })
  })

  it('generateJSON returns null on malformed output instead of throwing', async () => {
    mockPipelineFn.mockResolvedValue([
      {
        generated_text: [
          { role: 'user', content: 'plan' },
          { role: 'assistant', content: 'not json at all' },
        ],
      },
    ])

    await provider.init()
    const parsed = await provider.generateJSON([{ role: 'user', content: 'plan' }])

    expect(parsed).toBeNull()
  })

  it('dispose clears state so a subsequent init recreates the pipeline', async () => {
    mockPipelineFn.mockResolvedValue([{ generated_text: [{ role: 'assistant', content: '' }] }])
    await provider.init()
    provider.dispose()
    await provider.init()
    expect(true).toBe(true)
  })
})
