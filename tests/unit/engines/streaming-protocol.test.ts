import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  type ParserModule,
  type StreamingEvent,
  StreamingProtocol,
} from '../../../src/engines/streaming-protocol.js'

function makeParser(): ParserModule {
  return {
    parse: (raw: string) => [{ kind: 'text', content: raw, index: 0 }],
  }
}

function makeStore() {
  return {
    storeBlocks: mock(() => Promise.resolve()),
    getBlocksByConversation: mock(() => Promise.resolve([])),
    getBlocksByMessage: mock(() => Promise.resolve([])),
  }
}

describe('StreamingProtocol', () => {
  let parser: ParserModule
  let store: ReturnType<typeof makeStore>
  let protocol: StreamingProtocol

  beforeEach(() => {
    parser = makeParser()
    store = makeStore()
    protocol = new StreamingProtocol(parser, store as any)
  })

  test('captureChunk persists blocks to store', async () => {
    const msgId = await protocol.startConversation('conv1')
    const blocks = await protocol.captureChunk('conv1', msgId, 'hello world')
    expect(blocks).toHaveLength(1)
    expect(store.storeBlocks).toHaveBeenCalledWith('conv1', msgId, blocks)
  })

  test('captureChunk without store does not throw', async () => {
    const noStoreProtocol = new StreamingProtocol(parser)
    const msgId = await noStoreProtocol.startConversation('conv1')
    const blocks = await noStoreProtocol.captureChunk('conv1', msgId, 'test')
    expect(blocks).toHaveLength(1)
  })

  test('finishConversation persists accumulated blocks', async () => {
    const msgId = await protocol.startConversation('conv1')
    await protocol.captureChunk('conv1', msgId, 'block1')
    await protocol.captureChunk('conv1', msgId, 'block2')
    store.storeBlocks.mockClear()
    const all = await protocol.finishConversation('conv1', msgId)
    expect(all).toHaveLength(2)
    expect(store.storeBlocks).toHaveBeenCalledWith('conv1', msgId, all)
  })

  test('emits stream_start, block, stream_end, complete events', async () => {
    const events: StreamingEvent[] = []
    protocol.onEvent((e) => events.push(e))
    const msgId = await protocol.startConversation('conv1')
    await protocol.captureChunk('conv1', msgId, 'text')
    await protocol.finishConversation('conv1', msgId)
    const types = events.map((e) => e.type)
    expect(types).toEqual([
      'conversation:stream_start',
      'conversation:block',
      'conversation:stream_end',
      'conversation:complete',
    ])
  })
})
