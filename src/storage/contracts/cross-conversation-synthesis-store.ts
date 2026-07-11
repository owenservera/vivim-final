// src/storage/contracts/cross-conversation-synthesis-store.ts
// CrossConversationSynthesizerStore — gather related facts, decisions, entities.

export interface CrossConversationSynthesizerStore {
  getFactsForConversation(conversationId: string): Promise<Array<{
    id: string; subject: string; predicate: string; object: string; confidence: number
  }>>
  getDecisionsForConversation(conversationId: string): Promise<Array<{
    id: string; decisionText: string; rationale: string | null; confidence: number
  }>>
  getEntitiesForConversation(conversationId: string): Promise<Array<{
    id: string; name: string; type: string; confidence: number
  }>>
}
