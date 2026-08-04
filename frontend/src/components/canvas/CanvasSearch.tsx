'use client';

import { useEffect, useState, useCallback } from 'react';

export interface CanvasSearchProps {
  nodes: Array<{ id: string; label: string }>;
  onSelect?: (nodeId: string) => void;
  onHighlight?: (nodeId: string | null) => void;
  onQueryChange?: (query: string) => void;
}

export function CanvasSearch({ nodes, onSelect, onHighlight, onQueryChange }: CanvasSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const matches = query.trim() ? nodes.filter(n => n.label.toLowerCase().includes(query.toLowerCase())) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
        onHighlight?.(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onHighlight]);

  useEffect(() => {
    onHighlight?.(matches[0]?.id ?? null);
  }, [matches, onHighlight]);

  const handleSelect = useCallback((nodeId: string) => {
    onSelect?.(nodeId);
    setOpen(false);
    setQuery('');
  }, [onSelect]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 280,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      }}
    >
      <input
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onQueryChange?.(e.target.value);
        }}
        placeholder="Search nodes..."
        style={{
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '4px 8px',
          background: 'var(--bg)',
          color: 'var(--text)',
          fontSize: 12,
          outline: 'none',
        }}
      />
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {query.trim() ? `${matches.length} match${matches.length === 1 ? '' : 'es'}` : 'Type to search'}
      </div>
      {matches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto' }}>
          {matches.slice(0, 10).map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelect(m.id)}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 8px',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: 11,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
