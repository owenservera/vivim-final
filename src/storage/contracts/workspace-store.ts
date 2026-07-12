// src/storage/contracts/workspace-store.ts
// WorkspaceStore — persistence contract for AdaptiveWorkspaceEngine.

export interface UserStats {
  messageCount: number
  capabilityCount: number
}

export interface WorkspaceStore {
  getMode(userId: string): Promise<string | null>
  setMode(userId: string, mode: string): Promise<void>
  getUserStats(userId: string): Promise<UserStats>
}
