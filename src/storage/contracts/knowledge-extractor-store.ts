// src/storage/contracts/knowledge-extractor-store.ts
// KnowledgeExtractorStore — data access contract for KnowledgeExtractor.
// Full implementation in unit 15.5; forward declaration for 15.1 dependency.

export interface KnowledgeExtractorStore {
  createEntity(input: {
    id: string
    name: string
    type: string
    description: string | null
    confidence: number
    firstSeenAt: number
    lastSeenAt: number
  }): Promise<void>
  updateEntity(id: string, patch: { confidence?: number; lastSeenAt?: number }): Promise<void>
  findEntityByName(
    name: string,
    type: string,
  ): Promise<{ id: string; name: string; type: string } | null>
  createEntityMention(input: {
    id: string
    entityId: string
    conversationId: string
    messageId: string
    context: string
    confidence: number
    ts: number
  }): Promise<void>
  createDecision(input: {
    id: string
    conversationId: string
    messageId: string
    decisionText: string
    rationale: string | null
    alternatives: string
    confidence: number
    ts: number
  }): Promise<void>
  createPattern(input: {
    id: string
    name: string
    description: string
    patternType: string
    occurrences: number
    confidence: number
    firstSeenAt: number
    lastSeenAt: number
  }): Promise<void>
  updatePattern(
    id: string,
    patch: { occurrences?: number; confidence?: number; lastSeenAt?: number },
  ): Promise<void>
  findPattern(name: string): Promise<{ id: string; name: string } | null>
  assertSemanticMemory(input: {
    id: string
    subject: string
    predicate: string
    objectJson: string
    confidence: number
    source: string
    timestamp: number
    expiresAt: number | null
  }): Promise<void>
}
