/**
 * storage/impl/memory-annotation-store.ts
 * --------------------------------------------------------------------
 * In-memory annotation store. Extracted from canvas-engine-bootstrap.ts
 * for consistency with the other 23 store impls.
 */

import type { Annotation } from '../../engines/annotation-engine';
import type { AnnotationStore } from '../contracts/annotation-store';

export class MemoryAnnotationStore implements AnnotationStore {
  private rows = new Map<string, Annotation>();

  async get(id: string): Promise<Annotation | null> {
    return this.rows.get(id) ?? null;
  }

  async list(filter?: { targetKind?: string; targetId?: string }): Promise<Annotation[]> {
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.targetKind && r.targetKind !== filter.targetKind) return false;
      if (filter?.targetId && r.targetId !== filter.targetId) return false;
      return true;
    });
  }

  async create(input: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Annotation> {
    const now = Date.now();
    const id = `ann:${input.slug}:${now.toString(36)}`;
    const row: Annotation = { ...input, id, createdAt: now, updatedAt: now };
    this.rows.set(id, row);
    return row;
  }

  async update(id: string, patch: Partial<Annotation>): Promise<Annotation> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Annotation not found: ${id}`);
    const updated: Annotation = { ...existing, ...patch, id, updatedAt: Date.now() };
    this.rows.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
}
