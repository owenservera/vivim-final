// src/storage/contracts/onboarding/onboarding-session-store.ts
// Contract for the ProviderOnboardingSession store.
// Audit 🚀-11 fix — supports resumable orchestrator via `updateStageOutput`
// (each stage writes its output here so a crashed/resumed session picks up
// from the last completed stage).

export interface OnboardingSessionRow {
  id: string
  providerId: string | null
  slaveId: string
  targetOrigin: string
  status: string
  wfvJson: string | null
  wfvShapeSignature: string | null
  taxonomyId: string | null
  discoveredEntitiesJson: string | null
  parserCandidatesJson: string | null
  protocolFingerprintJson: string | null
  errorJson: string | null
  startedAt: Date
  completedAt: Date | null
}

export interface OnboardingSessionCreateInput {
  id: string
  slaveId: string
  targetOrigin: string
  status: string
  wfvShapeSignature?: string | null
}

export interface OnboardingSessionStoreContract {
  create(input: OnboardingSessionCreateInput): Promise<void>
  getById(id: string): Promise<OnboardingSessionRow | null>
  /**
   * Audit 🚀-6 idempotency — find an existing session with the same
   * slaveId + targetOrigin + wfvShapeSignature. Returns null if none.
   */
  findBySlaveOriginShape(
    slaveId: string,
    targetOrigin: string,
    wfvShapeSignature: string,
  ): Promise<OnboardingSessionRow | null>
  updateStatus(id: string, status: string, extra?: Record<string, unknown>): Promise<void>
  /**
   * Audit 🚀-11 — write a stage's output (e.g. wfvJson, discoveredEntitiesJson)
   * so a resumed session picks up from here.
   */
  updateStageOutput(
    id: string,
    fields: Partial<
      Pick<
        OnboardingSessionRow,
        | 'wfvJson'
        | 'taxonomyId'
        | 'discoveredEntitiesJson'
        | 'parserCandidatesJson'
        | 'protocolFingerprintJson'
        | 'providerId'
      >
    >,
  ): Promise<void>
  fail(id: string, reason: string): Promise<void>
  complete(id: string, providerId: string): Promise<void>
}
