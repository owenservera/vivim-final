'use client';

/**
 * components/canvas/SearchPanel.tsx
 * --------------------------------------------------------------------
 * Dedicated search panel — debounced text search with results grouped
 * by kind. Uses POST /api/search via useIO(). CSS variables only.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useIO } from './UnifiedIOProvider';
import { PanelShell } from './PanelShell';
import { Truncate } from './Truncate';
import { SectionLabel } from './SectionLabel';
import type { SearchHit, SearchEntityKind } from '../../shared/search';

const KIND_GROUPS: Array<{ kind: SearchEntityKind; label: string }> = [
  { kind: 'command', label: 'Commands' },
  { kind: 'workspace', label: 'Workspaces' },
  { kind: 'document', label: 'Documents' },
  { kind: 'media', label: 'Media' },
  { kind: 'automation', label: 'Automations' },
  { kind: 'agent', label: 'Agents' },
  { kind: 'provider', label: 'Providers' },
  { kind: 'capability', label: 'Capabilities' },
];

export function SearchPanel({ workspaceId }: { workspaceId?: string }) {
  const io = useIO();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 1) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await io.request<{ hits: SearchHit[] }>('/api/search', {
          method: 'POST',
          body: JSON.stringify({ text: query, workspaceId: workspaceId ?? 'ws:global', limit: 30 }),
        });
        if (res.ok) {
          setHits(res.data?.hits ?? []);
          setSelectedIndex(0);
        }
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [query, workspaceId, io]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(hits.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && hits[selectedIndex]) {
      e.preventDefault();
      // Navigate or execute hit
      const hit = hits[selectedIndex];
      if (hit.actionUrl) {
        window.open(hit.actionUrl, '_blank');
      }
    }
  }, [hits, selectedIndex]);

  // Group hits by kind
  const grouped = new Map<SearchEntityKind, SearchHit[]>();
  for (const h of hits) {
    const bucket = grouped.get(h.kind) ?? [];
    bucket.push(h);
    grouped.set(h.kind, bucket);
  }

  return (
    <PanelShell style={{ display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Search</h2>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search everything…"
          style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text)', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        {loading && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>…</span>}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {hits.length === 0 && query.trim().length > 0 && !loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
            No results for &ldquo;{query}&rdquo;
          </div>
        )}
        {hits.length === 0 && query.trim().length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
            Type to search across all entities
          </div>
        )}

        {KIND_GROUPS.map(({ kind, label }) => {
          const groupHits = grouped.get(kind);
          if (!groupHits || groupHits.length === 0) return null;
          return (
            <div key={kind} style={{ marginBottom: 12 }}>
              <SectionLabel style={{ padding: '4px 0 2px', fontSize: 10 }}>
                {label}
              </SectionLabel>
              {groupHits.map((hit) => {
                const flatIdx = hits.indexOf(hit);
                const selected = flatIdx === selectedIndex;
                return (
                  <button
                    key={`${hit.kind}|${hit.id}`}
                    onClick={() => { if (hit.actionUrl) window.open(hit.actionUrl, '_blank'); }}
                    onMouseEnter={() => setSelectedIndex(flatIdx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px',
                      border: 'none', background: selected ? 'var(--accent-subtle)' : 'transparent',
                      color: 'var(--text)', cursor: 'pointer', borderRadius: 4, textAlign: 'left', fontFamily: 'inherit', fontSize: 12,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{hit.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}><Truncate>{hit.title}</Truncate></div>
                      {hit.subtitle && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}><Truncate>{hit.subtitle}</Truncate></div>
                      )}
                    </div>
                    {hit.actionLabel && (
                      <span style={{ padding: '1px 6px', border: '1px solid var(--border)', borderRadius: 3, fontSize: 9, color: 'var(--text-muted)' }}>{hit.actionLabel}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}
