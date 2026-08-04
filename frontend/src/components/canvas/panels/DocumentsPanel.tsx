'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icon';

export interface DocumentsPanelProps {
  workspaceId?: string;
}

interface Document {
  id: string;
  title: string;
  kind: string;
  updatedAt: string;
}

export function DocumentsPanel({ workspaceId }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/document/list?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((r) => r.json())
      .then((data) => { setDocuments(data.documents ?? []); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [workspaceId]);

  const handleNew = useCallback(() => {
    fetch(`/api/document/create`, { method: 'POST', body: JSON.stringify({ workspaceId, title: 'Untitled' }) })
      .then((r) => r.json())
      .then((doc) => { if (doc.id) setDocuments((prev) => [doc, ...prev]); })
      .catch(() => {});
  }, [workspaceId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Documents</span>
        <button onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer', background: 'transparent', color: 'var(--text)' }}>
          <Icon name="plus" size={11} /> New
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && <div style={{ padding: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>Loading documents…</div>}
        {error && <div style={{ padding: 12, fontSize: 11, color: 'var(--destructive)' }}>{error}</div>}
        {!loading && !error && documents.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
            No documents yet. Create one to get started.
          </div>
        )}
        {!loading && !error && documents.map((doc) => (
          <div key={doc.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="document" size={14} className="text-muted-foreground" />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</span>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{doc.kind} · {new Date(doc.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
