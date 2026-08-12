/**
 * engines/document-editor-engine.ts
 * --------------------------------------------------------------------
 * E1 — Document editor engine. Manages edit sessions, undo/redo,
 * save lifecycle. Wraps the DocumentEditStore + DocumentStore.
 *
 * Capabilities:
 *   - cap:document:start_edit
 *   - cap:document:apply_op
 *   - cap:document:undo
 *   - cap:document:redo
 *   - cap:document:save
 *   - cap:document:end_edit
 *   - cap:document:format
 *   - cap:document:find_replace
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type {
  DocumentEditSession,
  DocumentEditOp,
  DocumentSaveInput,
  DocumentSaveResult,
  EditorCapabilities,
} from '../shared/document';
import { editorCapabilitiesFor } from '../shared/document';
import type { DocumentEditStore } from '../storage/contracts/document-edit-store';

export interface DocumentEditorEngineDeps {
  editStore: DocumentEditStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
}

export class DocumentEditorEngine {
  constructor(private deps: DocumentEditorEngineDeps) {}

  /** Start an edit session. */
  async startEdit(documentId: string, userId: string): Promise<DocumentEditSession> {
    const session = await this.deps.editStore.startSession(documentId, userId);
    this.deps.eventBus.emit({
      type: 'document:edit_started',
      documentId,
      userId,
      sessionId: session.id,
    });
    return session;
  }

  /** Apply an edit op. */
  async applyOp(documentId: string, userId: string, op: DocumentEditOp): Promise<DocumentEditSession> {
    const session = await this.deps.editStore.applyOp(documentId, userId, op);
    this.deps.eventBus.emit({
      type: 'document:edit_op',
      documentId,
      userId,
      opKind: op.kind,
      offset: op.offset,
    });
    return session;
  }

  async undo(documentId: string, userId: string): Promise<DocumentEditSession> {
    const session = await this.deps.editStore.undo(documentId, userId);
    this.deps.eventBus.emit({ type: 'document:undo', documentId, userId });
    return session;
  }

  async redo(documentId: string, userId: string): Promise<DocumentEditSession> {
    const session = await this.deps.editStore.redo(documentId, userId);
    this.deps.eventBus.emit({ type: 'document:redo', documentId, userId });
    return session;
  }

  async save(input: DocumentSaveInput): Promise<DocumentSaveResult> {
    const result = await this.deps.editStore.save(input);
    this.deps.eventBus.emit({
      type: 'document:saved',
      documentId: input.documentId,
      version: result.version,
      traceId: `save-${result.savedAt.toString(36)}`,
    });
    return result;
  }

  async endEdit(documentId: string, userId: string): Promise<void> {
    await this.deps.editStore.endSession(documentId, userId);
    this.deps.eventBus.emit({ type: 'document:edit_ended', documentId, userId });
  }

  async getSession(documentId: string, userId: string): Promise<DocumentEditSession | null> {
    return this.deps.editStore.getSession(documentId, userId);
  }

  async listSessions(userId: string): Promise<DocumentEditSession[]> {
    return this.deps.editStore.listSessions(userId);
  }

  /** Get editor capabilities for a mime type. */
  capabilitiesFor(mime: string): EditorCapabilities {
    return editorCapabilitiesFor(mime);
  }

  /** Find & replace (returns the new content). */
  findReplace(
    content: string,
    find: string,
    replace: string,
    opts?: { regex?: boolean; caseSensitive?: boolean; all?: boolean },
  ): { content: string; replacements: number } {
    if (!find) return { content, replacements: 0 };
    let count = 0;
    let result = content;
    const useRegex = opts?.regex === true;
    const caseSensitive = opts?.caseSensitive === true;
    if (useRegex) {
      const flags = caseSensitive ? 'g' : 'gi';
      try {
        const re = new RegExp(find, flags);
        result = content.replace(re, () => {
          count += 1;
          return replace;
        });
      } catch {
  // [audit] log the error with context here
        // invalid regex
      }
    } else {
      const flags = caseSensitive ? 'g' : 'gi';
      const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, flags);
      result = content.replace(re, () => {
        count += 1;
        return replace;
      });
    }
    return { content: result, replacements: count };
  }

  async dispatch(capabilityId: string, input: Record<string, unknown>): Promise<unknown> {
    switch (capabilityId) {
      case 'cap:document:start_edit':
        return this.startEdit(String(input.documentId), String(input.userId ?? 'user:demo'));
      case 'cap:document:apply_op':
        return this.applyOp(String(input.documentId), String(input.userId ?? 'user:demo'), input.op as DocumentEditOp);
      case 'cap:document:undo':
        return this.undo(String(input.documentId), String(input.userId ?? 'user:demo'));
      case 'cap:document:redo':
        return this.redo(String(input.documentId), String(input.userId ?? 'user:demo'));
      case 'cap:document:save':
        return this.save({
          documentId: String(input.documentId),
          content: String(input.content ?? ''),
        });
      case 'cap:document:end_edit':
        return this.endEdit(String(input.documentId), String(input.userId ?? 'user:demo'));
      case 'cap:document:capabilities':
        return this.capabilitiesFor(String(input.mimeType));
      case 'cap:document:find_replace':
        return this.findReplace(
          String(input.content ?? ''),
          String(input.find ?? ''),
          String(input.replace ?? ''),
          {
            regex: input.regex === true,
            caseSensitive: input.caseSensitive === true,
            all: input.all !== false,
          },
        );
      default:
        throw new Error(`document-editor-engine: unknown capability ${capabilityId}`);
    }
  }

  static capabilities(): string[] {
    return [
      'cap:document:start_edit', 'cap:document:apply_op', 'cap:document:undo',
      'cap:document:redo', 'cap:document:save', 'cap:document:end_edit',
      'cap:document:capabilities', 'cap:document:find_replace',
    ];
  }
}
