// src/storage/contracts/shape-binding-store.ts
// ShapeBindingStore contract — Phase 22.3

export interface ShapeBindingRow {
  id: string
  providerId: string
  archetypeId: string
  shapeId: string
  configJson: string | null
  isActive: number
  createdAt: number
}

export interface ShapeBindingStore {
  save(binding: ShapeBindingRow): Promise<void>
  findById(id: string): Promise<ShapeBindingRow | null>
  findByProvider(providerId: string): Promise<ShapeBindingRow[]>
  findByShape(shapeId: string): Promise<ShapeBindingRow[]>
  delete(id: string): Promise<void>
  setActive(id: string, active: boolean): Promise<void>
}
