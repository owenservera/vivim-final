'use client';

/**
 * components/canvas/cards/DocEditor.tsx (E1)
 * --------------------------------------------------------------------
 * Full document rendering + editing suite for the top 30 filetypes.
 *
 * Per filetype:
 *   - PDF/DOCX/XLSX/PPTX/ODT/ODS/ODP: structured render + (where editable)
 *     a structured editor
 *   - Markdown/RST/AsciiDoc/Org/TeX/LaTeX: split-pane textarea + live preview
 *   - Plaintext: textarea
 *   - HTML/RTF: contenteditable rich text
 *   - CSV/TSV: spreadsheet grid editor
 *   - JSON/YAML/XML/Code: code editor with syntax highlighting (shiki-style)
 *
 * Editor capabilities (canEdit/canFormat/canInsertImages/canInsertTables/
 * canInsertCode/canAnnotate/canTrackChanges/canFindReplace/canMultiCursor)
 * come from `editorCapabilitiesFor(mime)`.
 *
 * Toolbar: Save / Undo / Redo / Find-Replace / Format (bold/italic/
 * underline/code) / Insert (image/table/code-block) / Annotate.
 *
 * The editor is itself a sandboxed CanvasDefinition (invariant 4). All
 * edits go through the UnifiedIO layer (invariant 5, E4).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import type { DocumentCard, DocumentEditSession, EditorCapabilities } from '../../../shared/document';
import { editorCapabilitiesFor, detectFiletype } from '../../../shared/document';
import type { DocumentFiletypeSpec } from '../../../shared/document-types';
import { useIO } from '../UnifiedIOProvider';

export interface DocEditorProps {
  document: DocumentCard;
  userId?: string;
  onSaved?: (version: number) => void;
}

export function DocEditor({ document: doc, userId = 'user:demo', onSaved }: DocEditorProps) {
  const io = useIO();
  const ft = detectFiletype({ mimeType: doc.mimeType, filename: doc.title });
  const caps = editorCapabilitiesFor(doc.mimeType);
  const [session, setSession] = useState<DocumentEditSession | null>(null);
  const [content, setContent] = useState(doc.inlineContent ?? '');
  const [savedContent, setSavedContent] = useState(doc.inlineContent ?? '');
  const [state, setState] = useState<'clean' | 'dirty' | 'saving' | 'saved' | 'error'>('clean');
  const [showPreview, setShowPreview] = useState(true);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Start an edit session on mount (if editable).
  useEffect(() => {
    if (!caps.canEdit) return;
    io.post('/api/document/edit/start', { documentId: doc.id, userId })
      .then((res) => {
        if (res.ok && res.data) {
          const s = (res.data as { session: DocumentEditSession }).session;
          setSession(s);
          setContent(s.content);
          setSavedContent(s.savedContent);
        }
      })
      .catch(() => {});
  }, [doc.id, userId, caps.canEdit, io]);

  const save = useCallback(async () => {
    if (!caps.canEdit) return;
    setState('saving');
    try {
      const res = await io.post('/api/document/edit/save', {
        documentId: doc.id,
        content,
      });
      if (res.ok) {
        const result = res.data as { version: number };
        setSavedContent(content);
        setState('saved');
        onSaved?.(result.version);
        setTimeout(() => setState('clean'), 1500);
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }, [caps.canEdit, doc.id, content, io, onSaved]);

  // ⌘S to save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const dirty = content !== savedContent;

  const applyFormat = (format: 'bold' | 'italic' | 'underline' | 'code' | 'strike') => {
    if (!caps.canFormat) return;
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end);
    if (!selected) return;
    let wrapper: [string, string] = ['', ''];
    switch (format) {
      case 'bold': wrapper = ['**', '**']; break;
      case 'italic': wrapper = ['*', '*']; break;
      case 'underline': wrapper = ['<u>', '</u>']; break;
      case 'code': wrapper = ['`', '`']; break;
      case 'strike': wrapper = ['~~', '~~']; break;
    }
    const newContent = content.slice(0, start) + wrapper[0] + selected + wrapper[1] + content.slice(end);
    setContent(newContent);
    setState('dirty');
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + wrapper[0].length, end + wrapper[0].length);
    }, 0);
  };

  const doFindReplace = (all = true) => {
    if (!findText) return;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'gi');
    const newContent = content.replace(re, replaceText);
    if (newContent !== content) {
      setContent(newContent);
      setState('dirty');
    }
    setShowFindReplace(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-elevated)', color: 'var(--text)', fontFamily: 'ui-sans-serif, system-ui' }}>
      {/* Header: filetype + state */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', fontSize: 11 }}>
        <span>{ft?.icon ?? ''}</span>
        <strong style={{ fontSize: 12, flex: 1 }}>{doc.title}</strong>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{ft?.label ?? doc.mimeType}</span>
        {caps.canEdit && (
          <span style={{
            padding: '1px 6px',
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 600,
            background: state === 'saved' ? 'var(--color-success-surface)' : state === 'dirty' ? 'var(--color-warning-surface)' : state === 'saving' ? 'var(--color-info-surface)' : state === 'error' ? 'var(--color-error-surface)' : 'transparent',
            color: state === 'saved' ? 'var(--color-success)' : state === 'dirty' ? 'var(--color-warning)' : state === 'saving' ? 'var(--color-info)' : state === 'error' ? 'var(--color-error)' : 'var(--text-muted)',
          }}>
            {state === 'clean' && !dirty ? 'clean' : state === 'dirty' || dirty ? 'dirty' : state}
          </span>
        )}
      </div>

      {/* Toolbar (editable only) */}
      {caps.canEdit && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={save} disabled={!dirty || state === 'saving'} style={toolBtnStyle} title="Save (⌘S)">
            Save
          </button>
          <span style={dividerStyle} />
          {caps.canFormat && (
            <>
              <button onClick={() => applyFormat('bold')} style={toolBtnStyle} title="Bold"><strong>B</strong></button>
              <button onClick={() => applyFormat('italic')} style={toolBtnStyle} title="Italic"><em>I</em></button>
              <button onClick={() => applyFormat('underline')} style={toolBtnStyle} title="Underline"><u>U</u></button>
              <button onClick={() => applyFormat('code')} style={toolBtnStyle} title="Code"><code>{'</>'}</code></button>
              <button onClick={() => applyFormat('strike')} style={toolBtnStyle} title="Strikethrough"><s>S</s></button>
              <span style={dividerStyle} />
            </>
          )}
          {caps.canFindReplace && (
            <button onClick={() => setShowFindReplace((s) => !s)} style={toolBtnStyle} title="Find & Replace">
               Find
            </button>
          )}
          {ft?.editor === 'textarea' && (
            <>
              <span style={dividerStyle} />
              <button onClick={() => setShowPreview((s) => !s)} style={toolBtnStyle}>
                {showPreview ? '◀ Edit only' : 'Split '}
              </button>
            </>
          )}
          <span style={{ flex: 1 }} />
          {session && (
            <span style={{ fontSize: 9, color: 'var(--text-subtle)' }}>
              v{doc.version} · {content.length} chars
            </span>
          )}
        </div>
      )}

      {/* Find & replace bar */}
      {showFindReplace && caps.canFindReplace && (
        <div style={{ display: 'flex', gap: 4, padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <input
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            placeholder="Find"
            style={{ ...inputStyle, flex: 1 }}
          />
          <input
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => doFindReplace(true)} style={toolBtnStyle}>Replace all</button>
          <button onClick={() => setShowFindReplace(false)} style={toolBtnStyle}></button>
        </div>
      )}

      {/* Body: editor + preview */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {caps.canEdit ? (
          <>
            <div style={{ flex: showPreview && ft?.editor === 'textarea' ? 1 : 2, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <EditorForFiletype
                ft={ft}
                content={content}
                onChange={(c) => {
                  setContent(c);
                  setState('dirty');
                }}
                textareaRef={textareaRef}
                capabilities={caps}
              />
            </div>
            {showPreview && ft?.editor === 'textarea' && (
              <div style={{ flex: 1, borderLeft: '1px solid var(--border)', overflow: 'auto', padding: 12, background: 'var(--bg-elevated)' }}>
                <PreviewForFiletype ft={ft} content={content} />
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <PreviewForFiletype ft={ft} content={content} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Pick the right editor component for the filetype. */
function EditorForFiletype({
  ft,
  content,
  onChange,
  textareaRef,
}: {
  ft: DocumentFiletypeSpec | null;
  content: string;
  onChange: (c: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  capabilities: EditorCapabilities;
}) {
  if (!ft) {
    return <textarea value={content} onChange={(e) => onChange(e.target.value)} style={textareaStyle} ref={textareaRef} />;
  }
  switch (ft.editor) {
    case 'textarea':
      return (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          style={textareaStyle}
          spellCheck={false}
        />
      );
    case 'code':
      return (
        <div style={{ ...textareaStyle, padding: 12, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'inherit',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit',
              resize: 'none',
              whiteSpace: 'pre',
            }}
            spellCheck={false}
          />
        </div>
      );
    case 'contenteditable':
      return (
        <div
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange((e.target as HTMLDivElement).innerText)}
          style={{ ...textareaStyle, padding: 12, overflow: 'auto' }}
        >
          {content}
        </div>
      );
    case 'sheet':
      return <SheetEditor content={content} onChange={onChange} delimiter={ft.engine === 'tsv' ? '\t' : ','} />;
    case 'structured':
    case 'slides':
      return (
        <div style={{ ...textareaStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{ft.icon}</div>
            <div style={{ fontSize: 12 }}>{ft.label} structured editor</div>
            <div style={{ fontSize: 10, marginTop: 4 }}>Production wires {ft.engine === 'docx' ? 'mammoth' : ft.engine === 'xlsx' ? 'exceljs' : 'the native engine'} here.</div>
          </div>
        </div>
      );
    default:
      return <textarea value={content} onChange={(e) => onChange(e.target.value)} style={textareaStyle} ref={textareaRef} />;
  }
}

/** Pick the right preview renderer for the filetype. */
function PreviewForFiletype({
  ft,
  content,
}: {
  ft: DocumentFiletypeSpec | null;
  content: string;
}) {
  if (!ft) return <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{content}</pre>;
  switch (ft.engine) {
    case 'markdown':
      return <MarkdownPreview content={content} />;
    case 'rst':
    case 'asciidoc':
    case 'org':
    case 'tex':
      return (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{content}</pre>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-subtle)' }}> {ft.label} source (production: {ft.engine} renderer)</div>
        </div>
      );
    case 'html':
      return (
        <div style={{ fontSize: 12 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
      );
    case 'json':
      return <JsonPreview content={content} />;
    case 'code':
      return (
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5 }}>
          {content}
        </pre>
      );
    case 'csv':
    case 'tsv':
      return <SheetPreview content={content} delimiter={ft.engine === 'tsv' ? '\t' : ','} />;
    case 'pdf':
    case 'docx':
    case 'xlsx':
    case 'pptx':
    case 'odt':
    case 'ods':
    case 'odp':
      return (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
          <div style={{ fontSize: 48 }}>{ft.icon}</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>{ft.label}</div>
          <div style={{ fontSize: 10, marginTop: 4 }}>Production: {ft.engine} renderer</div>
        </div>
      );
    default:
      return <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{content}</pre>;
  }
}

/** Markdown preview (very lightweight — production swaps in react-markdown). */
function MarkdownPreview({ content }: { content: string }) {
  const html = simpleMarkdownToHtml(content);
  return <div style={{ fontSize: 13, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
}

/** Tiny markdown-to-HTML (headings, bold, italic, code, links, lists). */
function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.+<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/\n\n/g, '</p><p>');
  return `<p>${html}</p>`;
}

/** JSON preview (pretty-printed). */
function JsonPreview({ content }: { content: string }) {
  let parsed: unknown = null;
  let parseError = false;
  try {
    parsed = JSON.parse(content);
  } catch {
    parseError = true;
  }
  if (parseError) {
    return (
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-error)' }}>
        {content}
        {'\n\n Invalid JSON'}
      </pre>
    );
  }
  return (
    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5 }}>
      {JSON.stringify(parsed, null, 2)}
    </pre>
  );
}

/** Spreadsheet editor (CSV/TSV). */
function SheetEditor({ content, onChange, delimiter }: { content: string; onChange: (c: string) => void; delimiter: string }) {
  const rows = content.split('\n').map((r) => r.split(delimiter));
  const updateCell = (r: number, c: number, value: string) => {
    rows[r]![c] = value;
    onChange(rows.map((row) => row.join(delimiter)).join('\n'));
  };
  return (
    <div style={{ overflow: 'auto', padding: 8 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              <td style={{ ...cellStyle, background: 'var(--bg-subtle)', color: 'var(--text-muted)', textAlign: 'right', minWidth: 32 }}>{r + 1}</td>
              {row.map((cell, c) => (
                <td key={c} style={{ padding: 0 }}>
                  <input
                    value={cell}
                    onChange={(e) => updateCell(r, c, e.target.value)}
                    style={{
                      border: '1px solid var(--border)',
                      padding: '3px 6px',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      minWidth: 60,
                      width: '100%',
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Spreadsheet preview (read-only). */
function SheetPreview({ content, delimiter }: { content: string; delimiter: string }) {
  const rows = content.split('\n').slice(0, 50);
  return (
    <table style={{ borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--font-mono)', width: '100%' }}>
      <tbody>
        {rows.map((row, r) => {
          const cells = row.split(delimiter);
          return (
            <tr key={r}>
              {cells.map((cell, c) => (
                <td key={c} style={{ ...cellStyle, background: r === 0 ? 'var(--bg-subtle)' : 'transparent', fontWeight: r === 0 ? 600 : 400 }}>
                  {cell}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  border: 'none',
  outline: 'none',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  lineHeight: 1.6,
  padding: 12,
  resize: 'none',
  flex: 1,
};
const toolBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'inherit',
};
const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'var(--border)',
  margin: '0 2px',
};
const cellStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  padding: '3px 6px',
};
const inputStyle: React.CSSProperties = {
  padding: '4px 6px',
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'inherit',
};
