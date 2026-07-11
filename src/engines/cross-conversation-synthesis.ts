// src/engines/cross-conversation-synthesis.ts
// CrossConversationSynthesizer — synthesize answers across conversations.

import type { CrossConversationSynthesizerStore } from '../storage/contracts/cross-conversation-synthesis-store.js'
import type { SemanticSearchEngine } from './semantic-search.js'

export interface SynthesisQuery {
  question: string
  scope: { providerIds?: string[]; topicIds?: string[]; dateFrom?: number; dateTo?: number }
  maxSources: number
  synthesisStyle: 'summary' | 'detailed' | 'bullets'
}

export interface SynthesisResult {
  answer: string
  sources: Array<{ conversationId: string; messageId: string; snippet: string; relevance: number }>
  confidence: number
  gaps: string[]
}

export interface SynthesisLlmProvider {
  synthesize(prompt: string, style: string): Promise<{ text: string; confidence: number }>
}

export class CrossConversationSynthesizer {
  constructor(
    private store: CrossConversationSynthesizerStore,
    private searchEngine: SemanticSearchEngine,
    private llmProvider: SynthesisLlmProvider,
  ) {}

  async synthesize(query: SynthesisQuery): Promise<SynthesisResult> {
    const searchResults = await this.searchEngine.search({
      text: query.question,
      limit: query.maxSources * 2,
      threshold: 0.3,
    })

    const sources: Array<{
      conversationId: string
      messageId: string
      snippet: string
      relevance: number
    }> = []
    const contextParts: string[] = []

    for (const sr of searchResults.slice(0, query.maxSources)) {
      sources.push({
        conversationId: sr.conversationId ?? '',
        messageId: sr.id,
        snippet: '',
        relevance: sr.score,
      })

      const facts = await this.store.getFactsForConversation(sr.conversationId ?? '')
      const decisions = await this.store.getDecisionsForConversation(sr.conversationId ?? '')
      const entities = await this.store.getEntitiesForConversation(sr.conversationId ?? '')

      if (facts.length > 0) {
        contextParts.push(
          `Facts: ${facts.map((f) => `${f.subject} ${f.predicate} ${f.object}`).join(', ')}`,
        )
      }
      if (decisions.length > 0) {
        contextParts.push(`Decisions: ${decisions.map((d) => d.decisionText).join(', ')}`)
      }
      if (entities.length > 0) {
        contextParts.push(`Entities: ${entities.map((e) => `${e.name} (${e.type})`).join(', ')}`)
      }
    }

    const contextBlock =
      contextParts.length > 0 ? `\nRelevant context:\n${contextParts.join('\n')}` : ''
    const prompt = `Question: ${query.question}\n\nBased on the following information from my conversation history, provide a synthesized answer.${contextBlock}\n\nSynthesized answer:`

    let answer: string
    let confidence: number
    try {
      const result = await this.llmProvider.synthesize(prompt, query.synthesisStyle)
      answer = result.text
      confidence = result.confidence
    } catch {
      answer = 'Unable to synthesize answer from available context.'
      confidence = 0
    }

    const gaps: string[] = []
    if (sources.length === 0) {
      gaps.push('No relevant conversations found for this question.')
    }
    if (confidence < 0.3) {
      gaps.push('Low confidence in synthesized answer — limited relevant context.')
    }

    return { answer, sources, confidence, gaps }
  }

  async quickAnswer(question: string): Promise<SynthesisResult> {
    return this.synthesize({
      question,
      scope: {},
      maxSources: 1,
      synthesisStyle: 'summary',
    })
  }
}
