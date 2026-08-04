'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export type SplitDirection = 'horizontal' | 'vertical';

export interface PanelSplitProps {
  direction?: SplitDirection;
  defaultSizes?: number[];
  minSizes?: number[];
  maxSizes?: number[];
  children: ReactNode[];
  /** Persist split positions to localStorage */
  storageKey?: string;
  /** Show resize handle tooltips */
  showTooltips?: boolean;
}

export function PanelSplit({
  direction = 'vertical',
  defaultSizes = [50, 50],
  minSizes = [10, 10],
  maxSizes,
  children,
  storageKey,
  showTooltips = false,
}: PanelSplitProps) {
  const [sizes, setSizes] = useState<number[]>(defaultSizes);
  const [draggingIndex, setDraggingIndex] = useState<number>(-1);
  const dragRef = useRef<{
    startX: number;
    startTop: number;
    startSizes: number[];
    totalSize: number;
  } | null>(null);

  const isHorizontal = direction === 'horizontal';

  // Load saved sizes from localStorage
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(`vivim:panelsplit:${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === children.length) {
          setSizes(parsed);
        }
      }
    } catch {}
  }, [storageKey, children.length]);

  // Save sizes to localStorage on change
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(`vivim:panelsplit:${storageKey}`, JSON.stringify(sizes));
    } catch {}
  }, [storageKey, sizes]);

  // Clamp sizes array to children length
  const clampedSizes = sizes.length !== children.length
    ? (children.length === 1 ? [100] : Array(children.length).fill(100 / children.length))
    : sizes;

  const handleResizeStart = useCallback((e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIndex(idx);

    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = e.currentTarget.parentElement?.parentElement?.getBoundingClientRect();

    const totalSize = containerRect
      ? (isHorizontal ? containerRect.width : containerRect.height)
      : 800;

    dragRef.current = {
      startX: e.clientX,
      startTop: e.clientY,
      startSizes: [...clampedSizes],
      totalSize: totalSize,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [clampedSizes, isHorizontal]);

  const handleResizeEnd = useCallback(() => {
    setDraggingIndex(-1);
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (draggingIndex === -1 || !dragRef.current) return;

    const handleMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const delta = isHorizontal
        ? e.clientX - drag.startX
        : e.clientY - drag.startTop;

      const deltaPercent = (delta / drag.totalSize) * 100;
      const newSizes = [...drag.startSizes];

      const prevIdx = draggingIndex - 1;
      const nextIdx = draggingIndex;

      const prevMin = minSizes[prevIdx] ?? 10;
      const nextMin = minSizes[nextIdx] ?? 10;
      const prevMax = maxSizes ? maxSizes[prevIdx] ?? 90 : 90;
      const nextMax = maxSizes ? maxSizes[nextIdx] ?? 90 : 90;

      newSizes[prevIdx] = Math.max(prevMin, Math.min(prevMax, drag.startSizes[prevIdx] + deltaPercent));
      newSizes[nextIdx] = drag.startSizes[prevIdx] + drag.startSizes[nextIdx] - newSizes[prevIdx];

      // Clamp next size
      newSizes[nextIdx] = Math.max(nextMin, Math.min(nextMax, newSizes[nextIdx]));
      newSizes[prevIdx] = drag.startSizes[prevIdx] + drag.startSizes[nextIdx] - newSizes[nextIdx];

      setSizes(newSizes);
    };

    const handleUp = (e: PointerEvent) => {
      (e.target as HTMLElement | null)?.releasePointerCapture(e.pointerId);
      handleResizeEnd();
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggingIndex, minSizes, maxSizes, isHorizontal, handleResizeEnd]);

  const renderSplitter = (idx: number) => (
    <div
      key={`splitter-${idx}`}
      onPointerDown={(e) => handleResizeStart(e, idx)}
      style={{
        flexShrink: 0,
        backgroundColor: 'var(--border)',
        position: 'relative',
        zIndex: 20,
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
        ...(isHorizontal
          ? { width: 4, margin: '0 -2px', borderRadius: 2 }
          : { height: 4, margin: '-2px 0', borderRadius: 2 }),
        ...(draggingIndex === idx ? { backgroundColor: 'var(--accent)' } : {}),
      }}
      role="separator"
      aria-label={`Resize ${isHorizontal ? 'columns' : 'rows'}`}
      aria-valuenow={100 - clampedSizes[idx - 1] - clampedSizes[idx]}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {showTooltips && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 9,
            color: 'var(--muted-foreground)',
            whiteSpace: 'nowrap',
            opacity: 1,
            pointerEvents: 'none',
          }}
        >
          Drag to resize
        </div>
      )}
      <Icon
        name="grip"
        size={8}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${isHorizontal ? 0 : 90}deg)`,
          color: draggingIndex === idx ? 'var(--accent-fg)' : 'var(--muted-foreground)',
          opacity: 0.6,
        }}
      />
    </div>
  );

  const validChildren = children.filter(c => c !== null && c !== undefined);

  const panes = validChildren.map((child, idx) => {
    const size = clampedSizes[idx] ?? (100 / validChildren.length);
    const min = minSizes[idx] ?? 10;
    const paneStyle: React.CSSProperties = {
      flex: `0 0 ${size}%`,
      minHeight: 0,
      minWidth: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: isHorizontal ? 'row' : 'column',
    };
    return (
      <div key={idx} style={paneStyle}>
        {child}
      </div>
    );
  });

  // Interleave splitters between panes
  const layout: ReactNode[] = [];
  panes.forEach((pane, idx) => {
    layout.push(pane);
    if (idx < panes.length - 1) {
      layout.push(renderSplitter(idx + 1));
    }
  });

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isHorizontal ? 'row' : 'column',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  };

  if (validChildren.length === 0) return null;
  if (validChildren.length === 1) return <div style={containerStyle}>{validChildren[0]}</div>;

  return (
    <div style={containerStyle} className="panel-split">
      {layout}
    </div>
  );
}

// Convenience: collapse/expand a pane
export function usePanelSplitControls(storageKey: string) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const togglePane = useCallback((idx: number) => {
    setCollapsed((prev) => {
      const next = { ...prev, [idx]: !prev[idx] };
      try {
        localStorage.setItem(`vivim:panelsplit:collapsed:${storageKey}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [storageKey]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`vivim:panelsplit:collapsed:${storageKey}`);
      if (saved) setCollapsed(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  return { collapsed, togglePane };
}
