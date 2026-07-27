// src/storage/contracts/onboarding/protocol-fingerprint-store.ts
export interface ProtocolFingerprintRow {
  id: string
  sessionId: string
  transportClass: string
  endpointPattern: string | null
  sampleHeadersJson: string | null
  cadenceMs: number | null
  confidence: number
}

export interface ProtocolFingerprintCreateInput {
  id: string
  sessionId: string
  transportClass: string
  endpointPattern: string | null
  sampleHeadersJson: string | null
  cadenceMs: number | null
  confidence: number
}

export interface ProtocolFingerprintStoreContract {
  create(row: ProtocolFingerprintCreateInput): Promise<string>
  getById(id: string): Promise<ProtocolFingerprintRow | null>
  listBySession(sessionId: string): Promise<ProtocolFingerprintRow[]>
}
