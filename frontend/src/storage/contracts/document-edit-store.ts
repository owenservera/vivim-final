/**
 * storage/contracts/document-edit-store.ts
 * --------------------------------------------------------------------
 * E1 — Document edit session store.
 */

import type {
  DocumentEditSession,
  DocumentEditOp,
  DocumentSaveInput,
  DocumentSaveResult,
} from '../../shared/document';

export interface DocumentEditStore {
  /** Start an edit session for a document. */
  startSession(documentId: string, userId: string): Promise<DocumentEditSession>;
  /** Get the active session for a document + user. */
  getSession(documentId: string, userId: string): Promise<DocumentEditSession | null>;
  /** Apply an edit op (updates content + undo stack). */
  applyOp(documentId: string, userId: string, op: DocumentEditOp): Promise<DocumentEditSession>;
  /** Undo the last op. */
  undo(documentId: string, userId: string): Promise<DocumentEditSession>;
  /** Redo a previously-undone op. */
  redo(documentId: string, userId: string): Promise<DocumentEditSession>;
  /** Save the session content to the document. */
  save(input: DocumentSaveInput): Promise<DocumentSaveResult>;
  /** End the session (no save). */
  endSession(documentId: string, userId: string): Promise<void>;
  /** List active sessions for a user. */
  listSessions(userId: string): Promise<DocumentEditSession[]>;
}
