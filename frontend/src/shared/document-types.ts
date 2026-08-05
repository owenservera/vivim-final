/**
 * shared/document-types.ts
 * --------------------------------------------------------------------
 * E1 — Top 30 document filetypes with full render + edit support.
 *
 * Categories:
 *   - Office: PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP
 *   - Text/data: MD, TXT, RTF, HTML, CSV, TSV, JSON, YAML, XML
 *   - Code: TS, JS, PY, GO, RS, JAVA, C, CPP, RB, PHP, SWIFT, KT, SQL, SH
 *   - Rich text: RST, ASCIIDOC, ORG, TEX
 *
 * Each filetype maps to:
 *   - A DocumentEngine (renderer class)
 *   - An editor kind (none | textarea | contenteditable | structured | monaco-like)
 *   - A file extension list
 *   - Whether inline editing is supported
 */

export type DocumentEngineKind =
  | 'pdf' // pdfjs-dist
  | 'docx' // mammoth (render) + structured edit
  | 'xlsx' // exceljs (sheet grid)
  | 'pptx' // pptxtojson (slide deck)
  | 'odt' // OpenDocument Text
  | 'ods' // OpenDocument Spreadsheet
  | 'odp' // OpenDocument Presentation
  | 'markdown' // react-markdown + remark/rehype (render) + textarea (edit)
  | 'plaintext' // textarea
  | 'rtf' // rich text format
  | 'html' // sandboxed iframe (render) + code mirror (edit)
  | 'csv' // sheet grid
  | 'tsv' // sheet grid
  | 'json' // json-tree (render) + code mirror (edit)
  | 'yaml' // code mirror
  | 'xml' // code mirror
  | 'code' // shiki (render) + code mirror (edit)
  | 'rst' // reStructuredText
  | 'asciidoc' // AsciiDoctor
  | 'org' // Emacs Org-mode
  | 'tex' // LaTeX

export type EditorKind =
  | 'none' // read-only
  | 'textarea' // plain textarea (markdown, plaintext, rst, asciidoc, org, tex)
  | 'contenteditable' // rich text (html, rtf)
  | 'structured' // structured editor (docx, odt)
  | 'sheet' // spreadsheet grid (xlsx, ods, csv, tsv)
  | 'slides' // slide editor (pptx, odp)
  | 'code' // code editor with syntax highlighting (json, yaml, xml, code)

export interface DocumentFiletypeSpec {
  /** Mime type (canonical). */
  mimeType: string
  /** File extensions. */
  extensions: string[]
  /** Display label. */
  label: string
  /** Engine kind. */
  engine: DocumentEngineKind
  /** Editor kind. */
  editor: EditorKind
  /** Whether the file supports inline editing. */
  editable: boolean
  /** Whether the file supports annotations. */
  annotatable: boolean
  /** Icon (emoji). */
  icon: string
  /** Category for grouping. */
  category: 'office' | 'text' | 'data' | 'code' | 'rich-text'
}

/**
 * The top 30 document filetypes. Each spec carries the full render +
 * edit toolchain description.
 */
