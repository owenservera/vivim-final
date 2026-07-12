// src/storage/contracts/automation-store.ts
// AutomationStore contract — Phase 21.1.5

export interface Automation {
  id: string
  name: string
  type: string
  schedule?: string
  enabled: boolean
  config: Record<string, unknown>
  lastRunAt?: number
  nextRunAt?: number
  createdAt: number
}

export interface AutomationStore {
  save(automation: Automation): Promise<void>
  findById(id: string): Promise<Automation | null>
  listEnabled(): Promise<Automation[]>
  updateLastRun(id: string, timestamp: number): Promise<void>
  delete(id: string): Promise<void>
}
