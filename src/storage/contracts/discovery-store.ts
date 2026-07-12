// src/storage/contracts/discovery-store.ts
// DiscoveryStore contract — Phase 22.1

export interface DiscoverySessionRow {
  id: string
  url: string
  status: string
  shapeId: string | null
  confidence: number
  capabilitiesJson: string
  interactiveJson: string
  parserFormat: string | null
  manifestDraftJson: string | null
  error: string | null
  agentId: string | null
  createdAt: number
  updatedAt: number
}

export interface DiscoveryObservationRow {
  id: string
  sessionId: string
  url: string
  method: string
  status: number
  resourceType: string
  requestHeadersJson: string
  requestBodyJson: string | null
  responseHeadersJson: string
  responseBodyPreview: string | null
  durationMs: number | null
  createdAt: number
}

export interface DiscoveryStore {
  // Sessions
  createSession(row: DiscoverySessionRow): Promise<void>
  updateSession(id: string, updates: Partial<DiscoverySessionRow>): Promise<void>
  getSession(id: string): Promise<DiscoverySessionRow | null>
  listSessions(opts?: { status?: string; limit?: number }): Promise<DiscoverySessionRow[]>
  deleteSession(id: string): Promise<void>

  // Observations
  createObservation(row: DiscoveryObservationRow): Promise<void>
  getObservations(sessionId: string, opts?: { limit?: number }): Promise<DiscoveryObservationRow[]>
  deleteObservations(sessionId: string): Promise<void>
}
