// src/storage/contracts/user-identity-store.ts
// UserIdentityStore — data access contract for UserIdentityEngine.

export type UserRole = 'member' | 'admin' | 'developer'

export interface UserRow {
  id: string
  displayName: string
  role: UserRole
  avatarColor: string
  avatarUrl: string | null
  status: string
  isDefault: number
  createdAt: number
  updatedAt: number
  lastActiveAt: number | null
  lastSessionId: string | null
}

export interface CreateUserInput {
  displayName: string
  role?: UserRole
  avatarColor?: string
  avatarUrl?: string | null
  isDefault?: boolean
}

export interface UserIdentityStore {
  create(input: CreateUserInput): Promise<UserRow>
  getById(id: string): Promise<UserRow | null>
  list(opts?: { status?: string; role?: UserRole }): Promise<UserRow[]>
  getDefault(): Promise<UserRow | null>
  update(
    id: string,
    patch: Partial<
      Pick<
        UserRow,
        | 'displayName'
        | 'role'
        | 'avatarColor'
        | 'avatarUrl'
        | 'status'
        | 'isDefault'
        | 'lastActiveAt'
        | 'lastSessionId'
      >
    >,
  ): Promise<void>
  softDelete(id: string): Promise<void>
  count(): Promise<number>
}
