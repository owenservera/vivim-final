'use client';

import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Icon, type IconName } from './Icon';
import { useSessionState } from './SessionStateProvider';
import { PANEL_REGISTRY, CATEGORY_COLORS, type PanelType } from './TabConfig';
import { getPanelLoader } from './PanelRegistry';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// ── SlidePanel ────────────────────────────────────────────────────────────

interface SlidePanelProps {
  panelId: string;
  isOpen: boolean;
  onClose: () => void;
  position?: 'left' | 'right';
  width?: number;
  workspaceId: string;
  /** P0-3: MINI panels render as small floating cards, not full edge drawers */
  mini?: boolean;
}

export function SlidePanel({
  panelId,
  isOpen,
  onClose,
  position = 'right',
  width = 320,
  workspaceId,
  mini = false,
}: SlidePanelProps) {
  const { state, dispatch } = useSessionState();
  const tabConfig = PANEL_REGISTRY[panelId];
  const categoryColor = tabConfig ? CATEGORY_COLORS[tabConfig.category] : 'var(--accent)';
  const [PanelComponent, setPanelComponent] = useState<React.ComponentType<any> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Load panel component
  useEffect(() => {
    if (!isOpen) return;
    const loader = getPanelLoader(panelId);
    if (loader) {
      loader().then((m) => setPanelComponent(() => m.default)).catch(() => {});
    }
  }, [panelId, isOpen]);

  // R2-P1-2: Focus trap
  useEffect(() => {
    if (!isOpen) return;

    // Save previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the panel on open
    const timer = setTimeout(() => {
      panelRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(timer);
      // Restore previous focus on close
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  // R2-P1-2: Focus trap — trap Tab within panel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // R2-P1-1: Always render the DOM, use visibility + transform for animation
  if (!tabConfig) return null;

  const isVisible = isOpen;

  // P0-3: MINI panels render as small floating cards in bottom-right
  const miniWidth = 280;
  const miniStyle: React.CSSProperties = mini ? {
    position: 'fixed',
    bottom: 12,
    right: 12,
    top: 'auto',
    left: 'auto',
    width: miniWidth,
    height: 'auto',
    maxHeight: '60vh',
    borderRadius: 12,
    border: `1px solid var(--border)`,
    zIndex: 960,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--card)',
    boxShadow: isOpen ? '0 8px 32px rgba(0,0,0,0.16)' : 'none',
    transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.95)',
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s, visibility 0.2s',
    visibility: isOpen ? 'visible' : 'hidden',
    opacity: isOpen ? 1 : 0,
    pointerEvents: isOpen ? 'auto' : 'none',
    outline: 'none',
    overflow: 'hidden',
  } : {};

  // FULL/DRAWER panels: edge slide
  const fullStyle: React.CSSProperties = mini ? {} : {
    position: 'fixed',
    top: 48,
    bottom: 0,
    [position]: 0,
    width,
    zIndex: 960,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--card)',
    borderLeft: position === 'right' ? `3px solid ${categoryColor}` : 'none',
    borderRight: position === 'left' ? `3px solid ${categoryColor}` : 'none',
    boxShadow: isOpen ? '0 8px 32px rgba(0,0,0,0.12)' : 'none',
    transform: isOpen ? 'translateX(0)' : position === 'right' ? 'translateX(100%)' : 'translateX(-100%)',
    transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.25s',
    visibility: isOpen ? 'visible' : 'hidden',
    pointerEvents: isOpen ? 'auto' : 'none',
    outline: 'none',
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${tabConfig.label} panel`}
      aria-modal={false}
      tabIndex={-1}
      data-open={isOpen ? '' : undefined}
      data-mini={mini ? '' : undefined}
      style={mini ? miniStyle : fullStyle}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: mini ? 6 : 8,
          padding: mini ? '6px 10px' : '8px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
          flexShrink: 0,
        }}
      >
        <Icon name={tabConfig.icon as IconName} size={mini ? 12 : 14} />
        <span style={{ flex: 1, fontSize: mini ? 11 : 12, fontWeight: 600, color: 'var(--text)' }}>
          {tabConfig.label}
        </span>
        <button
          onClick={onClose}
          aria-label={`Close ${tabConfig.label} panel`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          <Icon name="close" size={12} />
        </button>
      </div>

      {/* Panel body — R2-P1-3: wrapped in error boundary */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {PanelComponent ? (
          <ErrorBoundary
            fallback={
              <div style={{ padding: 16, fontSize: 12, color: 'var(--destructive)' }}>
                Panel failed to render. Try refreshing.
              </div>
            }
          >
            <PanelComponent workspaceId={workspaceId} />
          </ErrorBoundary>
        ) : (
          <div style={{ padding: 16, fontSize: 11, color: 'var(--text-muted)' }}>Loading...</div>
        )}
      </div>
    </div>
  );
}
