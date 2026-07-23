/**
 * storage/contracts/document-store.ts
 * --------------------------------------------------------------------
 * DocumentCard store. Each document opened in the canvas becomes a row.
 */

import type { DocumentCard, DocumentOpenInput, DocumentSearchHit } from '../../shared/document';

export interface DocumentStore {
  get(id: string): Promise<DocumentCard | null>;
  getBySlug(slug: string): Promise<DocumentCard | null>;
  list(filter?: { workspaceId?: string; mimeType?: string }): Promise<DocumentCard[]>;
  open(input: DocumentOpenInput): Promise<DocumentCard>;
  update(id: string, patch: Partial<DocumentCard>): Promise<DocumentCard>;
  /** Add an annotation id to a document. */
  addAnnotation(id: string, annotationId: string): Promise<void>;
  search(query: string, filter?: { workspaceId?: string }): Promise<DocumentSearchHit[]>;
  remove(id: string): Promise<boolean>;
}
