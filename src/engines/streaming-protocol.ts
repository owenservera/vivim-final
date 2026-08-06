// src/engines/streaming-protocol.ts
// StreamingProtocol — progressive block delivery during capture

import type { ContentBlock } from '../schema/streaming.js'
import type { StreamBlockStoreContract } from '../storage/contracts/stream-block-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface StreamingEvent {
  type:
    | 'conversation:stream_start'
    | 'conversation:block'
    | 'conversation:stream_end'
    | 'conversation:complete'
  conversationId: string
  messageId?: string
  block?: ContentBlock
  blocks?: ContentBlock[]
  timestamp: number
}

export type StreamingEventHandler = (event: StreamingEvent) => void

export interface ParserModule {
  parse(rawBody: string): ContentBlock[]
  parseIncremental?(chunks: AsyncIterable<string>): AsyncIterable<ContentBlock[]>
}

// ── Engine ──────────────────────────────────────────────────────────────

export class StreamingProtocol {
  private handlers: StreamingEventHandler[] = []
  private blockBuffer: ContentBlock[] = []
  private currentConversationId = ''
  private currentMessageId = ''
  private eventBus: CapabilityEventBus | null = null

  constructor(
    private readonly parser: ParserModule,
    private readonly store?: StreamBlockStoreContract,
    eventBus?: CapabilityEventBus,
  ) {
    this.eventBus = eventBus ?? null
  }

  onEvent(handler: StreamingEventHandler): () => void {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler)
    }
  }

  private emit(event: StreamingEvent): void {
    for (const handler of this.handlers) {
      handler(event)
    }
    // Bridge conversation events to CapabilityEventBus (P0-3)
    // This allows the WebSocket forwarder in websocket.ts to deliver them
    if (
      this.eventBus &&
      ['conversation:block', 'conversation:complete', 'conversation:error'].includes(
        event.type as string,
      )
    ) {
      try {
        this.eventBus.emit(event as unknown as { type: string; [key: string]: unknown })
      } catch {
        // Non-fatal: best-effort bridge
      }
    }
  }

  async startConversation(conversationId: string): Promise<string> {
    const messageId = `msg_${Date.now()}`
    this.blockBuffer = []
    this.currentConversationId = conversationId
    this.currentMessageId = messageId

    this.emit({
      type: 'conversation:stream_start',
      conversationId,
      messageId,
      timestamp: Date.now(),
    })

    return messageId
  }

  async captureChunk(
    conversationId: string,
    messageId: string,
    chunk: string,
  ): Promise<ContentBlock[]> {
    const blocks = this.parser.parse(chunk)

    for (const block of blocks) {
      this.blockBuffer.push(block)
      this.emit({
        type: 'conversation:block',
        conversationId,
        messageId,
        block,
        timestamp: Date.now(),
      })
    }

    if (this.store && blocks.length > 0) {
      await this.store.storeBlocks(conversationId, messageId, blocks)
    }

    return blocks
  }

  async finishConversation(conversationId: string, messageId: string): Promise<ContentBlock[]> {
    const allBlocks = [...this.blockBuffer]

    this.emit({
      type: 'conversation:stream_end',
      conversationId,
      messageId,
      blocks: allBlocks,
      timestamp: Date.now(),
    })

    if (this.store && allBlocks.length > 0) {
      await this.store.storeBlocks(conversationId, messageId, allBlocks)
    }

    this.emit({
      type: 'conversation:complete',
      conversationId,
      messageId,
      blocks: allBlocks,
      timestamp: Date.now(),
    })

    this.blockBuffer = []
    return allBlocks
  }

  async processIncremental(
    conversationId: string,
    messageId: string,
    chunks: AsyncIterable<string>,
  ): Promise<ContentBlock[]> {
    if (this.parser.parseIncremental) {
      const allBlocks: ContentBlock[] = []
      for await (const blocks of this.parser.parseIncremental(chunks)) {
        for (const block of blocks) {
          allBlocks.push(block)
          this.emit({
            type: 'conversation:block',
            conversationId,
            messageId,
            block,
            timestamp: Date.now(),
          })
        }
      }
      return allBlocks
    }

    const allBlocks: ContentBlock[] = []
    for await (const chunk of chunks) {
      const blocks = await this.captureChunk(conversationId, messageId, chunk)
      allBlocks.push(...blocks)
    }
    return allBlocks
  }
}
