// src/storage/contracts/alert-store.ts
// AlertStore contract — Phase 21.1.4

export interface Alert {
  id: string
  type: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  source: string
  message: string
  metadata?: Record<string, unknown>
  acknowledged: boolean
  createdAt: number
}

export interface AlertStore {
  save(alert: Alert): Promise<void>
  findById(id: string): Promise<Alert | null>
  findUnacknowledged(limit?: number): Promise<Alert[]>
  acknowledge(id: string): Promise<void>
  delete(id: string): Promise<void>
}
