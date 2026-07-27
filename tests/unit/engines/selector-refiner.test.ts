// tests/unit/engines/selector-refiner.test.ts
// SelectorRefiner — LLM-driven CSS selector refinement for chat UIs.
import { describe, expect, it, mock } from 'bun:test'
import { SelectorRefiner } from '../../../src/engines/selector-refiner.js'
import type { LlmClient } from '../../../src/engines/format-classifier.js'

function createMockLlmClient(response: string): LlmClient {
  return { complete: mock(() => Promise.resolve(response)) }
}

describe('SelectorRefiner', () => {
  it('returns refined selectors from LLM response', async () => {
    const llmResponse = JSON.stringify({
      composer: '#prompt-textarea',
      sendButton: 'button[data-testid="send-button"]',
      responseContainer: '.assistant-message',
      rationale: 'Stable selectors based on data-testid attributes',
    })
    const client = createMockLlmClient(llmResponse)
    const refiner = new SelectorRefiner(client)
    const result = await refiner.refine(
      'https://chatgpt.com',
      '<div id="prompt-textarea" contenteditable="true"></div>',
      { composers: [], buttons: [] },
    )
    expect(result.composer).toBe('#prompt-textarea')
    expect(result.sendButton).toBe('button[data-testid="send-button"]')
    expect(result.responseContainer).toBe('.assistant-message')
    expect(result.rationale).toContain('Stable selectors')
  })

  it('extracts JSON from markdown-wrapped response', async () => {
    const inner = JSON.stringify({
      composer: '.ql-editor',
      sendButton: 'button.send',
      responseContainer: '.response',
      rationale: 'Quill editor',
    })
    const client = createMockLlmClient('```json\n' + inner + '\n```')
    const refiner = new SelectorRefiner(client)
    const result = await refiner.refine(
      'https://gemini.google.com',
      '<div class="ql-editor"></div>',
      { composers: [], buttons: [] },
    )
    expect(result.composer).toBe('.ql-editor')
  })

  it('throws SelectorRefinerError on empty page snapshot', async () => {
    const client = createMockLlmClient('{}')
    const refiner = new SelectorRefiner(client)
    await expect(
      refiner.refine('https://example.com', '', { composers: [], buttons: [] }),
    ).rejects.toThrow('SelectorRefinerError')
  })

  it('throws SelectorRefinerError when LLM response missing composer', async () => {
    const llmResponse = JSON.stringify({
      sendButton: '#send',
      rationale: 'test',
    })
    const client = createMockLlmClient(llmResponse)
    const refiner = new SelectorRefiner(client)
    await expect(
      refiner.refine('https://example.com', '<div></div>', { composers: [], buttons: [] }),
    ).rejects.toThrow('SelectorRefinerError')
  })

  it('throws SelectorRefinerError when LLM response missing sendButton', async () => {
    const llmResponse = JSON.stringify({
      composer: '#input',
      rationale: 'test',
    })
    const client = createMockLlmClient(llmResponse)
    const refiner = new SelectorRefiner(client)
    await expect(
      refiner.refine('https://example.com', '<div></div>', { composers: [], buttons: [] }),
    ).rejects.toThrow('SelectorRefinerError')
  })

  it('throws SelectorRefinerError on invalid JSON response', async () => {
    const client = createMockLlmClient('not json at all')
    const refiner = new SelectorRefiner(client)
    await expect(
      refiner.refine('https://example.com', '<div></div>', { composers: [], buttons: [] }),
    ).rejects.toThrow('SelectorRefinerError')
  })

  it('sends probe results to LLM', async () => {
    const llmResponse = JSON.stringify({
      composer: '#input',
      sendButton: '#send',
      responseContainer: '.messages',
      rationale: 'test',
    })
    const client = createMockLlmClient(llmResponse)
    const refiner = new SelectorRefiner(client)
    const probeResults = {
      composers: [{ selector: '#existing', score: 0.5 }],
      buttons: [{ selector: '#btn', score: 0.3 }],
    }
    await refiner.refine('https://example.com', '<div></div>', probeResults)
    // Verify the LLM was called with the probe results serialized
    const callArg = (client.complete as any).mock.calls[0][0]
    expect(callArg).toContain('#existing')
    expect(callArg).toContain('#btn')
  })

  it('truncates snapshot to 8000 chars', async () => {
    const llmResponse = JSON.stringify({
      composer: '#input',
      sendButton: '#send',
      responseContainer: '',
      rationale: 'test',
    })
    const client = createMockLlmClient(llmResponse)
    const refiner = new SelectorRefiner(client)
    const bigSnapshot = 'x'.repeat(10000)
    await refiner.refine('https://example.com', bigSnapshot, { composers: [], buttons: [] })
    const callArg = (client.complete as any).mock.calls[0][0]
    // The snapshot in the prompt should be truncated
    expect(callArg.length).toBeLessThan(10000 + 500)
  })
})
