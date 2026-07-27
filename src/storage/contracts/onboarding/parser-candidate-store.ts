// src/storage/contracts/onboarding/parser-candidate-store.ts
export interface ParserCandidateRow {
  id: string
  sessionId: string
  protocolFingerprintId: string | null
  inducedShapeJson: string
  parserProgramId: string | null
  confidence: number
  sampleCount: number
  status: string
}

export interface ParserCandidateCreateInput {
  id: string
  sessionId: string
  protocolFingerprintId?: string
  inducedShapeJson: string
  confidence: number
  sampleCount: number
  status: string
}

export interface ParserCandidateStoreContract {
  create(row: ParserCandidateCreateInput): Promise<void>
  listBySession(sessionId: string): Promise<ParserCandidateRow[]>
  updateStatus(id: string, status: string, confidence: number): Promise<void>
}
