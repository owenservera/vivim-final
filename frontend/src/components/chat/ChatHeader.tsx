'use client';

/**
 * components/chat/ChatHeader.tsx
 * --------------------------------------------------------------------
 * Header bar with presence indicator, search, notifications, and theme.
 * Extracted from page.tsx to reduce monolith complexity.
 */

import { PresenceIndicator } from '@/components/canvas';
import { NotificationsCenter } from '@/components/canvas';
import { ThemeSettings } from '@/components/canvas';

interface ChatHeaderProps {
  workspaceId: string;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  themeOpen: boolean;
  setThemeOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}

export function ChatHeader({
  workspaceId,
  paletteOpen,
  setPaletteOpen,
  themeOpen,
  setThemeOpen,
}: ChatHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        flexShrink: 0,
      }}
    >
      <strong style={{ fontSize: 13 }}>Vivim</strong>
      <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>Phase 3 · 10 UX enhancements</span>

      <div style={{ flex: 1 }} />

      {/* #7 Presence */}
      <div data-onboarding="presence">
        <PresenceIndicator workspaceId={workspaceId} />
      </div>

      {/* #1 ⌘K button */}
      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          color: 'var(--text-muted)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'inherit',
          minWidth: 180,
        }}
      >
        <span>🔍</span>
        <span style={{ flex: 1, textAlign: 'left' }}>Search or run a command…</span>
        <kbd
          style={{
            padding: '1px 5px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
          }}
        >
          ⌘K
        </kbd>
      </button>

      {/* #3 Notifications */}
      <NotificationsCenter userId="user:demo" />

      {/* #4 Theme */}
      <button
        type="button"
        onClick={() => setThemeOpen((o) => !o)}
        style={{
          padding: '6px 10px',
          border: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
          fontFamily: 'inherit',
        }}
        title="Appearance"
      >
        🎨
      </button>
      {themeOpen && <ThemeSettings onClose={() => setThemeOpen(false)} />}
    </header>
  );
}
