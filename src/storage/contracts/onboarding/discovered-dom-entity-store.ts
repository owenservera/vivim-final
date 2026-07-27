// src/storage/contracts/onboarding/discovered-dom-entity-store.ts
export interface DiscoveredDomEntityRow {
  id: string
  sessionId: string
  role: string
  selectorJson: string
  confidence: number
  testedAt: Date | null
  status: string
}

export interface DiscoveredDomEntityCreateInput {
  id: string
  sessionId: string
  role: string
  selectorJson: string
  confidence: number
  status: string
}

export interface DiscoveredDomEntityStoreContract {
  create(row: DiscoveredDomEntityCreateInput): Promise<void>
  listBySession(sessionId: string): Promise<DiscoveredDomEntityRow[]>
  updateStatus(id: string, status: string, confidence: number): Promise<void>
}
