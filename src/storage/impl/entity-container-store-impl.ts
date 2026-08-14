// src/storage/impl/entity-container-store-impl.ts
// Prisma-backed EntityContainerStore — CRUD for EntityContainer + EntityContainerMembership.

import type { Prisma, PrismaClient } from '@prisma/client'
import { newId } from '../../ids.js'
import type { CapStoreDb } from '../db.js'

type EntityContainerPrismaRow = Prisma.EntityContainerGetPayload<Record<string, never>>
type ContainerMembershipPrismaRow = Prisma.EntityContainerMembershipGetPayload<
  Record<string, never>
>

// ── Domain types ────────────────────────────────────────────────────────────

export interface EntityContainerRow {
  id: string
  providerId: string
  accountId: string
  containerType: string
  providerNativeId: string
  name: string
  description: string | null
  iconUrl: string | null
  metadataJson: string | null
  parentContainerId: string | null
  sortOrder: number
  isCollapsed: number
  isMuted: number
  isSynced: number
  lastSyncedAt: number | null
  syncCursorJson: string | null
  unreadCount: number
  mentionCount: number
  isArchived: number
  createdAt: number
  updatedAt: number
}

export interface ContainerMembershipRow {
  id: string
  containerId: string
  userRole: string
  notificationPreference: string
  isFavorite: number
  joinedAt: number
  updatedAt: number
}

// ── Store implementation ────────────────────────────────────────────────────

export class EntityContainerStoreImpl {
  protected readonly prisma: PrismaClient

  constructor(readonly db: CapStoreDb) {
    this.prisma = db.prisma
  }

  async getContainerById(id: string): Promise<EntityContainerRow | null> {
    const row = await this.prisma.entityContainer.findUnique({ where: { id } })
    return row ? this.toRow(row) : null
  }

  async listContainers(query: {
    type?: string
    providerId?: string
    accountId?: string
  }): Promise<EntityContainerRow[]> {
    const where: Record<string, unknown> = {}
    if (query.type) where.containerType = query.type
    if (query.providerId) where.providerId = query.providerId
    if (query.accountId) where.accountId = query.accountId
    const rows = await this.prisma.entityContainer.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map((r) => this.toRow(r))
  }

  async createContainer(input: {
    providerId: string
    accountId: string
    containerType: string
    providerNativeId: string
    name: string
    description?: string
    iconUrl?: string
    metadataJson?: string
    parentContainerId?: string
  }): Promise<EntityContainerRow> {
    const now = Date.now()
    const row = await this.prisma.entityContainer.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        accountId: input.accountId,
        containerType: input.containerType,
        providerNativeId: input.providerNativeId,
        name: input.name,
        description: input.description ?? null,
        iconUrl: input.iconUrl ?? null,
        metadataJson: input.metadataJson ?? '{}',
        parentContainerId: input.parentContainerId ?? null,
        sortOrder: 0,
        isCollapsed: 0,
        isMuted: 0,
        isSynced: 0,
        lastSyncedAt: null,
        syncCursorJson: '{}',
        unreadCount: 0,
        mentionCount: 0,
        isArchived: 0,
        createdAt: now,
        updatedAt: now,
      },
    })
    return this.toRow(row)
  }

  async updateContainer(id: string, updates: Record<string, unknown>): Promise<EntityContainerRow> {
    const now = Date.now()
    const allowed = [
      'name',
      'description',
      'iconUrl',
      'metadataJson',
      'parentContainerId',
      'sortOrder',
      'isCollapsed',
      'isMuted',
      'isSynced',
      'lastSyncedAt',
      'syncCursorJson',
      'unreadCount',
      'mentionCount',
      'isArchived',
    ]
    const data: Record<string, unknown> = { updatedAt: now }
    for (const key of allowed) {
      if (key in updates) data[key] = updates[key]
    }
    const row = await this.prisma.entityContainer.update({ where: { id }, data })
    return this.toRow(row)
  }

  async deleteContainer(id: string): Promise<void> {
    await this.prisma.entityContainer.delete({ where: { id } })
  }

  async getMemberships(containerId: string): Promise<ContainerMembershipRow[]> {
    const rows = await this.prisma.entityContainerMembership.findMany({
      where: { containerId },
      orderBy: { joinedAt: 'desc' },
    })
    return rows.map((r) => this.toMembershipRow(r))
  }

  async addMembership(input: {
    containerId: string
    userRole: string
    notificationPreference?: string
    isFavorite?: number
  }): Promise<ContainerMembershipRow> {
    const now = Date.now()
    const row = await this.prisma.entityContainerMembership.create({
      data: {
        id: newId(),
        containerId: input.containerId,
        userRole: input.userRole,
        notificationPreference: input.notificationPreference ?? 'all',
        isFavorite: input.isFavorite ?? 0,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    })
    return this.toMembershipRow(row)
  }

  async removeMembership(containerId: string, userRole: string): Promise<void> {
    await this.prisma.entityContainerMembership.deleteMany({
      where: { containerId, userRole },
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  private toRow(r: EntityContainerPrismaRow): EntityContainerRow {
    return {
      id: r.id,
      providerId: r.providerId,
      accountId: r.accountId,
      containerType: r.containerType,
      providerNativeId: r.providerNativeId,
      name: r.name,
      description: r.description,
      iconUrl: r.iconUrl,
      metadataJson: r.metadataJson,
      parentContainerId: r.parentContainerId,
      sortOrder: r.sortOrder,
      isCollapsed: r.isCollapsed,
      isMuted: r.isMuted,
      isSynced: r.isSynced,
      lastSyncedAt: r.lastSyncedAt === null ? null : Number(r.lastSyncedAt),
      syncCursorJson: r.syncCursorJson,
      unreadCount: r.unreadCount,
      mentionCount: r.mentionCount,
      isArchived: r.isArchived,
      createdAt: Number(r.createdAt),
      updatedAt: Number(r.updatedAt),
    }
  }

  private toMembershipRow(r: ContainerMembershipPrismaRow): ContainerMembershipRow {
    return {
      id: r.id,
      containerId: r.containerId,
      userRole: r.userRole,
      notificationPreference: r.notificationPreference,
      isFavorite: r.isFavorite,
      joinedAt: Number(r.joinedAt),
      updatedAt: Number(r.updatedAt),
    }
  }
}
