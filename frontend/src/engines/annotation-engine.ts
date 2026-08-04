/**
 * engines/annotation-engine.ts
 * --------------------------------------------------------------------
 * Annotation engine. Manages annotations on documents and media.
 * Annotations are first-class rows; each one carries a target
 * (documentId | mediaId), a range (page + offset for docs, time range
 * for media), and an author.
 *
 * Reuses the existing SandboxedNode CSP-iframe rendering model: an
 * annotation overlay is itself a CanvasDefinition row whose html/css
 * renders inside the sandbox.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';

export interface Annotation {
  id: string;
  slug: string;
  /** Target: 'document' | 'media' | 'canvas'. */
  targetKind: 'document' | 'media' | 'canvas';
  targetId: string;
  /** For documents: page number (1-indexed). */
  page?: number;
  /** For documents: char range [start, end]. */
  charRange?: [number, number];
  /** For media: time range [startSec, endSec]. */
  timeRange?: [number, number];
  /** For canvas: world-space rect {x, y, w, h}. */
  rect?: { x: number; y: number; w: number; h: number };
  /** Annotation body (markdown). */
  body: string;
  author: 'system' | 'user' | 'agent';
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// Re-export from storage/contracts for back-compat.
import type { AnnotationStore } from '../storage/contracts/annotation-store';
export type { AnnotationStore };

export interface AnnotationEngineDeps {
  annotationStore: AnnotationStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class AnnotationEngine {
  constructor(private deps: AnnotationEngineDeps) {}

  async create(input: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Annotation> {
    const ann = await this.deps.annotationStore.create(input);
    this.deps.eventBus.emit({
      type: 'annotation:created',
      annotationId: ann.id,
      targetKind: ann.targetKind,
      targetId: ann.targetId,
    });
    return ann;
  }

  async list(filter?: { targetKind?: string; targetId?: string }): Promise<Annotation[]> {
    return this.deps.annotationStore.list(filter);
  }

  async update(id: string, patch: Partial<Annotation>): Promise<Annotation> {
    const updated = await this.deps.annotationStore.update(id, patch);
    this.deps.eventBus.emit({ type: 'annotation:updated', annotationId: id });
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const ok = await this.deps.annotationStore.remove(id);
    if (ok) this.deps.eventBus.emit({ type: 'annotation:removed', annotationId: id });
    return ok;
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:annotation:create':
        return this.create({
          slug: String(input.slug ?? `ann-${Date.now()}`),
          targetKind: input.targetKind as Annotation['targetKind'],
          targetId: String(input.targetId),
          page: typeof input.page === 'number' ? input.page : undefined,
          charRange: Array.isArray(input.charRange) ? (input.charRange as [number, number]) : undefined,
          timeRange: Array.isArray(input.timeRange) ? (input.timeRange as [number, number]) : undefined,
          rect: typeof input.rect === 'object' && input.rect !== null ? (input.rect as Annotation['rect']) : undefined,
          body: String(input.body ?? ''),
          author: (input.author as Annotation['author']) ?? 'user',
          tags: Array.isArray(input.tags) ? (input.tags as string[]) : [],
        });
      case 'cap:annotation:list':
        return this.list({
          targetKind: input.targetKind ? String(input.targetKind) : undefined,
          targetId: input.targetId ? String(input.targetId) : undefined,
        });
      case 'cap:annotation:update':
        return this.update(String(input.id), input.patch as Partial<Annotation>);
      case 'cap:annotation:remove':
        return this.remove(String(input.id));
      default:
        throw new Error(`annotation-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return ['cap:annotation:create', 'cap:annotation:list', 'cap:annotation:update', 'cap:annotation:remove'];
  }
}
