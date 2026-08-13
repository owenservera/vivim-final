// src/storage/contracts/collection-item-store.ts
// CollectionItemStore — data access contract for collection items.

import type { CollectionItemRow } from './collection-store.js'

// ── Input types ────────────────────────────────────────────────────────────

export interface CollectionItemInput {
  collectionId: string
  itemType: string
  itemId: string
  order?: number
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface CollectionItemStore {
  addItem(input: CollectionItemInput): Promise<CollectionItemRow>
  removeItem(id: string): Promise<void>
  getItems(collectionId: string): Promise<CollectionItemRow[]>
  getItem(collectionId: string, itemType: string, itemId: string): Promise<CollectionItemRow | null>
  updateItemOrder(id: string, order: number): Promise<void>
  removeItemByReference(collectionId: string, itemType: string, itemId: string): Promise<void>
}
