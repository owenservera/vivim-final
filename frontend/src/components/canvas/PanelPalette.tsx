'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { CATEGORY_COLORS, listPanels, type TabConfig } from './TabConfig';

export interface PanelPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (panelId: string) => void;
}

export function PanelPalette({ open, onOpenChange, onSelect }: PanelPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get all panels from registry
  const allPanels = useMemo(() => listPanels(), []);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allPanels;
    const q = query.toLowerCase();
    return allPanels.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [allPanels, query]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        setQuery('');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const panel = filtered[activeIdx];
        if (panel) {
          onSelect?.(panel.id);
          onOpenChange(false);
          setQuery('');
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange, onSelect, filtered, activeIdx]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
    }
  }, [open]);

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in oklch, var(--background) 60%, transparent)',
        backdropFilter: 'blur(4px)',
        zIndex: 2000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
          setQuery('');
        }
      }}
    >
      <div
        role="dialog"
        aria-label="Panel palette"
        aria-modal="true"
        style={{
          position: 'relative',
          width: 480,
          maxWidth: '90vw',
          maxHeight: '80vh',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Icon name="search" size={14} style={{ position: 'absolute', left: 8, color: 'var(--muted-foreground)' }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search panels... (Cmd+Shift+P)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px 6px 32px',
                fontSize: 12,
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: 'var(--bg)',
                color: 'var(--text)',
                outline: 'none',
              }}
            />
          </div>
          {filtered.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--muted-foreground)' }}>
              {filtered.length} panel{filtered.length === 1 ? '' : 's'} — Use ↑↓ to navigate, Enter to open, Esc to close
            </div>
          )}
        </div>

        {/* Panel list */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, fontSize: 11, color: 'var(--muted-foreground)', textAlign: 'center' }}>
              No panels match your search.
            </div>
          ) : (
            filtered.map((panel, idx) => {
              const categoryColor = CATEGORY_COLORS[panel.category];
              const isActive = idx === activeIdx;
              return (
                <div
                  key={panel.id}
                  onClick={() => {
                    onSelect?.(panel.id);
                    onOpenChange(false);
                    setQuery('');
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    background: isActive
                      ? 'color-mix(in oklch, var(--accent) 12%, transparent)'
                      : 'transparent',
                    borderLeft: isActive
                      ? `2px solid var(--accent)`
                      : `2px solid transparent`,
                  }}
                >
                  <Icon name={panel.icon as IconName} size={14} style={{ color: categoryColor }} />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text)' }}>
                      {panel.label}
                    </span>
                    {panel.description && (
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {panel.description}
                      </span>
                    )}
                  </div>
                  {panel.shortcut && (
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 3 }}>
                      {panel.shortcut}
                    </span>
                  )}
                  <Icon name="arrow-right" size={11} style={{ color: 'var(--muted-foreground)', opacity: isActive ? 1 : 0.5 }} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
