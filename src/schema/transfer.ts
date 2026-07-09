// src/schema/transfer.ts
// SOTA transfer learning types — used by TransferAccelerator.

export interface TransferPattern {
  id: string
  sourceProviderId: string
  targetProviderId: string
  capabilityId: string
  mappingJson: string
  confidence: number
}

export interface TransferCandidate {
  id: string
  patternId: string
  bindingId: string
  projectedConfidence: number
  appliedAt: number | null
}

export interface TransferAttempt {
  id: string
  candidateId: string
  ok: boolean
  durationMs: number
  error: string | null
  ts: number
}
