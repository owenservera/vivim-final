/**
 * storage/contracts/annotation-store.ts
 * --------------------------------------------------------------------
 * Annotation store contract. Extracted from engines/annotation-engine.ts
 * for consistency with the other 23 contracts.
 */

import type { Annotation } from '../../engines/annotation-engine'

export interface AnnotationStore {
  get(id: string): Promise<Annotation | null>
  list(filter?: { targetKind?: string; targetId?: string }): Promise<Annotation[]>
  create(input: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Annotation>
  update(id: string, patch: Partial<Annotation>): Promise<Annotation>
  remove(id: string): Promise<boolean>
}
