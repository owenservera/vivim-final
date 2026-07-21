'use client';

import { useCallback, useRef } from 'react';

/**
 * components/chat/SurfaceTabs.tsx
 * --------------------------------------------------------------------
 * Tab bar for switching between surfaces.
 * Supports Ctrl+Tab / Ctrl+Shift+Tab keyboard navigation.
 * Extracted from page.tsx to reduce monolith complexity.
 */

interface SurfaceTabsProps {
  surfaces: readonly { slug: string; label: string; icon: string }[];
  activeSurface: string;
  setActiveSurface: (slug: string) => void;
  openDrawer: (id: string) => void;
}

export function SurfaceTabs({
  surfaces,
  activeSurface,
  setActiveSurface,
  openDrawer,
}: SurfaceTabsProps) {
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'Tab') return;
      e.preventDefault();
      const idx = surfaces.findIndex((s) => s.slug === activeSurface);
      const next = e.shiftKey
        ? (idx - 1 + surfaces.length) % surfaces.length
        : (idx + 1) % surfaces.length;
      const nextSurface = surfaces[next];
      if (nextSurface) {
        setActiveSurface(nextSurface.slug);
        openDrawer(`surface:${nextSurface.slug}`);
        tabRefs.current.get(nextSurface.slug)?.focus();
      }
    },
    [surfaces, activeSurface, setActiveSurface, openDrawer],
  );

  return (
    <div
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 4px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-subtle)',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {surfaces.map((s) => (
        <button
          key={s.slug}
          ref={(el) => { if (el) tabRefs.current.set(s.slug, el); }}
          type="button"
          tabIndex={activeSurface === s.slug ? 0 : -1}
          onClick={() => {
            setActiveSurface(s.slug);
            openDrawer(`surface:${s.slug}`);
          }}
          style={{
            padding: '6px 10px',
            border: 'none',
            borderBottom: activeSurface === s.slug ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent',
            color: activeSurface === s.slug ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: activeSurface === s.slug ? 600 : 400,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
            borderRadius: '4px 4px 0 0',
          }}
        >
          <span style={{ marginRight: 4 }}>{s.icon}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
