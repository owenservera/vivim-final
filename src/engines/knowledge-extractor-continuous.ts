// src/engines/knowledge-extractor-continuous.ts
// KnowledgeExtractorContinuous — runs extraction on every assistant message in the background.
// Subscribes to conversation:complete events and applies confidence boost for successful turns.

import { catchDebug } from '../lib/catch-logger.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { KnowledgeExtractor } from './knowledge-extractor.js'
import type { MemoryEngine } from './memory-engine.js'

interface ConversationCompleteEvent {
  conversationId: string
  assistantMessages: Array<{ id: string; content: string }>
  turnSuccess: boolean // from agentic loop reflection signal
}

export class KnowledgeExtractorContinuous {
  private running = false

  constructor(
    private extractor: KnowledgeExtractor,
    private bus: CapabilityEventBus,
    private memory: MemoryEngine,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true

    this.bus.on('conversation:complete', (evt) => {
      const data = (evt as { data?: ConversationCompleteEvent }).data
      if (data) {
        void this.onComplete(data)
      }
    })
  }

  stop(): void {
    this.running = false
    // Note: event bus doesn't support unsubscribe, but this is acceptable
    // for the continuous extractor lifecycle
  }

  private async onComplete(evt: ConversationCompleteEvent): Promise<void> {
    for (const msg of evt.assistantMessages) {
      try {
        const results = await this.extractor.extractFromMessage(
          evt.conversationId,
          msg.id,
          'assistant',
          msg.content,
          msg.content.slice(0, 200),
        )

        const boost = evt.turnSuccess ? 0.2 : 0

        for (const fact of results) {
          await this.memory.assertFact({
            subject: fact.subject,
            predicate: fact.predicate,
            object: fact.object,
            confidence: Math.min(1, fact.confidence + boost),
            source: 'extraction',
          })
        }
      } catch (err) {
        catchDebug(err, 'engines:knowledge-extractor-continuous:64')
        // Continue processing other messages even if one fails
      }
    }
  }
}
