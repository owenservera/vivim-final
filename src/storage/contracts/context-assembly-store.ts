// src/storage/contracts/context-assembly-store.ts
// ContextAssemblyStore — persistence contract for ContextAssemblyEngine.

export interface ContextLayerRowInput {
  id: string
  conversationId: string
  layerName: string
  content: string
  tokenCount: number
  priority: number
  sourcesJson: string
  assembledAt: number
}

export interface ContextAssemblyStore {
  saveLayer(row: ContextLayerRowInput): Promise<void>
  getLayersForConversation(conversationId: string): Promise<
    Array<{
      layerName: string
      content: string
      tokenCount: number
      priority: number
      sourcesJson: string
    }>
  >
  clearLayersForConversation(conversationId: string): Promise<void>
}
