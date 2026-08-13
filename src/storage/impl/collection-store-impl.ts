// src/storage/impl/collection-store-impl.ts
// CollectionStoreImpl — Prisma-based implementation of CollectionStore

import { newId } from '../../ids.js'
import type {
  CollectionInput,
  CollectionItemInput,
  CollectionItemRow,
  CollectionRow,
  CollectionStore,
} from '../contracts/collection-store.js'
import type { CapStoreDb } from '../db.js'

interface PrismaCollection {
  id: string
  name: string
  parentId: string | null
  userId: string
  description: string | null
  color: string | null
  icon: string | null
  createdAt: number
  updatedAt: number
}

interface PrismaCollectionItem {
  id: string
  collectionId: string
  itemType: string
  itemId: string
  order: number
  addedAt: number
}

function toCollectionRow(r: PrismaCollection): CollectionRow {
  return {
    id: r.id,
    name: r.name,
    parentId: r.parentId,
    userId: r.userId,
    description: r.description,
    color: r.color,
    icon: r.icon,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toCollectionItemRow(r: PrismaCollectionItem): CollectionItemRow {
  return {
    id: r.id,
    collectionId: r.collectionId,
    itemType: r.itemType,
    itemId: r.itemId,
    order: r.order,
    addedAt: r.addedAt,
  }
}

export class CollectionStoreImpl implements CollectionStore {
  constructor(private db: CapStoreDb) {}

  async createCollection(input: CollectionInput): Promise<CollectionRow> {
    const now = Date.now()
    const row = await this.db.prisma.collection.create({
      data: {
        id: newId(),
        name: input.name,
        parentId: input.parentId ?? null,
        userId: input.userId,
        description: input.description ?? null,
        color: input.color ?? null,
        icon: input.icon ?? null,
        createdAt: now,
        updatedAt: now,
      },
    })
    return toCollectionRow(row as unknown as PrismaCollection)
  }

  async getCollection(id: string): Promise<CollectionRow | null> {
    const row = await this.db.prisma.collection.findUnique({
      where: { id },
    })
    return row ? toCollectionRow(row as unknown as PrismaCollection) : null
  }

  async updateCollection(id: string, patch: Partial<CollectionRow>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.name !== undefined) data.name = patch.name
    if (patch.parentId !== undefined) data.parentId = patch.parentId
    if (patch.description !== undefined) data.description = patch.description
    if (patch.color !== undefined) data.color = patch.color
    if (patch.icon !== undefined) data.icon = patch.icon
    if (patch.updatedAt !== undefined) data.updatedAt = patch.updatedAt
    await this.db.prisma.collection.update({ where: { id }, data })
  }

  async deleteCollection(id: string): Promise<void> {
    await this.db.prisma.collection.delete({ where: { id } })
  }

  async listCollections(
    userId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<CollectionRow[]> {
    const rows = await this.db.prisma.collection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit,
      skip: opts?.offset,
    })
    return rows.map((r: unknown) => toCollectionRow(r as PrismaCollection))
  }

  async getChildren(parentId: string): Promise<CollectionRow[]> {
    const rows = await this.db.prisma.collection.findMany({
      where: { parentId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r: unknown) => toCollectionRow(r as PrismaCollection))
  }

  async validateHierarchy(parentId: string, childId: string): Promise<boolean> {
    // Check for circular reference by walking up the hierarchy
    let currentId = parentId
    const visited = new Set<string>()
    const maxDepth = 100 // Prevent infinite loops
    let depth = 0

    while (currentId && depth < maxDepth) {
      if (currentId === childId) return false // Circular reference
      if (visited.has(currentId)) return false // Cycle detected
      visited.add(currentId)

      const parent = await this.db.prisma.collection.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      })
      currentId = parent?.parentId ?? ''
      depth++
    }

    return true
  }

  async addItem(input: CollectionItemInput): Promise<CollectionItemRow> {
    const now = Date.now()
    const row = await this.db.prisma.collectionItem.create({
      data: {
        id: newId(),
        collectionId: input.collectionId,
        itemType: input.itemType,
        itemId: input.itemId,
        order: input.order ?? 0,
        addedAt: now,
      },
    })
    return toCollectionItemRow(row as unknown as PrismaCollectionItem)
  }

  async removeItem(id: string): Promise<void> {
    await this.db.prisma.collectionItem.delete({ where: { id } })
  }

  async getItems(collectionId: string): Promise<CollectionItemRow[]> {
    const rows = await this.db.prisma.collectionItem.findMany({
      where: { collectionId },
      orderBy: { order: 'asc' },
    })
    return rows.map((r: unknown) => toCollectionItemRow(r as PrismaCollectionItem))
  }

  async getItem(
    collectionId: string,
    itemType: string,
    itemId: string,
  ): Promise<CollectionItemRow | null> {
    const row = await this.db.prisma.collectionItem.findUnique({
      where: {
        collectionId_itemType_itemId: {
          collectionId,
          itemType,
          itemId,
        },
      },
    })
    return row ? toCollectionItemRow(row as unknown as PrismaCollectionItem) : null
  }

  async updateItemOrder(id: string, order: number): Promise<void> {
    await this.db.prisma.collectionItem.update({
      where: { id },
      data: { order },
    })
  }

  async removeItemByReference(
    collectionId: string,
    itemType: string,
    itemId: string,
  ): Promise<void> {
    await this.db.prisma.collectionItem.deleteMany({
      where: {
        collectionId,
        itemType,
        itemId,
      },
    })
  }
}
