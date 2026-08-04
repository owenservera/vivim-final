// impl/memory-engine-patch.ts
// Patches for the 6 stub methods in MemoryEngine (src/engines/memory-engine.ts).
//
// These are the exact code changes needed to replace the stubs that currently
// only emit events or return empty arrays. Each patched method now:
//   1. Uses MemoryIntelligenceStore for persistence
//   2. Returns the created/queried records
//   3. Still emits events (keeps existing behavior)
//
// Apply by replacing the corresponding methods in the MemoryEngine class.

import { newId } from '../src/ids.js'
import type { MemoryIntelligenceStore } from './memory-store.js'

// ── Patch 1: recordEntity ──────────────────────────────────────────────────
//
// BEFORE (lines 579-590 in memory-engine.ts):
//
//   async recordEntity(input: {
//     name: string
//     type: string
//     description?: string
//     conversationId?: string
//     messageId?: string
//   }): Promise<void> {
//     this.eventBus.emit({
//       type: 'memory:entity_recorded',
//       data: { name: input.name, type: input.type },
//     })
//   }
//
// AFTER:

export async function recordEntity(
  this: {
    intelligenceStore: MemoryIntelligenceStore
    eventBus: { emit: (e: unknown) => void }
  },
  input: {
    name: string
    type: string
    description?: string
    conversationId?: string
    messageId?: string
  },
): Promise<{ id: string; name: string; type: string }> {
  // Check if entity already exists (by unique name+type)
  const existing = await this.intelligenceStore.findByName(input.name)
  if (existing && existing.type === input.type) {
    // Entity exists — increment mention count and optionally create a mention
    await this.intelligenceStore.incrementMentionCount(existing.id)
    if (input.conversationId && input.messageId) {
      await this.intelligenceStore.createEntityMention({
        entityId: existing.id,
        conversationId: input.conversationId,
        messageId: input.messageId,
        context: input.description ?? '',
      })
    }
    this.eventBus.emit({
      type: 'memory:entity_recorded',
      data: { id: existing.id, name: input.name, type: input.type },
    })
    return { id: existing.id, name: existing.name, type: existing.type }
  }

  // Create new entity
  const entity = await this.intelligenceStore.createEntity({
    name: input.name,
    type: input.type,
    description: input.description,
  })

  // Create mention if conversation context is provided
  if (input.conversationId && input.messageId) {
    await this.intelligenceStore.createEntityMention({
      entityId: entity.id,
      conversationId: input.conversationId,
      messageId: input.messageId,
      context: input.description ?? '',
    })
  }

  this.eventBus.emit({
    type: 'memory:entity_recorded',
    data: { id: entity.id, name: entity.name, type: entity.type },
  })
  return { id: entity.id, name: entity.name, type: entity.type }
}

// ── Patch 2: recordDecision ────────────────────────────────────────────────
//
// BEFORE (lines 592-603):
//
//   async recordDecision(input: {
//     conversationId: string
//     messageId: string
//     decisionText: string
//     rationale?: string
//     alternatives?: string[]
//   }): Promise<void> {
//     this.eventBus.emit({
//       type: 'memory:decision_recorded',
//       data: { conversationId: input.conversationId, decisionText: input.decisionText },
//     })
//   }
//
// AFTER:

export async function recordDecision(
  this: {
    intelligenceStore: MemoryIntelligenceStore
    eventBus: { emit: (e: unknown) => void }
  },
  input: {
    conversationId: string
    messageId: string
    decisionText: string
    rationale?: string
    alternatives?: string[]
  },
): Promise<{ id: string; conversationId: string; decisionText: string }> {
  const record = await this.intelligenceStore.createDecisionRecord({
    conversationId: input.conversationId,
    messageId: input.messageId,
    decisionText: input.decisionText,
    rationale: input.rationale,
    alternatives: input.alternatives,
  })

  this.eventBus.emit({
    type: 'memory:decision_recorded',
    data: {
      id: record.id,
      conversationId: input.conversationId,
      decisionText: input.decisionText,
    },
  })
  return {
    id: record.id,
    conversationId: record.conversationId,
    decisionText: record.decisionText,
  }
}

// ── Patch 3: recordPattern ─────────────────────────────────────────────────
//
// BEFORE (lines 605-614):
//
//   async recordPattern(input: {
//     name: string
//     description: string
//     patternType: string
//   }): Promise<void> {
//     this.eventBus.emit({
//       type: 'memory:pattern_recorded',
//       data: { name: input.name, patternType: input.patternType },
//     })
//   }
//
// AFTER:

