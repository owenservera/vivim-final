'use client';

/**
 * components/canvas/CommandPalette.tsx (#1 + #2 + #10 enhancements)
 * --------------------------------------------------------------------
 * ⌘K Command Palette + Universal Search + History + Filters + Preview.
 *
 * - Press ⌘K (Mac) or Ctrl+K (Win/Linux) to open.
 * - Fuzzy-searches commands, docs, media, automations, agents,
 *   workspaces, providers — all via /api/search.
 * - Keyboard-first: ↑↓ to navigate, Enter to execute, Esc to close.
 * - Search history persisted to localStorage.
 * - Filter chips to narrow by kind.
 * - Preview pane for selected result.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { SearchHit, SearchEntityKind } from '../../shared/search';
import { Truncate } from './Truncate';
import { Icon, type IconName } from './Icon';
import { dispatchBehavior } from '@/shared/dispatch-behavior';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import { getSearchHistory, addSearchHistory, type SearchHistoryEntry } from '@/lib/searchHistory';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const KIND_GROUPS: Array<{ kind: SearchEntityKind; label: string; icon: IconName }> = [
  { kind: 'command',    label: 'Commands',     icon: 'zap' },
  { kind: 'workspace',  label: 'Workspaces',   icon: 'folder' },
  { kind: 'document',   label: 'Documents',    icon: 'document' },
  { kind: 'media',      label: 'Media',        icon: 'image' },
  { kind: 'automation', label: 'Automations',  icon: 'bolt' },
  { kind: 'agent',      label: 'Agents',       icon: 'robot' },
  { kind: 'provider',   label: 'Providers',    icon: 'connections' },
  { kind: 'capability', label: 'Capabilities', icon: 'sparkle' },
  { kind: 'panel',      label: 'Panels',       icon: 'layers' },
];

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction?: (hit: SearchHit) => void;
  onOpenAssistant?: () => void;
  workspaceId: string;
}

export function CommandPalette({ open, onClose, onAction, onOpenAssistant, workspaceId }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SearchEntityKind | null>(null);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>({ active: open });
  const io = useIO();

  // Load history on open
  useEffect(() => {
    if (open) {
      setHistory(getSearchHistory());
      setQuery('');
      setHits([]);
      setSelectedIndex(0);
      setActiveFilter(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open || query.trim().length < 1) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await dispatchBehavior('search', query, null, io, { workspaceId, limit: 30 });
        const searchData = result.data as { hits?: SearchHit[] } | undefined;
        setHits(searchData?.hits ?? []);
        setSelectedIndex(0);
        // History is recorded at execution time (Enter / click), not on every search.
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [query, open, workspaceId, io]);

  // Filter hits by active filter
  const filteredHits = useMemo(() => {
    if (!activeFilter) return hits;
    return hits.filter((h) => h.kind === activeFilter);
  }, [hits, activeFilter]);

  // Group hits by kind
  const grouped = useMemo(() => {
    const map = new Map<SearchEntityKind, SearchHit[]>();
    for (const h of filteredHits) {
      const bucket = map.get(h.kind) ?? [];
      bucket.push(h);
      map.set(h.kind, bucket);
    }
    return map;
  }, [filteredHits]);

  // Get available kinds from hits
  const availableKinds = useMemo(() => {
    const kinds = new Set(hits.map((h) => h.kind));
    return KIND_GROUPS.filter((g) => kinds.has(g.kind));
  }, [hits]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(filteredHits.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && filteredHits[selectedIndex]) {
        e.preventDefault();
        addSearchHistory(query);
        onAction?.(filteredHits[selectedIndex]!);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filteredHits, selectedIndex, onClose, onAction]);

  if (!open) return null;

  const showHistory = query.trim().length === 0 && history.length > 0;
  const selectedHit = filteredHits[selectedIndex] ?? null;

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
        ref={trapRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 90vw)',
          maxHeight: '65vh',
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
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)', gap: 10 }}>
          <Icon name="search" size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, docs, automations, agents, workspaces…"
            aria-label="Search"
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
          <kbd style={kbdStyle}>ESC</kbd>
        </div>

        {/* Filter chips */}
        {availableKinds.length > 0 && (
          <div style={{ display: 'flex', gap: 4, padding: '6px 14px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
            <button
              onClick={() => setActiveFilter(null)}
              style={{
                ...chipStyle,
                background: activeFilter === null ? 'var(--accent)' : 'transparent',
                color: activeFilter === null ? 'var(--accent-foreground)' : 'var(--text-muted)',
              }}
            >
              All
            </button>
            {availableKinds.map((g) => (
              <button
                key={g.kind}
                onClick={() => setActiveFilter(activeFilter === g.kind ? null : g.kind)}
                style={{
                  ...chipStyle,
                  background: activeFilter === g.kind ? 'var(--accent)' : 'transparent',
                  color: activeFilter === g.kind ? 'var(--accent-foreground)' : 'var(--text-muted)',
                }}
              >
                {g.icon} {g.label}
              </button>
            ))}
          </div>
        )}

        {/* Content area: history or results + preview */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Results list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 4, minWidth: 0 }}>
            {showHistory && (
              <div style={{ padding: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>Recent searches</div>
                {history.slice(0, 5).map((e) => (
                  <button
                    key={e.query}
                    onClick={() => setQuery(e.query)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                      padding: '6px 10px', border: 'none', background: 'transparent',
                      color: 'var(--text)', cursor: 'pointer', borderRadius: 4, fontSize: 13,
                      fontFamily: 'inherit',
                    }}
                  >
                    <Icon name="history" size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    {e.query}
                  </button>
                ))}
              </div>
            )}

            {filteredHits.length === 0 && query.trim().length > 0 && !loading && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
                No results for "{query}"
              </div>
            )}

            {!showHistory && filteredHits.length === 0 && query.trim().length === 0 && (
              <div style={{ padding: 24, color: 'var(--text-subtle)', fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>Quick actions</div>
                {([
                  { label: 'Ask Vivim',               cmd: 'assistant:open',            icon: 'sparkle' as IconName, action: () => onOpenAssistant?.() },
                  { label: 'Open Shell tab',           cmd: 'switch-surface:shell',      icon: 'terminal' as IconName },
                  { label: 'Open Documents tab',       cmd: 'switch-surface:docs',       icon: 'document' as IconName },
                  { label: 'Open Automation Builder',  cmd: 'switch-surface:automation', icon: 'bolt' as IconName },
                  { label: 'Open Agents Builder',      cmd: 'switch-surface:agents',     icon: 'robot' as IconName },
                  { label: 'Run "admin db status"',    cmd: 'shell:admin db status',     icon: 'terminal' as IconName },
                ] as Array<{ label: string; cmd: string; icon: IconName; action?: () => void }>).map((a) => (
                  <button
                    key={a.cmd}
                    onClick={() => {
                      if (a.action) {
                        a.action();
                      } else {
                        onAction?.({ kind: 'command', id: a.cmd, title: a.label, score: 0, icon: '', actionUrl: a.cmd });
                      }
                      onClose();
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                      padding: '6px 10px', border: 'none', background: 'transparent',
                      color: 'var(--text)', cursor: 'pointer', borderRadius: 4, fontSize: 12,
                      fontFamily: 'inherit',
                    }}
                  >
                    <Icon name={a.icon} size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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
                  <div style={{
                    padding: '6px 10px 2px', fontSize: 10, fontWeight: 600,
                    color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Icon name={icon} size={11} />
                    {label}
                  </div>
                  {groupHits.map((hit) => {
                    const flatIdx = filteredHits.indexOf(hit);
                    const selected = flatIdx === selectedIndex;
                    return (
                      <button
                        key={`${hit.kind}|${hit.id}`}
                        onClick={() => {
                          addSearchHistory(query);
                          onAction?.(hit);
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(flatIdx)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                          padding: '8px 10px', border: 'none',
                          background: selected ? 'var(--accent-subtle)' : 'transparent',
                          color: 'var(--text)', cursor: 'pointer', borderRadius: 6,
                          textAlign: 'left', fontFamily: 'inherit',
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{hit.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>
                            <Truncate>{hit.title}</Truncate>
                          </div>
                          {hit.subtitle && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              <Truncate>{hit.subtitle}</Truncate>
                            </div>
                          )}
                        </div>
                        {hit.actionLabel && (
                          <span style={{
                            padding: '2px 8px', border: '1px solid var(--border)',
                            borderRadius: 4, fontSize: 10, color: 'var(--text-muted)',
                          }}>
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

          {/* Preview pane */}
          {selectedHit && (
            <div style={{
              width: 240, borderLeft: '1px solid var(--border)', padding: 16,
              overflowY: 'auto', background: 'var(--bg-subtle)',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{selectedHit.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{selectedHit.title}</div>
              {selectedHit.subtitle && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{selectedHit.subtitle}</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                Type: {selectedHit.kind}
              </div>
              {selectedHit.actionUrl && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {selectedHit.actionUrl}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 14px', borderTop: '1px solid var(--border)',
          background: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: 'var(--text-subtle)',
        }}>
          <span>
            <kbd style={kbdStyle}>↑↓</kbd> navigate · <kbd style={kbdStyle}>↵</kbd> select · <kbd style={kbdStyle}>esc</kbd> close
          </span>
          <span>{filteredHits.length} results</span>
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
  fontFamily: 'var(--font-mono)',
};

const chipStyle: React.CSSProperties = {
  padding: '3px 10px',
  border: '1px solid var(--border)',
  borderRadius: 12,
  fontSize: 11,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
};
