// src/engines/knowledge-extractor.ts
// KnowledgeExtractor — analyze messages and extract entities, decisions, facts.
// Full implementation in unit 15.5; forward declaration for 15.1 dependency.

import type { KnowledgeExtractorStore } from '../storage/contracts/knowledge-extractor-store.js'

export type ExtractionType =
  | 'fact' | 'decision' | 'entity_person' | 'entity_project'
  | 'entity_technology' | 'entity_concept' | 'pattern' | 'preference' | 'summary'

export interface ExtractionResult {
  type: ExtractionType
  subject: string
  predicate: string
  object: unknown
  confidence: number
  sourceConversationId: string
  sourceMessageId: string
  context: string
}

export interface KnowledgeExtractorConfig {
  batchSize: number
  confidenceThreshold: number
  enableEntityExtraction: boolean
  enableDecisionExtraction: boolean
  enablePatternMining: boolean
}

export class KnowledgeExtractor {
  constructor(
    private store: KnowledgeExtractorStore,
    private config: KnowledgeExtractorConfig,
  ) {}

  async extractFromMessage(
    conversationId: string, messageId: string, role: string, content: string, context: string,
  ): Promise<ExtractionResult[]> {
    return []
  }

  async extractFromConversation(
    conversationId: string, messages: Array<{ id: string; role: string; content: string }>,
  ): Promise<ExtractionResult[]> {
    return []
  }

  async batchExtract(
    conversations: Array<{ id: string; messages: Array<{ id: string; role: string; content: string }> }>,
  ): Promise<{ totalExtracted: number; byType: Record<ExtractionType, number> }> {
    return { totalExtracted: 0, byType: {} as Record<ExtractionType, number> }
  }
}
