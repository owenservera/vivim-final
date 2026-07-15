export type CurationAction = 'pin' | 'hide' | 'merge'

export interface MemoryCuratedRow {
  id: string
  memoryType: string
  memoryId: string
  isPinned: boolean
  isVerified: boolean
  note: string | null
}

export interface MemoryCuratedStore {
  upsert(row: MemoryCuratedRow): Promise<void>
  setPinned(memoryType: string, memoryId: string, pinned: boolean): Promise<void>
  setVerified(memoryType: string, memoryId: string, verified: boolean): Promise<void>
  list(memoryType?: string): Promise<MemoryCuratedRow[]>
}
