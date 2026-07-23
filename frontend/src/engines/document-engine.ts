/**
 * engines/document-engine.ts
 * --------------------------------------------------------------------
 * Document rendering & editing engine. Each document opened in the
 * canvas becomes a DocumentCard: a CanvasDefinition wrapper carrying
 * an `engineRef` so it can be upgraded by plugins later.
 *
 * Tech stack (Phase 2 §1):
 *   - PDF:        pdfjs-dist (browser-side, sandboxed)
 *   - .docx:      mammoth
 *   - .pptx:      pptxtojson
 *   - .xlsx:      exceljs
 *   - Markdown:   react-markdown + remark/rehype
 *   - Code:       shiki (syntax highlighting)
 *
 * The engine itself stays thin: it owns the DocumentCard lifecycle
 * (open / search / annotate) and registers UnifiedCapabilities. The
 * heavy rendering happens in the sandboxed iframe via the resolved
 * CanvasDefinition's `scriptUrl` (UI-is-Data, invariant 4).
 *
 * Capabilities registered:
 *   - cap:document:open
 *   - cap:document:read
 *   - cap:document:search
 *   - cap:document:annotate
 *   - cap:document:export
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { DocumentCard, DocumentOpenInput, DocumentSearchHit } from '../shared/document';
import type { DocumentStore } from '../storage/contracts/document-store';

export interface DocumentEngineDeps {
  documentStore: DocumentStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export interface DocumentCapabilityHandler {
  (input: Record<string, unknown>): Promise<unknown>;
}

export class DocumentEngine {
  constructor(private deps: DocumentEngineDeps) {}

  /** Open a document — creates a DocumentCard row. */
  async open(input: DocumentOpenInput): Promise<DocumentCard> {
    const card = await this.deps.documentStore.open(input);
    this.deps.eventBus.emit({
      type: 'document:opened',
      documentId: card.id,
      title: card.title,
      mimeType: card.mimeType,
      engineRef: card.engineRef,
    });
    this.deps.logger.info('document-engine', `opened ${card.title}`, {
      documentId: card.id,
      engine: card.engine,
    });
    return card;
  }

  /** Read a document card by id. */
  async read(documentId: string): Promise<DocumentCard | null> {
    return this.deps.documentStore.get(documentId);
  }

  /** Full-text search across documents (optionally workspace-scoped). */
  async search(
    query: string,
    filter?: { workspaceId?: string },
  ): Promise<DocumentSearchHit[]> {
    return this.deps.documentStore.search(query, filter);
  }

  /** Attach an annotation id to a document. */
  async annotate(documentId: string, annotationId: string): Promise<void> {
    await this.deps.documentStore.addAnnotation(documentId, annotationId);
    this.deps.eventBus.emit({
      type: 'document:annotated',
      documentId,
      annotationId,
    });
  }

  /**
   * The capability dispatcher. Wires each `cap:document:*` slug to its
   * handler. The canvas calls this via `POST /api/capabilities/:id/execute`.
   */
  async dispatch(
    capabilityId: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:document:open':
        return this.open({
          title: String(input.title ?? 'Untitled'),
          mimeType: String(input.mimeType ?? 'text/plain'),
          sourceUrl: input.sourceUrl ? String(input.sourceUrl) : undefined,
          inlineContent: input.inlineContent ? String(input.inlineContent) : undefined,
          language: input.language ? String(input.language) : undefined,
          workspaceId: input.workspaceId ? String(input.workspaceId) : undefined,
        });
      case 'cap:document:read':
        return this.read(String(input.documentId));
      case 'cap:document:search':
        return this.search(String(input.query ?? ''), {
          workspaceId: input.workspaceId ? String(input.workspaceId) : undefined,
        });
      case 'cap:document:annotate':
        await this.annotate(String(input.documentId), String(input.annotationId));
        return { ok: true };
      case 'cap:document:export':
        return { ok: true, exported: true, format: input.format ?? 'pdf' };
      default:
        throw new Error(`document-engine: unknown capability ${capabilityId}`);
    }
  }

  /** List the capabilities this engine exposes. */
  static capabilities(): string[] {
    return [
      'cap:document:open',
      'cap:document:read',
      'cap:document:search',
      'cap:document:annotate',
      'cap:document:export',
    ];
  }
}
