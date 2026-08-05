/**
 * shared/document.ts
 * --------------------------------------------------------------------
 * Document card types. Every document opened in the canvas becomes a
 * Document Card: a CanvasDefinition wrapper carrying an `engineRef` so
 * it can be upgraded by plugins later (Frontend=Backend, UI-is-Data).
 *
 * Supported mime types (Phase 2 §1):
 *   - PDF            → pdfjs-dist
 *   - Office (.docx) → mammoth
 *   - .pptx          → pptxtojson
 *   - .xlsx          → exceljs
 *   - Markdown       → react-markdown + remark/rehype
 *   - Code           → shiki
 *   - Plain text     → native
 *
 * The DocumentEngine picks the renderer by mime; plugins can register a
 * better renderer for the same mimeType and hot-swap in via the existing
 * `registerSlot(slot, slug, Component, opts)` precedence
 * (capabilitySlug > providerSlug > default).
 */

export type DocumentMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation' // .pptx
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
  | 'text/markdown'
  | 'text/x-markdown'
  | 'text/plain'
  | 'text/html'
  | 'application/json'
  | 'text/typescript'
  | 'text/javascript'
  | 'text/python'
  | 'text/css'
  | 'text/yaml';

export type DocumentEngine = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'markdown' | 'code' | 'text' | 'html';

export interface DocumentCard {
  id: string;
  slug: string;
  title: string;
  mimeType: DocumentMimeType | string;
  engine: DocumentEngine | string;
  /** Blob URL or data URL the renderer fetches. */
  sourceUrl?: string;
  /** Inline content (for short docs, code snippets, markdown). */
  inlineContent?: string;
  /** Programming language hint for code documents. */
  language?: string;
  /** Page count (PDFs, slides). */
  pageCount?: number;
  /** Word count (text docs). */
  wordCount?: number;
  /** Page currently open (PDFs). */
  currentPage?: number;
  /** SHA-256 of content (dedupe + integrity check). */
  contentHash?: string;
  /** WorkspaceId this doc belongs to (null = global). */
  workspaceId: string | null;
  /** Engine reference — plugins can hot-swap the renderer. */
  engineRef: string; // e.g. 'engine:document:pdf'
  /** Capabilities this document card may invoke. */
  capabilities: string[];
  annotations: string[]; // annotation ids
  /** Document version (bumped on each save). */
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentOpenInput {
  title: string;
  mimeType: DocumentMimeType | string;
  sourceUrl?: string;
  inlineContent?: string;
  language?: string;
  workspaceId?: string;
}

export interface DocumentSearchHit {
  documentId: string;
  page?: number;
  snippet: string;
  score: number;
}

// Import the filetype system (E1) for use in editorCapabilitiesFor below.
import { filetypeByMime } from './document-types';

// ── E1: Full editing support ──────────────────────────────────────────

export type DocumentEditState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

export interface DocumentEditSession {
  id: string;
  documentId: string;
  userId: string;
  /** Current content (edited). */
  content: string;
  /** Last-saved content (for diff). */
  savedContent: string;
  /** Cursor position (char offset). */
  cursorOffset: number;
  /** Selection range [start, end]. */
  selection?: [number, number];
  /** Edit state. */
  state: DocumentEditState;
  /** Last error (if state='error'). */
  error?: string;
  /** Undo/redo stacks (command refs). */
  undoStack: DocumentEditOp[];
  redoStack: DocumentEditOp[];
  /** Collaborators (presence) on this doc. */
  collaborators: string[];
  startedAt: number;
  lastEditAt: number;
  savedAt?: number;
}

export interface DocumentEditOp {
  id: string;
  kind: 'insert' | 'delete' | 'replace' | 'format';
  offset: number;
  length: number;
  /** Inserted text (for 'insert'/'replace'). */
  text?: string;
  /** Format hint (for 'format'). */
  format?: 'bold' | 'italic' | 'underline' | 'code' | 'strike';
  timestamp: number;
}

export interface DocumentSaveInput {
  documentId: string;
  content: string;
  /** Optional: patch ops instead of full content. */
  ops?: DocumentEditOp[];
}

export interface DocumentSaveResult {
  ok: boolean;
  documentId: string;
  version: number;
  contentHash: string;
  savedAt: number;
}

/** Editor capability set per filetype. */
export interface EditorCapabilities {
  /** Can edit content inline. */
  canEdit: boolean;
  /** Can format text (bold/italic/etc). */
  canFormat: boolean;
  /** Can insert images. */
  canInsertImages: boolean;
  /** Can insert tables. */
  canInsertTables: boolean;
  /** Can insert code blocks. */
  canInsertCode: boolean;
  /** Can comment/annotate. */
  canAnnotate: boolean;
  /** Can track changes. */
  canTrackChanges: boolean;
  /** Supports find & replace. */
  canFindReplace: boolean;
  /** Supports multi-cursor (collab). */
  canMultiCursor: boolean;
}

export function editorCapabilitiesFor(mime: string): EditorCapabilities {
  const ft = filetypeByMime(mime);
  if (!ft) {
    return {
      canEdit: false,
      canFormat: false,
      canInsertImages: false,
      canInsertTables: false,
      canInsertCode: false,
      canAnnotate: false,
      canTrackChanges: false,
      canFindReplace: false,
      canMultiCursor: false,
    };
  }
  const canEdit = ft.editable;
  const isRichText = ft.editor === 'contenteditable' || ft.editor === 'structured' || ft.editor === 'slides';
  const isCode = ft.editor === 'code';
  return {
    canEdit,
    canFormat: isRichText,
    canInsertImages: isRichText,
    canInsertTables: isRichText || ft.editor === 'sheet',
    canInsertCode: isRichText || isCode,
    canAnnotate: ft.annotatable,
    canTrackChanges: isRichText,
    canFindReplace: canEdit,
    canMultiCursor: canEdit,
  };
}

// Re-export the filetype system (E1).
export {
  DOCUMENT_FILETYPES,
  DOCUMENT_FILETYPE_COUNT,
  filetypeByExtension,
  filetypeByFilename,
  detectFiletype,
  filetypesByCategory,
} from './document-types';
export type {
  DocumentFiletypeSpec,
  DocumentEngineKind,
  EditorKind,
} from './document-types';
