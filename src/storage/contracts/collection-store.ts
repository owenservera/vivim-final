// src/storage/contracts/collection-store.ts
// CollectionStore — data access contract for collections system.

// ── Row types ──────────────────────────────────────────────────────────────

export interface CollectionRow {
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

export interface CollectionItemRow {
  id: string
  collectionId: string
  itemType: string
  itemId: string
  order: number
  addedAt: number
}

// ── Input types ────────────────────────────────────────────────────────────

export interface CollectionInput {
  name: string
  parentId?: string | null
  userId: string
  description?: string | null
  color?: string | null
  icon?: string | null
}

export interface CollectionItemInput {
  collectionId: string
  itemType: string
  itemId: string
  order?: number
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface CollectionStore {
  // ── Collection CRUD ─────────────────────────────────────────────────────

  createCollection(input: CollectionInput): Promise<CollectionRow>
  getCollection(id: string): Promise<CollectionRow | null>
  updateCollection(id: string, patch: Partial<CollectionRow>): Promise<void>
  deleteCollection(id: string): Promise<void>
  listCollections(
    userId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<CollectionRow[]>

  // ── Hierarchy Methods ────────────────────────────────────────────────────

  getChildren(parentId: string): Promise<CollectionRow[]>
  validateHierarchy(parentId: string, childId: string): Promise<boolean>

  // ── Collection Item Methods ───────────────────────────────────────────────

  addItem(input: CollectionItemInput): Promise<CollectionItemRow>
  removeItem(id: string): Promise<void>
  getItems(collectionId: string): Promise<CollectionItemRow[]>
  getItem(collectionId: string, itemType: string, itemId: string): Promise<CollectionItemRow | null>
  updateItemOrder(id: string, order: number): Promise<void>
  removeItemByReference(collectionId: string, itemType: string, itemId: string): Promise<void>
}
