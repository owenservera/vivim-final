// src/storage/contracts/harness-repair-store.ts
// Store contract for the harness repair engine (FR-006).
// Engine depends on this interface, never on src/storage/impl/* (Store Contracts).

export interface RepairSessionRow {
  id: string
  conversationId?: string | null
  commandId?: string | null
  originalContent: string
  repairedContent?: string | null
  strategy: string
  success: boolean
  errorsJson: string
  repairsJson: string
  createdAt: number
}

export interface HarnessRepairStore {
  saveRepairSession(row: RepairSessionRow): Promise<void>
  getRepairSession(id: string): Promise<RepairSessionRow | null>
}
