'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icon';

export interface MediaPanelProps {
  workspaceId?: string;
}

interface MediaItem {
  id: string;
  title: string;
  type: 'image' | 'video' | 'audio';
  url: string;
}

export function MediaPanel({ workspaceId }: MediaPanelProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    fetch(`/api/media/list?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((r) => r.json())
      .then((data) => { setItems(data.media ?? []); setLoading(false); })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [workspaceId]);

  const handleGenerate = useCallback(() => {
    fetch(`/api/media/generate`, { method: 'POST', body: JSON.stringify({ workspaceId }) })
      .then((r) => r.json())
      .then((item) => { if (item.id) setItems((prev) => [item, ...prev]); })
      .catch(() => {});
  }, [workspaceId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Media</span>
        <button onClick={handleGenerate} style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer', background: 'transparent', color: 'var(--text)' }}>
          <Icon name="plus" size={11} /> Generate
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && <div style={{ padding: 12, fontSize: 11, color: 'var(--muted-foreground)' }}>Loading media…</div>}
        {error && <div style={{ padding: 12, fontSize: 11, color: 'var(--destructive)' }}>{error}</div>}
        {!loading && !error && items.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 11 }}>
            No media yet. Generate or upload to get started.
          </div>
        )}
        {!loading && !error && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8, padding: 12 }}>
            {items.map((item) => (
              <div key={item.id} style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-subtle)' }}>
                <Icon name={item.type === 'video' ? 'video' : item.type === 'audio' ? 'audio' : 'image'} size={20} className="text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
