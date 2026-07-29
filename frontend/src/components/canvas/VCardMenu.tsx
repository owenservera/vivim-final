'use client';

/**
 * components/canvas/VCardMenu.tsx (V6 vCard system)
 * --------------------------------------------------------------------
 * Hierarchical capability menu on every node. Two layers:
 *   1. Global actions (collapse, pin, fullscreen, duplicate, etc.)
 *   2. Per-widget-type actions (chat: new thread, branch, merge; tool:
 *      configure, test; file: open, download, etc.)
 *
 * Opens on right-click or ⋯ button click. Keyboard navigable.
 */

import { useEffect, useRef, useState } from 'react';
import type { VCardAction, VCardState } from '../../shared/vcard';
import { getActionsForCard } from '../../shared/vcard';

export interface VCardMenuProps {
  state: VCardState;
  onAction: (actionId: string) => void;
  trigger?: 'contextmenu' | 'button' | 'both';
  children?: React.ReactNode;
}

export function VCardMenu({ state, onAction, trigger = 'both', children }: VCardMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const actions = getActionsForCard(state);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(actions.length - 1, i + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const action = actions[selectedIdx];
        if (action && action.enabled) {
          onAction(action.id);
          setOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, actions, selectedIdx, onAction]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (trigger === 'button') return;
    e.preventDefault();
    e.stopPropagation();
    setPos({ x: e.clientX, y: e.clientY });
    setSelectedIdx(0);
    setOpen(true);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    if (trigger === 'contextmenu') return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.right - 200, y: rect.bottom + 4 });
    setSelectedIdx(0);
    setOpen((o) => !o);
  };

  return (
    <div onContextMenu={handleContextMenu} ref={ref} style={{ position: 'relative', display: 'contents' }}>
      {children}
      {(trigger === 'both' || trigger === 'button') && (
        <button
          onClick={handleButtonClick}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            padding: '0 4px',
            zIndex: 10,
            lineHeight: 1,
            fontFamily: 'inherit',
          }}
          title="vCard menu"
          aria-label="Node actions menu"
        >
          ⋯
        </button>
      )}
      {open && (
        <div
          role="menu"
          aria-label="Node actions"
          style={{
            position: 'fixed',
            top: Math.min(pos.y, window.innerHeight - actions.length * 28 - 16),
            left: Math.min(pos.x, window.innerWidth - 220),
            minWidth: 200,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            boxShadow: 'var(--shadow)',
            padding: 4,
            zIndex: 1300,
            fontFamily: 'ui-sans-serif, system-ui',
            maxHeight: 400,
            overflowY: 'auto',
          }}
        >
          {actions.map((action, i) => (
            <button
              key={action.id}
              role="menuitem"
              disabled={!action.enabled}
              onClick={() => {
                onAction(action.id);
                setOpen(false);
              }}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '5px 10px',
                border: 'none',
                background: i === selectedIdx && action.enabled ? 'var(--accent-subtle)' : 'transparent',
                color: action.enabled ? 'var(--text)' : 'var(--text-subtle)',
                cursor: action.enabled ? 'pointer' : 'default',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: 'inherit',
                textAlign: 'left',
                opacity: action.enabled ? 1 : 0.4,
              }}
            >
              <span style={{ width: 16, textAlign: 'center', fontSize: 13 }}>{action.icon}</span>
              <span style={{ flex: 1 }}>{action.label}</span>
              {action.shortcut && (
                <kbd style={{ fontSize: 9, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                  {action.shortcut}
                </kbd>
              )}
              {action.hasSubmenu && <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>›</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
