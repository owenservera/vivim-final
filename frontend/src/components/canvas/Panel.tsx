'use client';

/**
 * components/canvas/Panel.tsx
 * --------------------------------------------------------------------
 * Flexible, dockable, resizable panel system.
 * Panels float over the canvas and can be:
 *   - Docked to any edge (left, right, top, bottom)
 *   - Resized by dragging edges
 *   - Minimized to an icon
 *   - Closed completely
 *
 * Panels remember their last position/size in localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

function viewportWidth(): number {
  if (typeof window === 'undefined') return 1200;
  return window.innerWidth;
}
function viewportHeight(): number {
  if (typeof window === 'undefined') return 800;
  return window.innerHeight;
}

export type PanelDock = 'left' | 'right' | 'top' | 'bottom' | 'float';
export type PanelSize = 'compact' | 'normal' | 'wide';

export interface PanelConfig {
  id: string;
  title: string;
  icon: IconName;
  defaultDock: PanelDock;
  defaultSize: PanelSize;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface PanelProps {
  config: PanelConfig;
  isOpen: boolean;
  onClose: () => void;
  onDockChange?: (dock: PanelDock) => void;
  children: React.ReactNode;
}

const SIZE_MAP: Record<PanelSize, { width: number; height: number }> = {
  compact: { width: 280, height: 400 },
  normal: { width: 320, height: 500 },
  wide: { width: 400, height: 600 },
};

const DOCK_ICONS: Record<PanelDock, IconName> = {
  left: 'panel-left',
  right: 'panel-right',
  top: 'panel-top',
  bottom: 'panel-bottom',
  float: 'move',
};

export function Panel({
  config,
  isOpen,
  onClose,
  onDockChange,
  children,
}: PanelProps) {
  const [dock, setDock] = useState<PanelDock>(config.defaultDock);
  const [size, setSize] = useState(SIZE_MAP[config.defaultSize]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number; origX: number; origY: number } | null>(null);

  // Load saved state
  useEffect(() => {
    const saved = localStorage.getItem(`vivim.panel.${config.id}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.dock) setDock(state.dock);
        if (state.size) setSize(state.size);
        if (state.position) setPosition(state.position);
        if (state.isMinimized) setIsMinimized(state.isMinimized);
      } catch {}
  // [audit] log the error with context here
    }
  }, [config.id]);

  // Save state on change
  useEffect(() => {
    localStorage.setItem(`vivim.panel.${config.id}`, JSON.stringify({
      dock, size, position, isMinimized,
    }));
  }, [config.id, dock, size, position, isMinimized]);

  // Calculate position based on dock
  const getDockPosition = useCallback(() => {
    switch (dock) {
      case 'left':
        return { x: 0, y: 48 }; // Below command bar
      case 'right':
        return { x: viewportWidth() - size.width, y: 48 };
      case 'top':
        return { x: (viewportWidth() - size.width) / 2, y: 48 };
      case 'bottom':
        return { x: (viewportWidth() - size.width) / 2, y: viewportHeight() - size.height };
      case 'float':
        return position;
      default:
        return { x: 0, y: 48 };
    }
  }, [dock, size, position]);

  const finalPosition = dock === 'float' ? position : getDockPosition();

  // Drag handling (for float mode and title bar)
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (dock !== 'float') {
      // Switch to float mode when dragging from docked
      setDock('float');
      onDockChange?.('float');
    }
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: finalPosition.x,
      origY: finalPosition.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [dock, finalPosition, onDockChange]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const newX = drag.origX + (e.clientX - drag.startX);
      const newY = drag.origY + (e.clientY - drag.startY);
      setPosition({ x: newX, y: newY });
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
  }, [isDragging]);

  // Resize handling
  const handleResizeStart = useCallback((edge: 'left' | 'right' | 'top' | 'bottom', e: React.PointerEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeEdge(edge);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: size.width,
      origH: size.height,
      origX: finalPosition.x,
      origY: finalPosition.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [size, finalPosition]);

  useEffect(() => {
    if (!isResizing || !resizeEdge) return;
    const onMove = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      const dx = e.clientX - resize.startX;
      const dy = e.clientY - resize.startY;

      let newWidth = resize.origW;
      let newHeight = resize.origH;
      let newX = resize.origX;
      let newY = resize.origY;

      switch (resizeEdge) {
        case 'right':
          newWidth = Math.max(config.minWidth ?? 200, Math.min(config.maxWidth ?? 600, resize.origW + dx));
          break;
        case 'left':
          newWidth = Math.max(config.minWidth ?? 200, Math.min(config.maxWidth ?? 600, resize.origW - dx));
          newX = resize.origX + (resize.origW - newWidth);
          break;
        case 'bottom':
          newHeight = Math.max(config.minHeight ?? 200, Math.min(config.maxHeight ?? 800, resize.origH + dy));
          break;
        case 'top':
          newHeight = Math.max(config.minHeight ?? 200, Math.min(config.maxHeight ?? 800, resize.origH - dy));
          newY = resize.origY + (resize.origH - newHeight);
          break;
      }

      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });
    };
    const onUp = () => {
      setIsResizing(false);
      setResizeEdge(null);
      resizeRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isResizing, resizeEdge, config.minWidth, config.maxWidth, config.minHeight, config.maxHeight]);

  // Dock cycle: left → right → float → left
  const cycleDock = useCallback(() => {
    const dockOrder: PanelDock[] = ['left', 'right', 'float'];
    const currentIdx = dockOrder.indexOf(dock);
    const nextDock = dockOrder[(currentIdx + 1) % dockOrder.length];
    setDock(nextDock);
    onDockChange?.(nextDock);
  }, [dock, onDockChange]);

  if (!isOpen) return null;

  // Minimized state - just show icon
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        title={config.title}
        style={{
          position: 'fixed',
          left: dock === 'right' ? viewportWidth() - 44 : 8,
          top: 56 + (dock === 'left' ? 0 : dock === 'right' ? 0 : 0),
          zIndex: 999,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >
        <Icon name={config.icon} size={16} />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${config.title} panel`}
      aria-modal={dock === 'float'}
      style={{
        position: 'fixed',
        left: finalPosition.x,
        top: finalPosition.y,
        width: size.width,
        height: size.height,
        zIndex: 998,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        resize: 'none', // We handle resize manually
      }}
    >
      {/* Title bar - draggable */}
      <div
        onPointerDown={handleDragStart}
        role="toolbar"
        aria-label={`${config.title} panel controls`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--secondary)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <Icon name={config.icon} size={12} className="text-muted-foreground" />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {config.title}
        </span>

        {/* Dock cycle button */}
        <button
          onClick={(e) => { e.stopPropagation(); cycleDock(); }}
          aria-label={`Change dock position (currently ${dock})`}
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
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          <Icon name={DOCK_ICONS[dock]} size={11} />
        </button>

        {/* Minimize button */}
        <button
          onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
          aria-label="Minimize panel"
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
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          <Icon name="minus" size={11} />
        </button>

        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label={`Close ${config.title} panel`}
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
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          <Icon name="x" size={11} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }} className="scrollbar-thin">
        {children}
      </div>

      {/* Resize handles */}
      <ResizeHandle edge="right" onResizeStart={handleResizeStart} />
      <ResizeHandle edge="bottom" onResizeStart={handleResizeStart} />
      <ResizeHandle edge="left" onResizeStart={handleResizeStart} />
      <ResizeHandle edge="top" onResizeStart={handleResizeStart} />
    </div>
  );
}

// Resize handle component
function ResizeHandle({
  edge,
  onResizeStart,
}: {
  edge: 'left' | 'right' | 'top' | 'bottom';
  onResizeStart: (edge: 'left' | 'right' | 'top' | 'bottom', e: React.PointerEvent) => void;
}) {
  const isVertical = edge === 'left' || edge === 'right';
  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    ...(isVertical
      ? {
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          ...(edge === 'left' ? { left: -3 } : { right: -3 }),
        }
      : {
          left: 0,
          right: 0,
          height: 6,
          cursor: 'row-resize',
          ...(edge === 'top' ? { top: -3 } : { bottom: -3 }),
        }),
  };

  return (
    <div
      onPointerDown={(e) => onResizeStart(edge, e)}
      style={style}
    />
  );
}
