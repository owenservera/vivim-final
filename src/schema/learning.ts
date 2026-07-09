// src/schema/learning.ts
// SOTA learning domain types — used by MemoryEngine and Session learning.

export interface LearningEvent {
  id: string
  providerId: string
  capabilityId: string
  eventType: string
  contextJson: string
  outcome: string
  ts: number
}

export interface Rule {
  id: string
  name: string
  condition: string
  action: string
  confidence: number
  source: string
  isActive: boolean
}

export interface BindingEvent {
  id: string
  bindingId: string
  eventType: string
  fromStatus: string | null
  toStatus: string
  reason: string | null
  ts: number
}
