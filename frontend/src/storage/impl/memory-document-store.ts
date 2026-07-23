/**
 * storage/impl/memory-document-store.ts
 */

import type { DocumentCard, DocumentOpenInput, DocumentSearchHit } from '../../shared/document';
import type { DocumentStore } from '../contracts/document-store';

function detectEngine(mime: string): DocumentCard['engine'] {
  if (mime === 'application/pdf') return 'pdf';
  if (mime.includes('wordprocessingml')) return 'docx';
  if (mime.includes('presentationml')) return 'pptx';
  if (mime.includes('spreadsheetml')) return 'xlsx';
  if (mime === 'text/markdown' || mime === 'text/x-markdown') return 'markdown';
  if (mime === 'text/html') return 'html';
  if (mime.startsWith('text/') || mime === 'application/json') return 'code';
  return 'text';
}

export class MemoryDocumentStore implements DocumentStore {
  private rows = new Map<string, DocumentCard>();
  private bySlug = new Map<string, string>();

  async get(id: string): Promise<DocumentCard | null> {
    return this.rows.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<DocumentCard | null> {
    const id = this.bySlug.get(slug);
    return id ? (this.rows.get(id) ?? null) : null;
  }

  async list(filter?: { workspaceId?: string; mimeType?: string }): Promise<DocumentCard[]> {
    const all = [...this.rows.values()];
    return all.filter((r) => {
      if (filter?.workspaceId && r.workspaceId !== filter.workspaceId) return false;
      if (filter?.mimeType && r.mimeType !== filter.mimeType) return false;
      return true;
    });
  }

  async open(input: DocumentOpenInput): Promise<DocumentCard> {
    const engine = detectEngine(input.mimeType);
    const now = Date.now();
    const id = `doc:${input.title.toLowerCase().replace(/\s+/g, '-')}:${now.toString(36)}`;
    const slug = input.title.toLowerCase().replace(/\s+/g, '-').slice(0, 64);
    const wordCount = input.inlineContent ? input.inlineContent.split(/\s+/).length : undefined;
    const card: DocumentCard = {
      id,
      slug,
      title: input.title,
      mimeType: input.mimeType,
      engine,
      sourceUrl: input.sourceUrl,
      inlineContent: input.inlineContent,
      language: input.language,
      wordCount,
      currentPage: 1,
      workspaceId: input.workspaceId ?? null,
      engineRef: `engine:document:${engine}`,
      capabilities: ['cap:document:read', 'cap:document:annotate'],
      annotations: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(id, card);
    this.bySlug.set(slug, id);
    return card;
  }

  async update(id: string, patch: Partial<DocumentCard>): Promise<DocumentCard> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Document not found: ${id}`);
    const updated: DocumentCard = {
      ...existing,
      ...patch,
      id: existing.id,
      version: existing.version + 1,
      updatedAt: Date.now(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async addAnnotation(id: string, annotationId: string): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) return;
    if (!existing.annotations.includes(annotationId)) {
      existing.annotations.push(annotationId);
      existing.updatedAt = Date.now();
    }
  }

  async search(query: string, filter?: { workspaceId?: string }): Promise<DocumentSearchHit[]> {
    const q = query.toLowerCase();
    const hits: DocumentSearchHit[] = [];
    for (const doc of this.rows.values()) {
      if (filter?.workspaceId && doc.workspaceId !== filter.workspaceId) continue;
      const content = doc.inlineContent ?? '';
      const idx = content.toLowerCase().indexOf(q);
      if (idx >= 0) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(content.length, idx + q.length + 40);
        hits.push({
          documentId: doc.id,
          snippet: content.slice(start, end),
          score: 1.0,
        });
      } else if (doc.title.toLowerCase().includes(q)) {
        hits.push({ documentId: doc.id, snippet: doc.title, score: 0.5 });
      }
    }
    return hits.sort((a, b) => b.score - a.score);
  }

  async remove(id: string): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) return false;
    this.bySlug.delete(row.slug);
    return this.rows.delete(id);
  }
}
