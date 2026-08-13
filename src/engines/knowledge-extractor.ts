// src/engines/knowledge-extractor.ts
// KnowledgeExtractor — analyze messages and extract entities, decisions, facts.
// §5: Embedding-based entity classification + dedup (optional, fail-open).

import { newId } from '../ids.js'
import type { KnowledgeExtractorStore } from '../storage/contracts/knowledge-extractor-store.js'
import { EmbeddingClassifier } from './embedding-classifier.js'
import type { EmbeddingProvider } from './semantic-search.js'

export type ExtractionType =
  | 'fact'
  | 'decision'
  | 'entity_person'
  | 'entity_project'
  | 'entity_technology'
  | 'entity_concept'
  | 'pattern'
  | 'preference'
  | 'summary'

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
  technology:
    /\b(React|Vue|Angular|TypeScript|Python|Rust|Go|Node\.js|PostgreSQL|MongoDB|Redis|Docker|Kubernetes|AWS|GCP|Azure)\b/gi,
  person: /\b(?:@|by |from )([A-Z][a-z]+ [A-Z][a-z]+)\b/g,
  project: /\b(?:project|app|system) ["']?([A-Z][a-zA-Z0-9_-]+)["']?\b/g,
}

const DECISION_PATTERNS = [
  /\b(?:I|we) (?:decided|chose|will|should|need to) (.+)/gi,
  /\b(?:let's|lets) (?:go with|use|try) (.+)/gi,
  /\b(?:the|our) (?:decision|choice|approach) (?:is|will be) (.+)/gi,
]

const FACT_PATTERNS = [/\b(.+?) (?:is|are|was|were) (.+?)[.]/g]

export class KnowledgeExtractor {
  private classifier?: EmbeddingClassifier

  constructor(
    private store: KnowledgeExtractorStore,
    private config: KnowledgeExtractorConfig,
    /** Optional embedding provider for §5: entity classification + dedup. */
    embeddingProvider?: EmbeddingProvider,
  ) {
    if (embeddingProvider) {
      this.classifier = new EmbeddingClassifier(embeddingProvider)
    }
  }

  async extractFromMessage(
    conversationId: string,
    messageId: string,
    role: string,
    content: string,
    context: string,
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = []
    const combinedContext = context || content.slice(0, 200)

    if (this.config.enableEntityExtraction) {
      for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
        pattern.lastIndex = 0
        let match = pattern.exec(content)
        while (match !== null) {
          const name = match[1] ?? match[0]
          const normalizedType =
            type === 'technology'
              ? 'entity_technology'
              : type === 'person'
                ? 'entity_person'
                : type === 'project'
                  ? 'entity_project'
                  : 'entity_concept'

          // §5: Validate entity type with embedding classifier (fail-open).
          let confidence = normalizedType === 'entity_technology' ? 0.9 : 0.7
          if (this.classifier) {
            try {
              const category = await this.classifier.topCategory(name)
              if (category && category !== type) {
                // Classifier disagrees with regex — lower confidence but don't discard
                confidence *= 0.7
              } else if (category === type) {
                // Classifier agrees — boost confidence
                confidence = Math.min(1.0, confidence + 0.1)
              }
            } catch {
              // Fail-open: keep regex-derived confidence
            }
          }

          const existing = await this.store.findEntityByName(name, normalizedType)
          if (existing) {
            await this.store.updateEntity(existing.id, {
              confidence: Math.min(1.0, confidence + 0.1),
              lastSeenAt: Date.now(),
            })
          } else {
            const entityId = newId()
            await this.store.createEntity({
              id: entityId,
              name,
              type: normalizedType,
              description: null,
              confidence,
              firstSeenAt: Date.now(),
              lastSeenAt: Date.now(),
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
          match = pattern.exec(content)
        }
      }
    }

    if (this.config.enableDecisionExtraction) {
      for (const pattern of DECISION_PATTERNS) {
        pattern.lastIndex = 0
        let match = pattern.exec(content)
        while (match !== null) {
          const decisionText = match[1]?.trim()
          if (!decisionText) {
            match = pattern.exec(content)
            continue
          }
          const decisionId = newId()
          await this.store.createDecision({
            id: decisionId,
            conversationId,
            messageId,
            decisionText,
            rationale: null,
            alternatives: '',
            confidence: 0.8,
            ts: Date.now(),
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
          match = pattern.exec(content)
        }
      }
    }

    for (const pattern of FACT_PATTERNS) {
      pattern.lastIndex = 0
      let match = pattern.exec(content)
      while (match !== null) {
        const subj = match[1]?.trim()
        const obj = match[2]?.trim()
        if (!subj || !obj) {
          match = pattern.exec(content)
          continue
        }
        if (subj.length > 100) {
          match = pattern.exec(content)
          continue
        }

        results.push({
          type: 'fact',
          subject: subj,
          predicate: 'is',
          object: obj,
          confidence: 0.5,
          sourceConversationId: conversationId,
          sourceMessageId: messageId,
          context: combinedContext,
        })
        match = pattern.exec(content)
      }
    }

    return results.filter((r) => r.confidence >= this.config.confidenceThreshold)
  }

  /**
   * Continuous-mode extraction (Unit 33.2). Operates on a single message/segment
   * (a "chunk") rather than a whole conversation. It reuses the exact same
   * extraction logic as batch mode (no prompt divergence) and returns the
   * relation edges — entities / decisions / facts — extracted from that chunk.
   */
  async extractIncremental(chunk: {
    conversationId: string
    messageId: string
    role: string
    content: string
    context?: string
  }): Promise<ExtractionResult[]> {
    return this.extractFromMessage(
      chunk.conversationId,
      chunk.messageId,
      chunk.role,
      chunk.content,
      chunk.context ?? '',
    )
  }

  async extractFromConversation(
    conversationId: string,
    messages: Array<{ id: string; role: string; content: string }>,
  ): Promise<ExtractionResult[]> {
    const all: ExtractionResult[] = []
    for (const msg of messages) {
      const ctx = messages.find((m) => m.id === msg.id)
      const results = await this.extractFromMessage(
        conversationId,
        msg.id,
        msg.role,
        msg.content,
        ctx?.content ?? '',
      )
      all.push(...results)
    }
    return all
  }

  async batchExtract(
    conversations: Array<{
      id: string
      messages: Array<{ id: string; role: string; content: string }>
    }>,
  ): Promise<{ totalExtracted: number; byType: Record<ExtractionType, number> }> {
    const byType: Record<string, number> = {}
    let total = 0
    const allResults: ExtractionResult[] = []

    for (const conv of conversations) {
      const results = await this.extractFromConversation(conv.id, conv.messages)
      for (const r of results) {
        byType[r.type] = (byType[r.type] ?? 0) + 1
        total++
        allResults.push(r)
      }
    }

    // §9: Pattern mining — find entity co-occurrence patterns across conversations.
    if (this.config.enablePatternMining && allResults.length > 10) {
      const patternResults = this.mineCoOccurrencePatterns(allResults)
      for (const r of patternResults) {
        byType[r.type] = (byType[r.type] ?? 0) + 1
        total++
      }
    }

    return { totalExtracted: total, byType: byType as Record<ExtractionType, number> }
  }

  /**
   * §9: Mine entity co-occurrence patterns.
   * Finds entity pairs that appear together in 3+ conversations.
   */
  private mineCoOccurrencePatterns(all: ExtractionResult[]): ExtractionResult[] {
    const entityPairs = new Map<string, { count: number; entities: [string, string] }>()

    // Group entities by conversation
    const byConv = new Map<string, ExtractionResult[]>()
    for (const r of all) {
      if (!r.type.startsWith('entity_')) continue
      const existing = byConv.get(r.sourceConversationId)
      if (existing) existing.push(r)
      else byConv.set(r.sourceConversationId, [r])
    }

    // Count co-occurrences within each conversation
    for (const [, extractions] of byConv) {
      const names = extractions.map((e) => e.subject)
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const key = [names[i], names[j]].sort().join('|||')
          const existing = entityPairs.get(key)
          if (existing) existing.count++
          else           entityPairs.set(key, {
            count: 1,
            entities: [names[i] as string, names[j] as string],
          })
        }
      }
    }

    // Emit patterns for pairs appearing in 3+ conversations
    const results: ExtractionResult[] = []
    for (const [, { count, entities }] of entityPairs) {
      if (count >= 3) {
        results.push({
          type: 'pattern',
          subject: entities[0],
          predicate: 'co_occurs',
          object: entities[1],
          confidence: Math.min(0.9, count * 0.15),
          sourceConversationId: 'batch',
          sourceMessageId: 'mined',
          context: `Co-occurs in ${count} conversations`,
        })
      }
    }

    return results
  }
}
