// src/storage/contracts/situation-store.ts
// SituationStore — persistence contract for SituationDetector.

export interface SituationLogInput {
  id: string
  conversationId: string | null
  detectedType: string
  confidence: number
  signalsJson: string
  timestamp: number
}

export interface UserPreferenceInput {
  id: string
  userId: string
  key: string
  value: string
  learnedAt: number
}

export interface SituationStore {
  createLog(log: SituationLogInput): Promise<void>
  getRecentForConversation(
    conversationId: string,
    limit?: number,
  ): Promise<Array<{ detectedType: string; confidence: number; timestamp: number }>>
  createUserPreference(input: UserPreferenceInput): Promise<void>
  getUserPreferences(userId: string): Promise<Array<{ key: string; value: string }>>
}
