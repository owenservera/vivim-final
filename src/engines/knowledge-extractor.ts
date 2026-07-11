// src/engines/knowledge-extractor.ts
// KnowledgeExtractor — analyze messages and extract entities, decisions, facts.

import type { KnowledgeExtractorStore } from '../storage/contracts/knowledge-extractor-store.js'
import { newId } from '../ids.js'

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

const ENTITY_PATTERNS: Record<string, RegExp> = {
  technology: /\b(React|Vue|Angular|TypeScript|Python|Rust|Go|Node\.js|PostgreSQL|MongoDB|Redis|Docker|Kubernetes|AWS|GCP|Azure)\b/gi,
  person: /\b(?:@|by |from )([A-Z][a-z]+ [A-Z][a-z]+)\b/g,
  project: /\b(?:project|app|system) ["']?([A-Z][a-zA-Z0-9_-]+)["']?\b/g,
}

const DECISION_PATTERNS = [
  /\b(?:I|we) (?:decided|chose|will|should|need to) (.+)/gi,
  /\b(?:let's|lets) (?:go with|use|try) (.+)/gi,
  /\b(?:the|our) (?:decision|choice|approach) (?:is|will be) (.+)/gi,
]

const FACT_PATTERNS = [
  /\b(.+?) (?:is|are|was|were) (.+?)[.]/g,
]

export class KnowledgeExtractor {
  constructor(
    private store: KnowledgeExtractorStore,
    private config: KnowledgeExtractorConfig,
  ) {}

  async extractFromMessage(
    conversationId: string, messageId: string, role: string, content: string, context: string,
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = []
    const combinedContext = context || content.slice(0, 200)

    if (this.config.enableEntityExtraction) {
      for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
        pattern.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const name = match[1] ?? match[0]
          const normalizedType = type === 'technology' ? 'entity_technology'
            : type === 'person' ? 'entity_person'
            : type === 'project' ? 'entity_project'
            : 'entity_concept'
          const confidence = normalizedType === 'entity_technology' ? 0.9 : 0.7

          const existing = await this.store.findEntityByName(name, normalizedType)
          if (existing) {
            await this.store.updateEntity(existing.id, {
              confidence: Math.min(1.0, (confidence + 0.1)),
              lastSeenAt: Date.now(),
            })
          } else {
            const entityId = newId()
            await this.store.createEntity({
              id: entityId, name, type: normalizedType, description: null,
              confidence, firstSeenAt: Date.now(), lastSeenAt: Date.now(),
            })
          }

          results.push({
            type: normalizedType as ExtractionType,
            subject: name,
            predicate: 'mentioned_in',
            object: { match: match[0] },
            confidence,
            sourceConversationId: conversationId,
            sourceMessageId: messageId,
            context: combinedContext,
          })
        }
      }
    }

    if (this.config.enableDecisionExtraction) {
      for (const pattern of DECISION_PATTERNS) {
        pattern.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = pattern.exec(content)) !== null) {
          const decisionText = match[1]!.trim()
          const decisionId = newId()
          await this.store.createDecision({
            id: decisionId, conversationId, messageId,
            decisionText, rationale: null, alternatives: '',
            confidence: 0.8, ts: Date.now(),
          })

          results.push({
            type: 'decision',
            subject: role === 'user' ? 'user' : 'assistant',
            predicate: 'decided',
            object: decisionText,
            confidence: 0.8,
            sourceConversationId: conversationId,
            sourceMessageId: messageId,
            context: combinedContext,
          })
        }
      }
    }

    for (const pattern of FACT_PATTERNS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(content)) !== null) {
        const subject = match[1]!.trim()
        const object = match[2]!.trim()
        if (subject.length > 100) continue

        results.push({
          type: 'fact',
          subject,
          predicate: 'is',
          object,
          confidence: 0.5,
          sourceConversationId: conversationId,
          sourceMessageId: messageId,
          context: combinedContext,
        })
      }
    }

    return results.filter(r => r.confidence >= this.config.confidenceThreshold)
  }

  async extractFromConversation(
    conversationId: string, messages: Array<{ id: string; role: string; content: string }>,
  ): Promise<ExtractionResult[]> {
    const all: ExtractionResult[] = []
    for (const msg of messages) {
      const ctx = messages.find(m => m.id === msg.id)
      const results = await this.extractFromMessage(
        conversationId, msg.id, msg.role, msg.content,
        ctx?.content ?? '',
      )
      all.push(...results)
    }
    return all
  }

  async batchExtract(
    conversations: Array<{ id: string; messages: Array<{ id: string; role: string; content: string }> }>,
  ): Promise<{ totalExtracted: number; byType: Record<ExtractionType, number> }> {
    const byType: Record<string, number> = {}
    let total = 0

    for (const conv of conversations) {
      const results = await this.extractFromConversation(conv.id, conv.messages)
      for (const r of results) {
        byType[r.type] = (byType[r.type] ?? 0) + 1
        total++
      }
    }

    return { totalExtracted: total, byType: byType as Record<ExtractionType, number> }
  }
}
