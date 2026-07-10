// src/storage/contracts/hpe-session-store.ts
// HPE session store contract — persistence for HarnessProtocolEngine sessions

export interface HpeSession {
  id: string
  agentId: string
  prompt: string
  response?: string
  actions: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  startedAt: number
  completedAt?: number
}

export interface HpeSessionStoreContract {
  save(session: HpeSession): Promise<void>
  findById(id: string): Promise<HpeSession | null>
  findByAgent(agentId: string, limit?: number): Promise<HpeSession[]>
  updateStatus(id: string, status: HpeSession['status']): Promise<void>
}
