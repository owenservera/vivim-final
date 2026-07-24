import { beforeEach, describe, expect, it } from 'bun:test'
import { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { KnowledgeExtractorContinuous } from '../../../src/engines/knowledge-extractor-continuous.js'
import type { KnowledgeExtractor } from '../../../src/engines/knowledge-extractor.js'
import type { MemoryEngine, SemanticMemoryInput } from '../../../src/engines/memory-engine.js'

function mockExtractor(): KnowledgeExtractor {
  return {
    extractFromMessage: async (_convId, _msgId, _role, content, _ctx) => {
      // Extract a simple fact from the message
      const facts = []
      if (content.includes('TypeScript')) {
        facts.push({
          type: 'fact' as const,
          subject: 'project',
          predicate: 'uses',
          object: 'TypeScript',
          confidence: 0.8,
          sourceConversationId: _convId,
          sourceMessageId: _msgId,
          context: _ctx,
        })
      }
      return facts
    },
  } as KnowledgeExtractor
}

function mockMemory(): { engine: MemoryEngine; facts: SemanticMemoryInput[] } {
  const facts: SemanticMemoryInput[] = []
  return {
    engine: {
      assertFact: async (input: SemanticMemoryInput) => {
        facts.push(input)
      },
    } as unknown as MemoryEngine,
    facts,
  }
}

describe('KnowledgeExtractorContinuous', () => {
  let bus: CapabilityEventBus
  let extractor: KnowledgeExtractor
  let memory: ReturnType<typeof mockMemory>
  let continuous: KnowledgeExtractorContinuous

  beforeEach(() => {
    bus = new CapabilityEventBus()
    extractor = mockExtractor()
    memory = mockMemory()
    continuous = new KnowledgeExtractorContinuous(extractor, bus, memory.engine)
  })

  it('extracts facts from conversation:complete events', async () => {
    continuous.start()

    bus.emit({
      type: 'conversation:complete',
      data: {
        conversationId: 'conv1',
        assistantMessages: [{ id: 'msg1', content: 'We use TypeScript for the project.' }],
        turnSuccess: true,
      },
    })

    // Wait for async processing
    await new Promise((r) => setTimeout(r, 50))

    expect(memory.facts).toHaveLength(1)
    expect(memory.facts[0].subject).toBe('project')
    expect(memory.facts[0].predicate).toBe('uses')
    expect(memory.facts[0].object).toBe('TypeScript')
  })

  it('boosts confidence when turnSuccess is true', async () => {
    continuous.start()

    bus.emit({
      type: 'conversation:complete',
      data: {
        conversationId: 'conv1',
        assistantMessages: [{ id: 'msg1', content: 'We use TypeScript for the project.' }],
        turnSuccess: true,
      },
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(memory.facts).toHaveLength(1)
    // Base confidence 0.8 + boost 0.2 = 1.0 (capped)
    expect(memory.facts[0].confidence).toBe(1.0)
  })

  it('does not boost confidence when turnSuccess is false', async () => {
    continuous.start()

    bus.emit({
      type: 'conversation:complete',
      data: {
        conversationId: 'conv1',
        assistantMessages: [{ id: 'msg1', content: 'We use TypeScript for the project.' }],
        turnSuccess: false,
      },
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(memory.facts).toHaveLength(1)
    // Base confidence 0.8 + no boost = 0.8
    expect(memory.facts[0].confidence).toBe(0.8)
  })

  it('processes multiple messages in one event', async () => {
    continuous.start()

    bus.emit({
      type: 'conversation:complete',
      data: {
        conversationId: 'conv1',
        assistantMessages: [
          { id: 'msg1', content: 'We use TypeScript.' },
          { id: 'msg2', content: 'The project is TypeScript-based.' },
        ],
        turnSuccess: true,
      },
    })

    await new Promise((r) => setTimeout(r, 50))

    expect(memory.facts).toHaveLength(2)
  })

  it('continues processing if one message fails', async () => {
    let callCount = 0
    const failingExtractor = {
      extractFromMessage: async (_convId: string, msgId: string) => {
        callCount++
        if (msgId === 'msg1') throw new Error('Extraction failed')
        return [
          {
            type: 'fact' as const,
            subject: 'project',
            predicate: 'uses',
            object: 'TypeScript',
            confidence: 0.8,
            sourceConversationId: _convId,
            sourceMessageId: msgId,
            context: '',
          },
        ]
      },
    } as KnowledgeExtractor

    const failingContinuous = new KnowledgeExtractorContinuous(failingExtractor, bus, memory.engine)
    failingContinuous.start()

    bus.emit({
      type: 'conversation:complete',
      data: {
        conversationId: 'conv1',
        assistantMessages: [
          { id: 'msg1', content: 'This will fail.' },
          { id: 'msg2', content: 'We use TypeScript.' },
        ],
        turnSuccess: true,
      },
    })

    await new Promise((r) => setTimeout(r, 50))

    // Both messages were attempted
    expect(callCount).toBe(2)
    // Only the second one succeeded
    expect(memory.facts).toHaveLength(1)
  })
})
