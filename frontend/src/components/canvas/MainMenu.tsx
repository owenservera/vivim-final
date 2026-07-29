'use client';

/**
 * components/canvas/MainMenu.tsx
 * --------------------------------------------------------------------
 * Main dropdown menu - the single menu for all app actions.
 * Replaces scattered toolbar buttons with one organized menu.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Icon, type IconName } from './Icon';

interface MenuItem {
  id: string;
  label: string;
  icon: IconName;
  shortcut?: string;
  action: () => void;
  divider?: boolean;
}

interface MainMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onTogglePanel: (panelId: string) => void;
  onToggleDevConsole: () => void;
  onOpenThemeSettings: () => void;
  onOpenAssistant?: () => void;
}

export function MainMenu({
  isOpen,
  onClose,
  onTogglePanel,
  onToggleDevConsole,
  onOpenThemeSettings,
  onOpenAssistant,
}: MainMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const items: MenuItem[] = [
    { id: 'assistant', label: 'Ask Vivim', icon: 'chat', shortcut: 'Cmd+Shift+H', action: () => { onOpenAssistant?.(); onClose(); } },
    { id: 'divider-0', label: '', icon: 'circle', action: () => {}, divider: true },
    { id: 'conversations', label: 'Conversations', icon: 'message-square', action: () => { onTogglePanel('conversations'); onClose(); } },
    { id: 'providers', label: 'Providers', icon: 'cpu', action: () => { onTogglePanel('providers'); onClose(); } },
    { id: 'settings', label: 'Settings', icon: 'settings', shortcut: 'Cmd+,', action: () => { onTogglePanel('settings'); onClose(); } },
    { id: 'divider-1', label: '', icon: 'circle', action: () => {}, divider: true },
    { id: 'health', label: 'Health Dashboard', icon: 'activity', action: () => { onTogglePanel('health'); onClose(); } },
    { id: 'capabilities', label: 'Capabilities', icon: 'grid', shortcut: 'Cmd+Shift+K', action: () => { onTogglePanel('capabilities'); onClose(); } },
    { id: 'search-panel', label: 'Search', icon: 'search', shortcut: 'Cmd+/', action: () => { onTogglePanel('search'); onClose(); } },
    { id: 'documents', label: 'Documents', icon: 'document', action: () => { onTogglePanel('documents'); onClose(); } },
    { id: 'media', label: 'Media', icon: 'media', action: () => { onTogglePanel('media'); onClose(); } },
    { id: 'automation-panel', label: 'Automations', icon: 'bolt', shortcut: 'Cmd+Shift+A', action: () => { onTogglePanel('automation'); onClose(); } },
    { id: 'agents-panel', label: 'Agents', icon: 'robot', action: () => { onTogglePanel('agents'); onClose(); } },
    { id: 'divider-2', label: '', icon: 'circle', action: () => {}, divider: true },
    { id: 'terminal', label: 'Terminal', icon: 'terminal', shortcut: 'Cmd+Shift+T', action: () => { onTogglePanel('terminal'); onClose(); } },
    { id: 'zlayers', label: 'Z-Layers', icon: 'layers', action: () => { onTogglePanel('zlayers'); onClose(); } },
    { id: 'audit-panel', label: 'Audit Trail', icon: 'chart', action: () => { onTogglePanel('audit'); onClose(); } },
    { id: 'templates-panel', label: 'Templates', icon: 'template', action: () => { onTogglePanel('templates'); onClose(); } },
    { id: 'rbac-panel', label: 'RBAC', icon: 'shield', action: () => { onTogglePanel('rbac'); onClose(); } },
    { id: 'divider-3', label: '', icon: 'circle', action: () => {}, divider: true },
    { id: 'dev-console', label: 'Dev Console', icon: 'terminal', shortcut: 'Cmd+`', action: () => { onToggleDevConsole(); onClose(); } },
    { id: 'theme', label: 'Theme Settings', icon: 'palette', action: () => { onOpenThemeSettings(); onClose(); } },
  ];

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Main application menu"
      style={{
        position: 'fixed',
        top: 52,
        right: 12,
        zIndex: 1100,
        minWidth: 200,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
        padding: 4,
        animation: 'scale-in 0.12s ease-out',
      }}
    >
      {items.map((item) => {
        if (item.divider) {
          return (
            <div
              key={item.id}
              role="separator"
              style={{ height: 1, background: 'var(--border)', margin: '4px 0' }}
            />
          );
        }
        return (
          <button
            key={item.id}
            role="menuitem"
            onClick={item.action}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '12px 12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--foreground)',
              borderRadius: 'calc(var(--radius) - 4px)',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              textAlign: 'left',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon name={item.icon} size={14} className="text-muted-foreground" />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <kbd style={{
                padding: '1px 5px',
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                color: 'var(--muted-foreground)',
              }}>
                {item.shortcut}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  );
}
