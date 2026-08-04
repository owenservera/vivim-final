// src/storage/contracts/memory-intelligence-store.ts
// Contract interface for memory intelligence storage.
// Engines depend on this; implementations live in storage/impl/.

import type {
  DecisionRecordRow,
  EntityMentionRow,
  EntityRow,
  PatternExtractRow,
  ProjectRow,
  TopicRow,
} from '../impl/memory-intelligence-store-impl.js'

export type { DecisionRecordRow, EntityMentionRow, EntityRow, PatternExtractRow, ProjectRow, TopicRow }

export interface MemoryIntelligenceStore {
  // Entity
  findByName(name: string): Promise<EntityRow | null>
  createEntity(input: { name: string; type: string; description?: string; confidence?: number }): Promise<EntityRow>
  incrementMentionCount(id: string): Promise<void>
  createEntityMention(input: { entityId: string; conversationId: string; messageId: string; context: string }): Promise<EntityMentionRow>

  // Decision
  createDecisionRecord(input: { conversationId: string; messageId: string; decisionText: string; rationale?: string; alternatives?: string[] }): Promise<DecisionRecordRow>

  // Pattern
  listPatternExtracts(filter: { patternType?: string; limit?: number }): Promise<PatternExtractRow[]>
  incrementOccurrences(id: string): Promise<void>
  createPatternExtract(input: { name: string; description: string; patternType: string }): Promise<PatternExtractRow>

  // Topic
  listTopics(): Promise<TopicRow[]>

  // Project
  listProjects(): Promise<ProjectRow[]>

  // Conversation assignment
  assignConversation(conversationId: string, topicId: string, assignmentType?: string, confidence?: number): Promise<void>
}
