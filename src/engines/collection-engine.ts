// src/engines/collection-engine.ts
// CollectionEngine — manages collections and collection items

import type {
  CollectionInput,
  CollectionItemInput,
  CollectionItemRow,
  CollectionRow,
} from '../storage/contracts/collection-store.js'

export class CollectionEngine {
  constructor(
    private collectionStore: {
      createCollection(input: CollectionInput): Promise<CollectionRow>
      getCollection(id: string): Promise<CollectionRow | null>
      updateCollection(id: string, patch: Partial<CollectionRow>): Promise<void>
      deleteCollection(id: string): Promise<void>
      listCollections(
        userId: string,
        opts?: { limit?: number; offset?: number },
      ): Promise<CollectionRow[]>
      getChildren(parentId: string): Promise<CollectionRow[]>
      validateHierarchy(parentId: string, childId: string): Promise<boolean>
      addItem(input: CollectionItemInput): Promise<CollectionItemRow>
      removeItem(id: string): Promise<void>
      getItems(collectionId: string): Promise<CollectionItemRow[]>
      getItem(
        collectionId: string,
        itemType: string,
        itemId: string,
      ): Promise<CollectionItemRow | null>
      updateItemOrder(id: string, order: number): Promise<void>
      removeItemByReference(collectionId: string, itemType: string, itemId: string): Promise<void>
    },
  ) {}

  // ── Collection CRUD ─────────────────────────────────────────────────────

  async createCollection(input: CollectionInput): Promise<CollectionRow> {
    return this.collectionStore.createCollection(input)
  }

  async getCollection(id: string): Promise<CollectionRow | null> {
    return this.collectionStore.getCollection(id)
  }

  async updateCollection(id: string, patch: Partial<CollectionRow>): Promise<void> {
    await this.collectionStore.updateCollection(id, {
      ...patch,
      updatedAt: Date.now(),
    })
  }

  async deleteCollection(id: string): Promise<void> {
    await this.collectionStore.deleteCollection(id)
  }

  async listCollections(
    userId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<CollectionRow[]> {
    return this.collectionStore.listCollections(userId, opts)
  }

  // ── Hierarchy Methods ────────────────────────────────────────────────────

  async getChildren(parentId: string): Promise<CollectionRow[]> {
    return this.collectionStore.getChildren(parentId)
  }

  async moveCollection(collectionId: string, newParentId: string | null): Promise<void> {
    const isValid = await this.collectionStore.validateHierarchy(newParentId || '', collectionId)
    if (!isValid) {
      throw new Error('Invalid hierarchy: circular reference detected')
    }
    await this.collectionStore.updateCollection(collectionId, { parentId: newParentId })
  }

  // ── Collection Item Methods ───────────────────────────────────────────────

  async addItem(input: CollectionItemInput): Promise<CollectionItemRow> {
    return this.collectionStore.addItem({
      ...input,
      order: input.order ?? 0,
    })
  }

  async removeItem(id: string): Promise<void> {
    await this.collectionStore.removeItem(id)
  }

  async getItems(collectionId: string): Promise<CollectionItemRow[]> {
    return this.collectionStore.getItems(collectionId)
  }

  async getItem(
    collectionId: string,
    itemType: string,
    itemId: string,
  ): Promise<CollectionItemRow | null> {
    return this.collectionStore.getItem(collectionId, itemType, itemId)
  }

  async updateItemOrder(id: string, order: number): Promise<void> {
    await this.collectionStore.updateItemOrder(id, order)
  }

  async removeItemByReference(
    collectionId: string,
    itemType: string,
    itemId: string,
  ): Promise<void> {
    await this.collectionStore.removeItemByReference(collectionId, itemType, itemId)
  }

  async moveItem(itemId: string, targetCollectionId: string, order?: number): Promise<void> {
    const item = await this.collectionStore.getItem(itemId, '', '')
    if (!item) throw new Error('Item not found')

    await this.collectionStore.removeItemByReference(item.collectionId, item.itemType, item.itemId)
    await this.addItem({
      collectionId: targetCollectionId,
      itemType: item.itemType,
      itemId: item.itemId,
      order,
    })
  }
}
