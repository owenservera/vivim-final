/**
 * storage/impl/memory-document-edit-store.ts
 * --------------------------------------------------------------------
 * E1 — Document edit session store. Tracks undo/redo + save state.
 */

import type {
  DocumentEditSession,
  DocumentEditOp,
  DocumentSaveInput,
  DocumentSaveResult,
} from '../../shared/document';
import type { DocumentEditStore } from '../contracts/document-edit-store';
import type { DocumentStore } from '../contracts/document-store';

export class MemoryDocumentEditStore implements DocumentEditStore {
  private sessions = new Map<string, DocumentEditSession>(); // key: `${documentId}|${userId}`
  private docStore: DocumentStore;

  constructor(docStore: DocumentStore) {
    this.docStore = docStore;
  }

  private key(documentId: string, userId: string): string {
    return `${documentId}|${userId}`;
  }

  async startSession(documentId: string, userId: string): Promise<DocumentEditSession> {
    const doc = await this.docStore.get(documentId);
    if (!doc) throw new Error(`Document not found: ${documentId}`);
    const now = Date.now();
    const content = doc.inlineContent ?? '';
    const session: DocumentEditSession = {
      id: `edit:${documentId}:${userId}:${now.toString(36)}`,
      documentId,
      userId,
      content,
      savedContent: content,
      cursorOffset: 0,
      state: 'clean',
      undoStack: [],
      redoStack: [],
      collaborators: [userId],
      startedAt: now,
      lastEditAt: now,
    };
    this.sessions.set(this.key(documentId, userId), session);
    return session;
  }

  async getSession(documentId: string, userId: string): Promise<DocumentEditSession | null> {
    return this.sessions.get(this.key(documentId, userId)) ?? null;
  }

  async applyOp(documentId: string, userId: string, op: DocumentEditOp): Promise<DocumentEditSession> {
    const session = this.sessions.get(this.key(documentId, userId));
    if (!session) throw new Error(`No edit session for ${documentId}|${userId}`);
    let content = session.content;
    switch (op.kind) {
      case 'insert':
        content = content.slice(0, op.offset) + (op.text ?? '') + content.slice(op.offset);
        break;
      case 'delete':
        content = content.slice(0, op.offset) + content.slice(op.offset + op.length);
        break;
      case 'replace':
        content = content.slice(0, op.offset) + (op.text ?? '') + content.slice(op.offset + op.length);
        break;
      case 'format':
        // Format ops don't change content (only rendering).
        break;
    }
    session.content = content;
    session.undoStack.push(op);
    session.redoStack = [];
    session.state = 'dirty';
    session.lastEditAt = Date.now();
    return session;
  }

  async undo(documentId: string, userId: string): Promise<DocumentEditSession> {
    const session = this.sessions.get(this.key(documentId, userId));
    if (!session) throw new Error(`No edit session for ${documentId}|${userId}`);
    const op = session.undoStack.pop();
    if (!op) return session;
    // Reverse the op.
    let content = session.content;
    switch (op.kind) {
      case 'insert':
        content = content.slice(0, op.offset) + content.slice(op.offset + (op.text ?? '').length);
        break;
      case 'delete':
        // We don't store the deleted text in this stub — production would.
        break;
      case 'replace':
        content = content.slice(0, op.offset) + content.slice(op.offset + (op.text ?? '').length);
        break;
    }
    session.content = content;
    session.redoStack.push(op);
    session.state = session.content === session.savedContent ? 'clean' : 'dirty';
    return session;
  }

  async redo(documentId: string, userId: string): Promise<DocumentEditSession> {
    const session = this.sessions.get(this.key(documentId, userId));
    if (!session) throw new Error(`No edit session for ${documentId}|${userId}`);
    const op = session.redoStack.pop();
    if (!op) return session;
    return this.applyOp(documentId, userId, op);
  }

  async save(input: DocumentSaveInput): Promise<DocumentSaveResult> {
    const doc = await this.docStore.get(input.documentId);
    if (!doc) throw new Error(`Document not found: ${input.documentId}`);
    const updated = await this.docStore.update(input.documentId, {
      inlineContent: input.content,
    });
    // Update all active sessions for this doc.
    for (const [key, session] of this.sessions) {
      if (session.documentId === input.documentId) {
        session.savedContent = input.content;
        session.content = input.content;
        session.state = 'saved';
        session.savedAt = Date.now();
      }
    }
    return {
      ok: true,
      documentId: input.documentId,
      version: updated.version,
      contentHash: `sha256:${Date.now().toString(36)}`,
      savedAt: Date.now(),
    };
  }

  async endSession(documentId: string, userId: string): Promise<void> {
    this.sessions.delete(this.key(documentId, userId));
  }

  async listSessions(userId: string): Promise<DocumentEditSession[]> {
    return [...this.sessions.values()].filter((s) => s.userId === userId);
  }
}
