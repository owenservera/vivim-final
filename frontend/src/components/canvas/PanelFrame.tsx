'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { CATEGORY_COLORS, PANEL_REGISTRY, type PanelDock, type PanelSize, type TabCategory } from './TabConfig';

export interface PanelFrameProps {
  panelId: string;
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  /** Dock position — overrides default from PANEL_REGISTRY */
  dock?: PanelDock;
  /** Panel size — overrides default from PANEL_REGISTRY */
  size?: PanelSize;
  /** Mini mode renders a floating card instead of edge panel */
  mini?: boolean;
  /** Allow user to resize panel */
  resizable?: boolean;
  /** Allow user to dock cycle (left/right/float) */
  dockable?: boolean;
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

const STORAGE_PREFIX = 'vivim.panel-frame.';

export function PanelFrame({
  panelId,
  isOpen,
  onClose,
  children,
  dock: dockProp,
  size: sizeProp,
  mini = false,
  resizable = true,
  dockable = true,
}: PanelFrameProps) {
  const config = PANEL_REGISTRY[panelId];
  const categoryColor = config ? CATEGORY_COLORS[config.category] : 'var(--accent)';

  const defaultDock = config?.defaultDock ?? 'right';
  const defaultSize = config?.defaultSize ?? 'normal';

  const [dock, setDock] = useState<PanelDock>(dockProp ?? defaultDock);
  const [size, setSize] = useState(SIZE_MAP[sizeProp ?? defaultSize]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{
    startX: number; startY: number; origW: number; origH: number; origX: number; origY: number;
  } | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}${panelId}`);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.dock) setDock(state.dock);
        if (state.size) setSize({ width: state.size.width, height: state.size.height });
        if (state.position) setPosition(state.position);
        if (state.isMinimized) setIsMinimized(state.isMinimized);
      } catch {}
    }
  }, [panelId]);

  // Save state on change
  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}${panelId}`, JSON.stringify({
      dock, size, position, isMinimized,
    }));
  }, [panelId, dock, size, position, isMinimized]);

  // Sync dock from prop when it changes externally
  useEffect(() => {
    if (dockProp) setDock(dockProp);
  }, [dockProp]);

  // Focus trap + Escape close
  useEffect(() => {
    if (!isOpen) return;

    // Save previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the panel on open
    const timer = setTimeout(() => {
      panelRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }

      // Focus trap: Tab / Shift+Tab
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;

        const focusable = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      // Restore previous focus
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  // Drag handling (float mode)
  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (dock !== 'float') {
      setDock('float');
    }
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [dock, position]);

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
    e.preventDefault();
    setIsResizing(true);
    setResizeEdge(edge);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: size.width,
      origH: size.height,
      origX: position.x,
      origY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [size, position]);

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
          newWidth = Math.max(200, Math.min(600, resize.origW + dx));
          break;
        case 'left':
          newWidth = Math.max(200, Math.min(600, resize.origW - dx));
          newX = resize.origX + (resize.origW - newWidth);
          break;
        case 'bottom':
          newHeight = Math.max(200, Math.min(800, resize.origH + dy));
          break;
        case 'top':
          newHeight = Math.max(200, Math.min(800, resize.origH - dy));
          newY = resize.origY + (resize.origH - newHeight);
          break;
      }

      setSize({ width: newWidth, height: newHeight });
      if (dock === 'float') {
        setPosition({ x: newX, y: newY });
      }
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
  }, [isResizing, resizeEdge, dock, position]);

  // Dock cycle: left → right → float → left
  const cycleDock = useCallback(() => {
    const dockOrder: PanelDock[] = ['left', 'right', 'float'];
    const currentIdx = dockOrder.indexOf(dock);
    const nextDock = dockOrder[(currentIdx + 1) % dockOrder.length];
    setDock(nextDock);
  }, [dock]);

  // Viewport dimensions
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  useEffect(() => {
    const onResize = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Calculate position based on dock
  const getDockPosition = useCallback(() => {
    switch (dock) {
      case 'left':
        return { x: 0, y: 48 };
      case 'right':
        return { x: vw - size.width, y: 48 };
      case 'top':
        return { x: (vw - size.width) / 2, y: 48 };
      case 'bottom':
        return { x: (vw - size.width) / 2, y: vh - size.height };
      case 'float':
        return position;
      default:
        return { x: 0, y: 48 };
    }
  }, [dock, size, position, vw, vh]);

  const finalPosition = dock === 'float' ? position : getDockPosition();

  if (!isOpen) return null;

  // Minimized state - just show icon button
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        title={config?.label ?? panelId}
        style={{
          position: 'fixed',
          left: dock === 'right' ? vw - 44 : 8,
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
        <Icon name={config ? config.icon as IconName : 'panel-right'} size={16} />
      </button>
    );
  }

  const isMini = mini || config?.panelType === 'mini';
  const panelStyle: React.CSSProperties = isMini
    ? {
        position: 'fixed',
        bottom: 12,
        right: 12,
        top: 'auto',
        left: 'auto',
        width: 280,
        height: 'auto',
        maxHeight: '60vh',
        borderRadius: 12,
        border: '1px solid var(--border)',
        zIndex: 960,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
        outline: 'none',
        overflow: 'hidden',
      }
    : {
        position: 'fixed',
        left: finalPosition.x,
        top: finalPosition.y,
        width: size.width,
        height: size.height,
        zIndex: 998,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--card)',
        border: `1px solid var(--border)`,
        borderRadius: dock === 'float' ? 'var(--radius)' : 0,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        resize: 'none',
      };

  if (dock !== 'float' && !isMini) {
    (panelStyle as Record<string, unknown>).borderLeft = dock === 'left' ? `3px solid ${categoryColor}` : 'none';
    (panelStyle as Record<string, unknown>).borderRight = dock === 'right' ? `3px solid ${categoryColor}` : 'none';
    (panelStyle as Record<string, unknown>).borderTop = dock === 'top' ? `3px solid ${categoryColor}` : 'none';
    (panelStyle as Record<string, unknown>).borderBottom = dock === 'bottom' ? `3px solid ${categoryColor}` : 'none';
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${config?.label ?? panelId} panel`}
      aria-modal={dock === 'float'}
      tabIndex={-1}
      style={panelStyle}
    >
      {/* Title bar — draggable in float mode */}
      <div
        onPointerDown={dock === 'float' ? handleDragStart : undefined}
        role={dock === 'float' ? 'toolbar' : undefined}
        aria-label={dock === 'float' ? `${config?.label ?? panelId} panel controls` : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: isMini ? '6px 10px' : '6px 8px',
          borderBottom: '1px solid var(--border)',
          background: isMini ? 'var(--card)' : 'var(--secondary)',
          cursor: dock === 'float' ? (isDragging ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {!isMini && config && <Icon name={config.icon as IconName} size={12} className="text-muted-foreground" />}
        <span style={{
          flex: 1,
          fontSize: isMini ? 11 : 12,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {config?.label ?? panelId}
        </span>

        {dockable && !isMini && (
          <button
            onClick={(e) => { e.stopPropagation(); cycleDock(); }}
            aria-label={`Change dock position (currently ${dock})`}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: 'none',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            <Icon name={DOCK_ICONS[dock]} size={11} />
          </button>
        )}

        {!isMini && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
            aria-label="Minimize panel"
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: 'none',
              background: 'transparent',
              color: 'var(--muted-foreground)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            <Icon name="minus" size={11} />
          </button>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label={`Close ${config?.label ?? panelId} panel`}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
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

      {/* Resize handles (float mode only) */}
      {resizable && dock === 'float' && !isMini && (
        <>
          <ResizeHandle edge="right" onResizeStart={handleResizeStart} />
          <ResizeHandle edge="bottom" onResizeStart={handleResizeStart} />
          <ResizeHandle edge="left" onResizeStart={handleResizeStart} />
          <ResizeHandle edge="top" onResizeStart={handleResizeStart} />
        </>
      )}
    </div>
  );
}

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

  return <div onPointerDown={(e) => onResizeStart(edge, e)} style={style} />;
}
