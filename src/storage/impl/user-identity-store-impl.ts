// src/storage/impl/user-identity-store-impl.ts
// UserIdentityStoreImpl — Prisma-backed UserIdentityStore.

import { newId } from '../../ids.js'
import type {
  CreateUserInput,
  UserIdentityStore,
  UserRole,
  UserRow,
} from '../contracts/user-identity-store.js'
import type { CapStoreDb } from '../db.js'

interface PrismaUser {
  id: string
  displayName: string
  role: string
  avatarColor: string
  avatarUrl: string | null
  status: string
  isDefault: number
  createdAt: bigint
  updatedAt: bigint
  lastActiveAt: bigint | null
  lastSessionId: string | null
}

function toRow(u: PrismaUser): UserRow {
  return {
    id: u.id,
    displayName: u.displayName,
    role: u.role as UserRole,
    avatarColor: u.avatarColor,
    avatarUrl: u.avatarUrl,
    status: u.status,
    isDefault: u.isDefault,
    createdAt: Number(u.createdAt),
    updatedAt: Number(u.updatedAt),
    lastActiveAt: u.lastActiveAt ? Number(u.lastActiveAt) : null,
    lastSessionId: u.lastSessionId,
  }
}

export class UserIdentityStoreImpl implements UserIdentityStore {
  constructor(private db: CapStoreDb) {}

  async create(input: CreateUserInput): Promise<UserRow> {
    const now = Date.now()
    const u = await this.db.prisma.user.create({
      data: {
        id: newId(),
        displayName: input.displayName,
        role: input.role ?? 'member',
        avatarColor: input.avatarColor ?? '#6C5CE7',
        avatarUrl: input.avatarUrl ?? null,
        isDefault: input.isDefault ? 1 : 0,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toRow(u)
  }

  async getById(id: string): Promise<UserRow | null> {
    const u = await this.db.prisma.user.findUnique({ where: { id } })
    return u ? toRow(u) : null
  }

  async list(opts?: { status?: string; role?: UserRole }): Promise<UserRow[]> {
    const where: Record<string, unknown> = {}
    if (opts?.status) where.status = opts.status
    if (opts?.role) where.role = opts.role
    const users = await this.db.prisma.user.findMany({ where, orderBy: { createdAt: 'asc' } })
    return users.map(toRow)
  }

  async getDefault(): Promise<UserRow | null> {
    const u = await this.db.prisma.user.findFirst({
      where: { isDefault: 1, status: 'active' },
    })
    return u ? toRow(u) : null
  }

  async update(
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
  ): Promise<void> {
    const data: Record<string, unknown> = { updatedAt: Date.now() }
    if (patch.displayName !== undefined) data.displayName = patch.displayName
    if (patch.role !== undefined) data.role = patch.role
    if (patch.avatarColor !== undefined) data.avatarColor = patch.avatarColor
    if (patch.avatarUrl !== undefined) data.avatarUrl = patch.avatarUrl
    if (patch.status !== undefined) data.status = patch.status
    if (patch.isDefault !== undefined) data.isDefault = patch.isDefault
    if (patch.lastActiveAt !== undefined) data.lastActiveAt = patch.lastActiveAt
    if (patch.lastSessionId !== undefined) data.lastSessionId = patch.lastSessionId
    await this.db.prisma.user.update({ where: { id }, data })
  }

  async softDelete(id: string): Promise<void> {
    await this.db.prisma.user.update({
      where: { id },
      data: { status: 'deleted', updatedAt: Date.now() },
    })
  }

  async count(): Promise<number> {
    return this.db.prisma.user.count({ where: { status: 'active' } })
  }
}
