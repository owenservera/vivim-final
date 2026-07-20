// src/storage/contracts/content-unit-store.ts
// ContentUnitStore — persistence for decomposed content blocks (per-block storage).
// Enables: per-block queries, quality scoring, content retrieval by type.

export interface ContentUnitRow {
  id: string
  messageId: string
  conversationId: string
  unitType: string
  content: string
  mimeType: string | null
  metadataJson: string
  sequenceIndex: number
  qualityScore: number | null
  createdAt: number
}

export interface ContentUnitStore {
  storeUnits(units: ContentUnitRow[]): Promise<void>
  getUnitsByMessage(messageId: string): Promise<ContentUnitRow[]>
  getUnitsByConversation(
    conversationId: string,
    opts?: { unitType?: string; limit?: number; offset?: number },
  ): Promise<ContentUnitRow[]>
  getUnitsByType(conversationId: string, unitType: string): Promise<ContentUnitRow[]>
}
