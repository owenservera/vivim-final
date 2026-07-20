'use client';

/**
 * components/canvas/QuickActionsMenu.tsx (#6)
 * --------------------------------------------------------------------
 * Right-click context menu — radial-style quick actions.
 * Open Document / Open Video / Open Audio / Run Automation / Invoke
 * Agent / Shell Command / Search (⌘K) / Switch Workspace.
 *
 * Each action opens a small inline prompt or triggers the Command Palette.
 */

import { useEffect, useState } from 'react';

interface ActionItem {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
}

export interface QuickActionsMenuProps {
  onOpenDoc?: () => void;
  onOpenVideo?: () => void;
  onOpenAudio?: () => void;
  onRunAutomation?: () => void;
  onInvokeAgent?: () => void;
  onShellCommand?: () => void;
  onSearch?: () => void;
  onSwitchWorkspace?: () => void;
}

export function QuickActionsMenu(props: QuickActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
      setOpen(true);
    };
    const onClick = () => setOpen(false);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  if (!open) return null;

  const items: ActionItem[] = [
    { id: 'doc', label: 'Open document', icon: '📄', action: () => props.onOpenDoc?.() },
    { id: 'video', label: 'Open video', icon: '🎬', action: () => props.onOpenVideo?.() },
    { id: 'audio', label: 'Open audio', icon: '🎵', action: () => props.onOpenAudio?.() },
    { id: 'sep1', label: '', icon: '', action: () => {} },
    { id: 'auto', label: 'Run automation', icon: '⚡', action: () => props.onRunAutomation?.() },
    { id: 'agent', label: 'Invoke agent', icon: '🤖', action: () => props.onInvokeAgent?.() },
    { id: 'sep2', label: '', icon: '', action: () => {} },
    { id: 'shell', label: 'Shell command', icon: '⌨️', action: () => props.onShellCommand?.() },
    { id: 'search', label: 'Search', icon: '🔍', shortcut: '⌘K', action: () => props.onSearch?.() },
    { id: 'ws', label: 'Switch workspace', icon: '🗂️', action: () => props.onSwitchWorkspace?.() },
  ];

  // Clamp position so the menu stays on-screen.
  const x = Math.min(pos.x, window.innerWidth - 220);
  const y = Math.min(pos.y, window.innerHeight - items.length * 32 - 16);

  return (
    <div
      style={{
        position: 'fixed',
        top: y,
        left: x,
        minWidth: 200,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: 'var(--shadow)',
        padding: 4,
        zIndex: 1200,
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) =>
        item.label === '' ? (
          <div key={item.id} style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />
        ) : (
          <button
            key={item.id}
            onClick={() => {
              item.action();
              setOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '6px 10px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              cursor: 'pointer',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--accent-subtle)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <kbd
                style={{
                  padding: '1px 5px',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  fontSize: 9,
                  fontFamily: 'ui-monospace, monospace',
                  color: 'var(--text-muted)',
                }}
              >
                {item.shortcut}
              </kbd>
            )}
          </button>
        ),
      )}
    </div>
  );
}
