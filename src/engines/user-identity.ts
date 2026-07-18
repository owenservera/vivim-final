// src/engines/user-identity.ts
// UserIdentityEngine — manages local user profiles.
// Called at boot to ensure a default user exists; provides CRUD + switch.

import { EngineError } from '../errors.js'
import type {
  CreateUserInput,
  UserIdentityStore,
  UserRole,
  UserRow,
} from '../storage/contracts/user-identity-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

export type { UserRole, UserRow }

export interface ProfilePatch {
  displayName?: string
  avatarColor?: string
  avatarUrl?: string | null
}

export class UserIdentityEngine {
  private activeUserId: string | null = null
  private activeUserRole: UserRole | null = null

  constructor(
    private store: UserIdentityStore,
    private eventBus: CapabilityEventBus,
  ) {}

  async ensureDefaultUser(): Promise<void> {
    const count = await this.store.count()
    if (count === 0) {
      const user = await this.store.create({
        displayName: 'Default User',
        role: 'developer',
        isDefault: true,
      })
      this.activeUserId = user.id
      this.activeUserRole = user.role
    } else {
      const def = await this.store.getDefault()
      if (def) {
        this.activeUserId = def.id
        this.activeUserRole = def.role
      } else {
        const users = await this.store.list({ status: 'active' })
        const firstUser = users[0]
        if (firstUser) {
          this.activeUserId = firstUser.id
          this.activeUserRole = firstUser.role
        }
      }
    }
  }

  async createProfile(
    name: string,
    opts?: { role?: UserRole; avatarColor?: string; setActive?: boolean },
  ): Promise<UserRow> {
    if (!name || name.trim().length === 0) {
      throw new EngineError('Display name is required')
    }
    const input: CreateUserInput = {
      displayName: name.trim(),
      role: opts?.role ?? 'member',
      avatarColor: opts?.avatarColor,
    }
    const user = await this.store.create(input)
    if (opts?.setActive !== false) {
      await this.switchProfile(user.id)
    }
    this.eventBus.emit({
      type: 'user:profile:created',
      userId: user.id,
      role: user.role,
    } as any)
    return user
  }

  async switchProfile(userId: string): Promise<{ user: UserRow; previousUserId: string | null }> {
    const user = await this.store.getById(userId)
    if (!user) throw new EngineError(`User ${userId} not found`)
    if (user.status !== 'active') throw new EngineError(`User ${userId} is ${user.status}`)

    const previous = this.activeUserId
    this.activeUserId = userId
    this.activeUserRole = user.role
    await this.store.update(userId, { lastActiveAt: Date.now() })

    this.eventBus.emit({
      type: 'user:profile:switched',
      userId,
      previousUserId: previous,
      role: user.role,
    } as any)
    return { user, previousUserId: previous }
  }

  async deleteProfile(userId: string): Promise<void> {
    if (userId === this.activeUserId) {
      throw new EngineError('Cannot delete the active user profile')
    }

    const user = await this.store.getById(userId)
    if (!user) throw new EngineError(`User ${userId} not found`)

    // If deleting the default user, reassign to another active user
    if (user.isDefault === 1) {
      const others = await this.store.list({ status: 'active' })
      const next = others.find((u) => u.id !== userId)
      if (next) await this.store.update(next.id, { isDefault: 1 })
    }

    await this.store.softDelete(userId)
    this.eventBus.emit({
      type: 'user:profile:deleted',
      userId,
    } as any)
  }

  async setRole(userId: string, role: UserRole): Promise<void> {
    const user = await this.store.getById(userId)
    if (!user) throw new EngineError(`User ${userId} not found`)
    const fromRole = user.role
    await this.store.update(userId, { role })
    // Update cached role if it's the active user
    if (userId === this.activeUserId) {
      this.activeUserRole = role
    }
    this.eventBus.emit({
      type: 'user:role:changed',
      userId,
      fromRole,
      toRole: role,
      changedBy: this.activeUserId,
    } as any)
  }

  getActiveUserId(): string | null {
    return this.activeUserId
  }

  getActiveUserRole(): UserRole | null {
    return this.activeUserRole
  }

  async getCurrentUser(): Promise<UserRow | null> {
    if (!this.activeUserId) return null
    return this.store.getById(this.activeUserId)
  }

  async listProfiles(): Promise<UserRow[]> {
    return this.store.list({ status: 'active' })
  }

  async getProfile(userId: string): Promise<UserRow | null> {
    return this.store.getById(userId)
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<void> {
    const user = await this.store.getById(userId)
    if (!user) throw new EngineError(`User ${userId} not found`)
    await this.store.update(userId, patch)
    this.eventBus.emit({
      type: 'user:profile:updated',
      userId,
    } as any)
  }
}