export const DOCUMENT_FILETYPES: DocumentFiletypeSpec[] = [
  // ── Office (7) ────────────────────────────────────────────────────
  {
    mimeType: 'application/pdf',
    extensions: ['pdf'],
    label: 'PDF Document',
    engine: 'pdf',
    editor: 'none',
    editable: false,
    annotatable: true,
    icon: '',
    category: 'office',
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    label: 'Word Document',
    engine: 'docx',
    editor: 'structured',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'office',
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
    label: 'Excel Spreadsheet',
    engine: 'xlsx',
    editor: 'sheet',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'office',
  },
  {
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
    label: 'PowerPoint Deck',
    engine: 'pptx',
    editor: 'slides',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'office',
  },
  {
    mimeType: 'application/vnd.oasis.opendocument.text',
    extensions: ['odt'],
    label: 'OpenDocument Text',
    engine: 'odt',
    editor: 'structured',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'office',
  },
  {
    mimeType: 'application/vnd.oasis.opendocument.spreadsheet',
    extensions: ['ods'],
    label: 'OpenDocument Spreadsheet',
    engine: 'ods',
    editor: 'sheet',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'office',
  },
  {
    mimeType: 'application/vnd.oasis.opendocument.presentation',
    extensions: ['odp'],
    label: 'OpenDocument Presentation',
    engine: 'odp',
    editor: 'slides',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'office',
  },

  // ── Text/data (9) ─────────────────────────────────────────────────
  {
    mimeType: 'text/markdown',
    extensions: ['md', 'markdown'],
    label: 'Markdown',
    engine: 'markdown',
    editor: 'textarea',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'text',
  },
  {
    mimeType: 'text/plain',
    extensions: ['txt', 'text'],
    label: 'Plain Text',
    engine: 'plaintext',
    editor: 'textarea',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'text',
  },
  {
    mimeType: 'application/rtf',
    extensions: ['rtf'],
    label: 'Rich Text',
    engine: 'rtf',
    editor: 'contenteditable',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'text',
  },
  {
    mimeType: 'text/html',
    extensions: ['html', 'htm'],
    label: 'HTML',
    engine: 'html',
    editor: 'contenteditable',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'text',
  },
  {
    mimeType: 'text/csv',
    extensions: ['csv'],
    label: 'CSV',
    engine: 'csv',
    editor: 'sheet',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'data',
  },
  {
    mimeType: 'text/tab-separated-values',
    extensions: ['tsv'],
    label: 'TSV',
    engine: 'tsv',
    editor: 'sheet',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'data',
  },
  {
    mimeType: 'application/json',
    extensions: ['json'],
    label: 'JSON',
    engine: 'json',
    editor: 'code',
    editable: true,
    annotatable: false,
    icon: '',
    category: 'data',
  },
  {
    mimeType: 'application/yaml',
    extensions: ['yaml', 'yml'],
    label: 'YAML',
    engine: 'yaml',
    editor: 'code',
    editable: true,
    annotatable: false,
    icon: '',
    category: 'data',
  },
  {
    mimeType: 'application/xml',
    extensions: ['xml'],
    label: 'XML',
    engine: 'xml',
    editor: 'code',
    editable: true,
    annotatable: false,
    icon: '',
    category: 'data',
  },

  // ── Code (14) ─────────────────────────────────────────────────────
  {
    mimeType: 'text/typescript',
    extensions: ['ts', 'tsx'],
    label: 'TypeScript',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/javascript',
    extensions: ['js', 'jsx', 'mjs', 'cjs'],
    label: 'JavaScript',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-python',
    extensions: ['py', 'pyw'],
    label: 'Python',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-go',
    extensions: ['go'],
    label: 'Go',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-rust',
    extensions: ['rs'],
    label: 'Rust',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-java',
    extensions: ['java'],
    label: 'Java',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-c',
    extensions: ['c', 'h'],
    label: 'C',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-c++',
    extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hxx'],
    label: 'C++',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-ruby',
    extensions: ['rb'],
    label: 'Ruby',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-php',
    extensions: ['php'],
    label: 'PHP',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-swift',
    extensions: ['swift'],
    label: 'Swift',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'text/x-kotlin',
    extensions: ['kt', 'kts'],
    label: 'Kotlin',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'application/sql',
    extensions: ['sql'],
    label: 'SQL',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },
  {
    mimeType: 'application/x-sh',
    extensions: ['sh', 'bash', 'zsh'],
    label: 'Shell',
    engine: 'code',
    editor: 'code',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'code',
  },

  // ── Rich text (4) ─────────────────────────────────────────────────
  {
    mimeType: 'text/x-rst',
    extensions: ['rst'],
    label: 'reStructuredText',
    engine: 'rst',
    editor: 'textarea',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'rich-text',
  },
  {
    mimeType: 'text/x-asciidoc',
    extensions: ['adoc', 'asciidoc'],
    label: 'AsciiDoc',
    engine: 'asciidoc',
    editor: 'textarea',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'rich-text',
  },
  {
    mimeType: 'text/x-org',
    extensions: ['org'],
    label: 'Org Mode',
    engine: 'org',
    editor: 'textarea',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'rich-text',
  },
  {
    mimeType: 'application/x-tex',
    extensions: ['tex', 'latex'],
    label: 'LaTeX',
    engine: 'tex',
    editor: 'textarea',
    editable: true,
    annotatable: true,
    icon: '',
    category: 'rich-text',
  },
]

/** Lookup by mime type. */
export function filetypeByMime(mime: string): DocumentFiletypeSpec | null {
  return DOCUMENT_FILETYPES.find((f) => f.mimeType === mime) ?? null
}

/** Lookup by file extension. */
export function filetypeByExtension(ext: string): DocumentFiletypeSpec | null {
  const clean = ext.toLowerCase().replace(/^\./, '')
  return DOCUMENT_FILETYPES.find((f) => f.extensions.includes(clean)) ?? null
}

/** Lookup by filename. */
export function filetypeByFilename(name: string): DocumentFiletypeSpec | null {
  const ext = name.split('.').pop() ?? ''
  return filetypeByExtension(ext)
}

/** Detect from mime OR filename. */
export function detectFiletype(input: {
  mimeType?: string
  filename?: string
}): DocumentFiletypeSpec | null {
  if (input.mimeType) {
    const byMime = filetypeByMime(input.mimeType)
    if (byMime) return byMime
  }
  if (input.filename) {
    const byName = filetypeByFilename(input.filename)
    if (byName) return byName
  }
  // Fall back to plaintext.
  return filetypeByMime('text/plain')
}

/** Group filetypes by category (for the picker UI). */
export function filetypesByCategory(): Record<string, DocumentFiletypeSpec[]> {
  const out: Record<string, DocumentFiletypeSpec[]> = {}
  for (const f of DOCUMENT_FILETYPES) {
    if (!out[f.category]) out[f.category] = []
    out[f.category].push(f)
  }
  return out
}

export const DOCUMENT_FILETYPE_COUNT = DOCUMENT_FILETYPES.length
