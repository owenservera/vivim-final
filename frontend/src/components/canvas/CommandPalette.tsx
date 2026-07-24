'use client';

/**
 * components/canvas/CommandPalette.tsx (#1 + #2)
 * --------------------------------------------------------------------
 * ⌘K Command Palette + Universal Search.
 *
 * - Press ⌘K (Mac) or Ctrl+K (Win/Linux) to open.
 * - Fuzzy-searches commands, docs, media, automations, agents,
 *   workspaces, providers — all via /api/search.
 * - Keyboard-first: / to navigate, Enter to execute, Esc to close.
 * - Results grouped by kind; each hit shows icon + title + subtitle.
 *
 * The palette reuses the same SearchIndex the backend exposes, so the
 * canvas shell and the API share one search transport.
 */

import { useEffect, useRef, useState } from 'react';
import type { SearchHit, SearchEntityKind } from '../../shared/search';

const KIND_GROUPS: Array<{ kind: SearchEntityKind; label: string; icon: string }> = [
  { kind: 'command', label: 'Commands', icon: '' },
  { kind: 'workspace', label: 'Workspaces', icon: '' },
  { kind: 'document', label: 'Documents', icon: '' },
  { kind: 'media', label: 'Media', icon: '' },
  { kind: 'automation', label: 'Automations', icon: '' },
  { kind: 'agent', label: 'Agents', icon: '' },
  { kind: 'provider', label: 'Providers', icon: '' },
  { kind: 'capability', label: 'Capabilities', icon: '' },
];

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction?: (hit: SearchHit) => void;
  workspaceId: string;
}

export function CommandPalette({ open, onClose, onAction, workspaceId }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open.
  useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open || query.trim().length < 1) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: query, workspaceId, limit: 30 }),
        });
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits ?? []);
        setSelectedIndex(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [query, open, workspaceId]);

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(hits.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && hits[selectedIndex]) {
        e.preventDefault();
        const hit = hits[selectedIndex]!;
        onAction?.(hit);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hits, selectedIndex, onClose, onAction]);

  if (!open) return null;

  // Group hits by kind.
  const grouped = new Map<SearchEntityKind, SearchHit[]>();
  for (const h of hits) {
    const bucket = grouped.get(h.kind) ?? [];
    bucket.push(h);
    grouped.set(h.kind, bucket);
  }

  return (
    <div
      data-command-palette="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 90vw)',
          maxHeight: '60vh',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          boxShadow: 'var(--shadow)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'ui-sans-serif, system-ui',
          color: 'var(--text)',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 18, marginRight: 10, color: 'var(--text-muted)' }}></span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, docs, automations, agents, workspaces…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 15,
              fontFamily: 'inherit',
            }}
          />
          {loading && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>…</span>}
          <kbd
            style={{
              padding: '2px 6px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
          {hits.length === 0 && query.trim().length > 0 && !loading && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}
          {hits.length === 0 && query.trim().length === 0 && (
            <div style={{ padding: 24, color: 'var(--text-subtle)', fontSize: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>Quick actions</div>
              {[
                { label: 'Open Shell tab', cmd: 'switch-surface:shell' },
                { label: 'Open Documents tab', cmd: 'switch-surface:docs' },
                { label: 'Open Automation Builder', cmd: 'switch-surface:automation' },
                { label: 'Open Agents Builder', cmd: 'switch-surface:agents' },
                { label: 'Run "admin db status"', cmd: 'shell:admin db status' },
              ].map((a) => (
                <button
                  key={a.cmd}
                  onClick={() => {
                    onAction?.({ kind: 'command', id: a.cmd, title: a.label, score: 0, icon: '', actionUrl: a.cmd });
                    onClose();
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 10px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'inherit',
                  }}
                >
                   {a.label}
                </button>
              ))}
            </div>
          )}

          {KIND_GROUPS.map(({ kind, label, icon }) => {
            const groupHits = grouped.get(kind);
            if (!groupHits || groupHits.length === 0) return null;
            return (
              <div key={kind} style={{ marginBottom: 4 }}>
                <div
                  style={{
                    padding: '6px 10px 2px',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--text-subtle)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {icon} {label}
                </div>
                {groupHits.map((hit) => {
                  const flatIdx = hits.indexOf(hit);
                  const selected = flatIdx === selectedIndex;
                  return (
                    <button
                      key={`${hit.kind}|${hit.id}`}
                      onClick={() => {
                        onAction?.(hit);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '8px 10px',
                        border: 'none',
                        background: selected ? 'var(--accent-subtle)' : 'transparent',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        borderRadius: 6,
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{hit.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {hit.title}
                        </div>
                        {hit.subtitle && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {hit.subtitle}
                          </div>
                        )}
                      </div>
                      {hit.actionLabel && (
                        <span
                          style={{
                            padding: '2px 8px',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            fontSize: 10,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {hit.actionLabel}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'var(--text-subtle)',
          }}
        >
          <span>
            <kbd style={kbdStyle}></kbd> navigate · <kbd style={kbdStyle}>↵</kbd> select · <kbd style={kbdStyle}>esc</kbd> close
          </span>
          <span>{hits.length} results</span>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: '1px 4px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  fontSize: 9,
  fontFamily: 'ui-monospace, monospace',
};
