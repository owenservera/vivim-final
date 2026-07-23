import { describe, expect, it, mock } from 'bun:test'
import { captureAndStore } from '../../../../src/engines/harness/stream-capture-reconstruct.js'

function makeBlockStore() {
  return { storeBlocks: mock(async () => {}) } as any
}

function makeSink() {
  return {
    onBlock: mock(() => {}),
    onDone: mock(() => {}),
    onError: mock(() => {}),
  } as any
}

describe('stream-capture-reconstruct', () => {
  const target = { conversationId: 'c1', messageId: 'm1', bindingId: 'b1' }

  it('returns startSequence for undefined raw', async () => {
    const seq = await captureAndStore(undefined, target, makeBlockStore(), makeSink(), 0)
    expect(seq).toBe(0)
  })

  it('returns startSequence for empty raw', async () => {
    const seq = await captureAndStore('', target, makeBlockStore(), makeSink(), 0)
    expect(seq).toBe(0)
  })

  it('stores blocks and emits to sink', async () => {
    const blockStore = makeBlockStore()
    const sink = makeSink()
    const seq = await captureAndStore('Hello world', target, blockStore, sink, 5)
    expect(seq).toBe(6)
    expect(blockStore.storeBlocks).toHaveBeenCalled()
    expect(sink.onBlock).toHaveBeenCalledTimes(1)
    const block = sink.onBlock.mock.calls[0][0]
    expect(block.sequence).toBe(5)
    expect(block.bindingId).toBe('b1')
    expect(block.blockKind).toBe('text')
  })

  it('handles multiple paragraphs', async () => {
    const sink = makeSink()
    const seq = await captureAndStore('Para 1\n\nPara 2', target, makeBlockStore(), sink, 0)
    expect(seq).toBe(2)
    expect(sink.onBlock).toHaveBeenCalledTimes(2)
  })

  it('detects code blocks', async () => {
    const sink = makeSink()
    await captureAndStore('```\nconst x = 1\n```', target, makeBlockStore(), sink, 0)
    expect(sink.onBlock.mock.calls[0][0].blockKind).toBe('code')
  })
})