export async function recordPattern(
  this: {
    intelligenceStore: MemoryIntelligenceStore
    eventBus: { emit: (e: unknown) => void }
  },
  input: {
    name: string
    description: string
    patternType: string
  },
): Promise<{ id: string; name: string; patternType: string }> {
  // Check if pattern already exists (by unique name+patternType)
  const existing = await this.intelligenceStore.listPatternExtracts({ patternType: input.patternType })
  const match = existing.find((p) => p.name === input.name)

  if (match) {
    // Pattern exists — increment occurrences
    await this.intelligenceStore.incrementOccurrences(match.id)
    this.eventBus.emit({
      type: 'memory:pattern_recorded',
      data: { id: match.id, name: input.name, patternType: input.patternType },
    })
    return { id: match.id, name: match.name, patternType: match.patternType }
  }

  // Create new pattern
  const pattern = await this.intelligenceStore.createPatternExtract({
    name: input.name,
    description: input.description,
    patternType: input.patternType,
  })

  this.eventBus.emit({
    type: 'memory:pattern_recorded',
    data: { id: pattern.id, name: pattern.name, patternType: pattern.patternType },
  })
  return { id: pattern.id, name: pattern.name, patternType: pattern.patternType }
}

// ── Patch 4: getTopics ─────────────────────────────────────────────────────
//
// BEFORE (lines 616-618):
//
//   async getTopics(): Promise<Array<{ id: string; name: string; description: string | null }>> {
//     return []
//   }
//
// AFTER:

export async function getTopics(
  this: { intelligenceStore: MemoryIntelligenceStore },
): Promise<Array<{ id: string; name: string; description: string | null }>> {
  const topics = await this.intelligenceStore.listTopics()
  return topics.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }))
}

// ── Patch 5: getProjects ──────────────────────────────────────────────────
//
// BEFORE (lines 620-624):
//
//   async getProjects(): Promise<
//     Array<{ id: string; name: string; description: string | null; status: string }>
//   > {
//     return []
//   }
//
// AFTER:

export async function getProjects(
  this: { intelligenceStore: MemoryIntelligenceStore },
): Promise<
  Array<{ id: string; name: string; description: string | null; status: string }>
> {
  const projects = await this.intelligenceStore.listProjects()
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
  }))
}

// ── Patch 6: assignTopic ──────────────────────────────────────────────────
//
// BEFORE (lines 626-631):
//
//   async assignTopic(conversationId: string, topicId: string): Promise<void> {
//     this.eventBus.emit({
//       type: 'memory:topic_assigned',
//       data: { conversationId, topicId },
//     })
//   }
//
// AFTER:

export async function assignTopic(
  this: {
    intelligenceStore: MemoryIntelligenceStore
    eventBus: { emit: (e: unknown) => void }
  },
  conversationId: string,
  topicId: string,
  assignmentType: 'auto' | 'manual' = 'auto',
): Promise<void> {
  await this.intelligenceStore.assignConversation(
    conversationId,
    topicId,
    assignmentType,
  )

  this.eventBus.emit({
    type: 'memory:topic_assigned',
    data: { conversationId, topicId, assignmentType },
  })
}

// ── Constructor patch ──────────────────────────────────────────────────────
//
// The MemoryEngine constructor must be updated to accept an
// optional MemoryIntelligenceStore. Add this to the constructor:
//
// BEFORE:
//
//   constructor(
//     private readonly episodic: EpisodicMemoryStore,
//     private readonly semantic: SemanticMemoryStore,
//     private readonly procedural: ProceduralMemoryStore,
//     private readonly eventBus: CapabilityEventBus,
//   ) {}
//
// AFTER:
//
//   constructor(
//     private readonly episodic: EpisodicMemoryStore,
//     private readonly semantic: SemanticMemoryStore,
//     private readonly procedural: ProceduralMemoryStore,
//     private readonly eventBus: CapabilityEventBus,
//     private readonly intelligenceStore?: MemoryIntelligenceStore,
//   ) {}
//
// And add a setter for late wiring:
//
//   setIntelligenceStore(store: MemoryIntelligenceStore): void {
//     (this as { intelligenceStore?: MemoryIntelligenceStore }).intelligenceStore = store
//   }
