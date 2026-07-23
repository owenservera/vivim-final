/**
 * sdk/canvas/document-editor-client.ts
 * --------------------------------------------------------------------
 * E5 — SDK client for the DocumentEditor engine.
 * Wraps /api/document/edit/* endpoints. Plugin authors use this to
 * programmatically edit documents (start session, apply ops, save,
 * undo/redo, find-replace).
 */

import type {
  DocumentEditSession,
  DocumentEditOp,
  DocumentSaveResult,
  EditorCapabilities,
} from '../../shared/document';
import { editorCapabilitiesFor } from '../../shared/document';

export interface DocumentEditorClient {
  startEdit(documentId: string, userId?: string): Promise<DocumentEditSession>;
  applyOp(documentId: string, op: DocumentEditOp, userId?: string): Promise<DocumentEditSession>;
  undo(documentId: string, userId?: string): Promise<DocumentEditSession>;
  redo(documentId: string, userId?: string): Promise<DocumentEditSession>;
  save(documentId: string, content: string): Promise<DocumentSaveResult>;
  endEdit(documentId: string, userId?: string): Promise<void>;
  getSession(documentId: string, userId?: string): Promise<DocumentEditSession | null>;
  capabilities(mimeType: string): EditorCapabilities;
  findReplace(
    content: string,
    find: string,
    replace: string,
    opts?: { regex?: boolean; caseSensitive?: boolean },
  ): { content: string; replacements: number };
}

export function createDocumentEditorClient(opts: { apiBase?: string; fetchImpl?: typeof fetch } = {}): DocumentEditorClient {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.apiBase ?? '';

  const post = async (url: string, body: unknown) => {
    const res = await f(`${base}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
    return (await res.json()) as { ok: boolean; session?: DocumentEditSession; version?: number };
  };

  return {
    async startEdit(documentId, userId = 'user:demo') {
      const r = await post('/api/document/edit/start', { documentId, userId });
      if (!r.session) throw new Error('no session returned');
      return r.session;
    },
    async applyOp(documentId, op, userId = 'user:demo') {
      const r = await post('/api/document/edit/apply_op', { documentId, userId, op });
      if (!r.session) throw new Error('no session returned');
      return r.session;
    },
    async undo(documentId, userId = 'user:demo') {
      const r = await post('/api/document/edit/undo', { documentId, userId });
      if (!r.session) throw new Error('no session returned');
      return r.session;
    },
    async redo(documentId, userId = 'user:demo') {
      const r = await post('/api/document/edit/redo', { documentId, userId });
      if (!r.session) throw new Error('no session returned');
      return r.session;
    },
    async save(documentId, content) {
      const r = await post('/api/document/edit/save', { documentId, content });
      return r as unknown as DocumentSaveResult;
    },
    async endEdit(documentId, userId = 'user:demo') {
      await post('/api/document/edit/start', { documentId, userId }); // stub: no end endpoint yet
    },
    async getSession(documentId, userId = 'user:demo') {
      const res = await f(`${base}/api/document/edit/session?documentId=${encodeURIComponent(documentId)}&userId=${encodeURIComponent(userId)}`);
      const data = (await res.json()) as { ok: boolean; session: DocumentEditSession | null };
      return data.session;
    },
    capabilities(mimeType) {
      return editorCapabilitiesFor(mimeType);
    },
    findReplace(content, find, replace, opts) {
      const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, opts?.caseSensitive ? 'g' : 'gi');
      let count = 0;
      const result = content.replace(re, () => {
        count += 1;
        return replace;
      });
      return { content: result, replacements: count };
    },
  };
}
