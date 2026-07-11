// src/storage/contracts/slave-setup-store.ts
// SlaveSetupStore — workspace hint + profile allocation for provider setup flow.

// Simplified account type for setup flow
export interface SetupAccount {
  id: string
  providerId: string
  accountSlug: string
  displayName: string
  planTier: string
  loginState: string
  profileDir: string | null
  debugPort: number | null
  created_at?: number
  updated_at?: number
}

export interface SlaveSetupStore {
  getWorkspaceHint(): Promise<string | null>
  setWorkspaceHint(path: string): Promise<void>
  upsertAccount(account: SetupAccount): Promise<void>
  getAccount(providerId: string, accountId: string): Promise<SetupAccount | null>
  listAccounts(): Promise<SetupAccount[]>
}
