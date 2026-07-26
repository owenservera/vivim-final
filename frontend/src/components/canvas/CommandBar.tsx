'use client';

/**
 * components/canvas/CommandBar.tsx
 * --------------------------------------------------------------------
 * Minimal floating command bar — the SINGLE entry point for all UI.
 * Canvas is king. This bar appears only when needed.
 *
 * Features:
 *   - Draggable to reposition
 *   - Auto-hides after inactivity (optional)
 *   - Cmd+K opens search, Cmd+. toggles panel dock
 *   - Minimal footprint: logo + search + menu button
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

export interface CommandBarProps {
  onOpenSearch: () => void;
  onTogglePanel: (panelId: string) => void;
  onOpenMenu: () => void;
  position?: { x: number; y: number };
  onPositionChange?: (pos: { x: number; y: number }) => void;
  autoHide?: boolean;
  className?: string;
}

export function CommandBar({
  onOpenSearch,
  onTogglePanel,
  onOpenMenu,
  position: externalPosition,
  onPositionChange,
  autoHide = false,
  className,
}: CommandBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [internalPos, setInternalPos] = useState({ x: 0, y: 12 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const pos = externalPosition ?? internalPos;

  // Drag handling
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // Don't drag on buttons
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const newX = drag.origX + (e.clientX - drag.startX);
      const newY = drag.origY + (e.clientY - drag.startY);
      // Constrain to viewport
      const maxX = window.innerWidth - 200;
      const maxY = window.innerHeight - 48;
      const constrained = {
        x: Math.max(0, Math.min(maxX, newX)),
        y: Math.max(0, Math.min(maxY, newY)),
      };
      setInternalPos(constrained);
      onPositionChange?.(constrained);
    };
    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDragging, onPositionChange]);

  // Auto-hide behavior
  const shouldShow = !autoHide || isHovered || isDragging;

  return (
    <div
      ref={barRef}
      className={className}
      onPointerDown={handlePointerDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '4px 6px',
        background: 'color-mix(in oklch, var(--card) 85%, transparent)',
        backdropFilter: 'blur(12px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        opacity: shouldShow ? 1 : 0,
        transform: shouldShow ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        pointerEvents: shouldShow ? 'auto' : 'none',
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 6px',
          cursor: 'default',
        }}
      >
        <Icon name="layers" size={14} className="text-primary" />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.02em' }}>Vivim</span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />

      {/* Search trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenSearch(); }}
        aria-label="Open search (Cmd+K)"
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          minHeight: 44,
          border: 'none',
          background: 'transparent',
          color: 'var(--muted-foreground)',
          borderRadius: 'calc(var(--radius) - 4px)',
          cursor: 'pointer',
          fontSize: 11,
          fontFamily: 'inherit',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Icon name="search" size={12} />
        <span>Search</span>
        <kbd style={{
          padding: '1px 4px',
          background: 'var(--muted)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
        }}>K</kbd>
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />

      {/* Quick panel toggles */}
      <PanelToggle icon="message-square" panelId="conversations" onToggle={onTogglePanel} />
      <PanelToggle icon="cpu" panelId="providers" onToggle={onTogglePanel} />
      <PanelToggle icon="settings" panelId="settings" onToggle={onTogglePanel} />

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />

      {/* Menu button */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenMenu(); }}
        aria-label="Open main menu"
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          border: 'none',
          background: 'transparent',
          color: 'var(--muted-foreground)',
          borderRadius: 'calc(var(--radius) - 4px)',
          cursor: 'pointer',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--muted)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Icon name="menu" size={14} />
      </button>
    </div>
  );
}

// Panel toggle button
function PanelToggle({
  icon,
  panelId,
  onToggle,
  active,
}: {
  icon: IconName;
  panelId: string;
  onToggle: (panelId: string) => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(panelId); }}
      aria-label={`${active ? 'Close' : 'Open'} ${panelId} panel`}
      aria-pressed={active}
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        border: 'none',
        background: active ? 'color-mix(in oklch, var(--ring) 12%, transparent)' : 'transparent',
        color: active ? 'var(--ring)' : 'var(--muted-foreground)',
        borderRadius: 'calc(var(--radius) - 4px)',
        cursor: 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--muted)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}
