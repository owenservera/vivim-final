'use client';

/**
 * components/canvas/cards/DocCard.tsx
 * --------------------------------------------------------------------
 * Document card. Renders a DocumentCard row (pdf / docx / pptx / xlsx /
 * markdown / code / text / html). Each document opened in the canvas
 * becomes a DocCard — a CanvasDefinition wrapper carrying an engineRef
 * so plugins can hot-swap the renderer.
 *
 * For the prototype, the card shows metadata + a sandboxed preview of
 * the inlineContent (or a "fetch from sourceUrl" hint). Production
 * swaps in pdfjs-dist / mammoth / shiki via the engineRef.
 */

import { useState } from 'react';
import type { DocumentCard } from '../../../shared/document';

export interface DocCardProps {
  document: DocumentCard;
  onAnnotate?: (documentId: string) => void;
}

export function DocCard({ document: doc, onAnnotate }: DocCardProps) {
  const [page, setPage] = useState(doc.currentPage ?? 1);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        background: 'white',
      }}
    >
      <header
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          fontSize: 11,
          color: '#374151',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 12 }}>{doc.title}</strong>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 4,
              background: '#dbeafe',
              color: '#1e40af',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {doc.engine}
          </span>
        </div>
        <div style={{ marginTop: 2, fontSize: 10, color: '#6b7280' }}>
          {doc.mimeType}
          {doc.wordCount ? ` · ${doc.wordCount} words` : ''}
          {doc.pageCount ? ` · ${doc.pageCount} pages` : ''}
          {doc.language ? ` · ${doc.language}` : ''}
        </div>
      </header>

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 12,
          fontSize: 13,
          lineHeight: 1.5,
          color: '#1f2937',
          whiteSpace: 'pre-wrap',
          fontFamily:
            doc.engine === 'code'
              ? 'var(--font-mono)'
              : 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        {doc.inlineContent ? (
          doc.inlineContent
        ) : doc.sourceUrl ? (
          <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
            Loading from {doc.sourceUrl}…
            <br />
            <br />
            <span style={{ fontSize: 11 }}>
              (Production: pdfjs-dist / mammoth / shiki fetch and render here
              via the <code>{doc.engineRef}</code> engine.)
            </span>
          </div>
        ) : (
          <div style={{ color: '#9ca3af' }}>Empty document</div>
        )}
      </div>

      <footer
        style={{
          padding: '4px 10px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 10,
          color: '#6b7280',
        }}
      >
        <span>
          engineRef: <code>{doc.engineRef}</code>
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {doc.engine === 'pdf' && (
            <>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={pageBtnStyle}
              >
                ‹
              </button>
              <span style={{ padding: '0 6px', lineHeight: '20px' }}>p.{page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                style={pageBtnStyle}
              >
                ›
              </button>
            </>
          )}
          {onAnnotate && (
            <button
              onClick={() => onAnnotate(doc.id)}
              style={pageBtnStyle}
              title="Annotate"
            >
              Edit
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

const pageBtnStyle: React.CSSProperties = {
  padding: '0 6px',
  border: '1px solid #d1d5db',
  background: 'white',
  borderRadius: 3,
  fontSize: 11,
  cursor: 'pointer',
  lineHeight: '18px',
};
