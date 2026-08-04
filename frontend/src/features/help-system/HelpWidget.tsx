/**
 * HelpWidget.tsx
 * ---------------------------------------------------------------------------
 * Main floating help widget for Vivim. Opens with Ctrl+? or F1.
 *
 * Architecture:
 *   - Floating button (bottom-right, ? icon)
 *   - Animated panel (scale + fade, 200ms)
 *   - Tabbed surface: Search | Chat | Tours | Actions
 *   - Keyboard: Ctrl+? or F1 to toggle, Escape to close
 *   - ARIA: role="dialog", aria-label="Help center"
 *
 * All I/O routed through UnifiedIO (Invariant 5).
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import { dispatchBehavior } from '@/shared/dispatch-behavior';
import { HelpPanel, type HelpTab } from './HelpPanel';
import { SearchBar } from './SearchBar';
import { AIChat } from './AIChat';
import { QuickActions } from './QuickActions';
import { useCapabilitySearch } from './useCapabilitySearch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HelpWidgetProps {
  userId?: string;
  onAction?: (command: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HelpWidget({ userId, onAction }: HelpWidgetProps) {
  const io = useIO();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HelpTab>('search');
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { search, results, loading, stats } = useCapabilitySearch(io);

  // Keyboard shortcut: Ctrl+? (Shift+/) to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+? (Shift+/) — standard help shortcut
      if (e.key === '?' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Also support F1 as help shortcut
      if (e.key === 'F1') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus trap when open
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector<HTMLElement>(
        'input, button, [tabindex]'
      );
      firstFocusable?.focus();
    }
  }, [isOpen, activeTab]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleResultClick = useCallback(
    (result: { id: string; type: string; slug?: string; title: string }) => {
      // Navigate to capability or help location
      console.log('[Help] Navigate to:', result.type, result.slug || result.id);
      if (result.slug) {
        onAction?.(`execute:${result.slug}`);
      } else {
        onAction?.(`help:${result.id}`);
      }
    },
    [onAction]
  );

  const handleAskAI = useCallback(
    (query: string) => {
      setActiveTab('chat');
      // Pass query to AIChat (placeholder)
      console.log('[Help] Ask AI:', query);
    },
    []
  );

  return (
    <>
      {/* Floating button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen((prev) => !prev)}
        style={styles.floatingButton}
        aria-label="Open help center (Ctrl+? or F1)"
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={styles.buttonIcon}>
          <circle cx={12} cy={12} r={10} />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      {/* Panel overlay */}
      {isOpen && <div style={styles.overlay} />}

      {/* Help panel */}
      <div
        ref={panelRef}
        style={{
          ...styles.panel,
          ...(isOpen ? styles.panelOpen : styles.panelClosed),
        }}
        role="dialog"
        aria-label="Help center"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Help Center</h2>
          <button
            onClick={() => setIsOpen(false)}
            style={styles.closeButton}
            aria-label="Close help center"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={styles.closeIcon}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabbed content */}
        <HelpPanel defaultTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === 'search' && (
            <SearchBar
              searchFn={search}
              loading={loading}
              onResultClick={handleResultClick}
              onAskAI={handleAskAI}
            />
          )}
          {activeTab === 'chat' && (
            <AIChat
              io={io}
              onAction={onAction}
              onExecute={(capability, params) => {
                console.log('[Help] Execute:', capability, params);
                onAction?.(`execute:${capability}`);
              }}
            />
          )}
          {activeTab === 'tours' && (
            <div style={styles.placeholder}>
              <p>Interactive Tours — Coming in Phase 2</p>
            </div>
          )}
          {activeTab === 'actions' && (
            <QuickActions
              onExecute={async (action) => {
                if (action.mode === 'guide') {
                  setActiveTab('chat');
                } else if (action.capability) {
                  // Route through dispatchBehavior → UnifiedIO → /api/interpret
                  try {
                    await dispatchBehavior('execute', action.capability, null, io);
                    onAction?.(`execute:${action.capability}`);
                  } catch {
                    console.error('[Help] Execute failed:', action.capability);
                  }
                }
              }}
            />
          )}
        </HelpPanel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  floatingButton: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: 'var(--color-info)',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
    transition: 'transform 200ms, box-shadow 200ms',
    zIndex: 1000,
  },
  buttonIcon: {
    width: 24,
    height: 24,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 999,
  },
  panel: {
    position: 'fixed',
    bottom: 84,
    right: 24,
    width: 420,
    maxHeight: 'calc(100vh - 120px)',
    backgroundColor: 'var(--bg, #ffffff)',
    border: '1px solid var(--border, #e5e7eb)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'opacity 200ms, transform 200ms',
    zIndex: 1001,
  },
  panelOpen: {
    opacity: 1,
    transform: 'scale(1) translateY(0)',
  },
  panelClosed: {
    opacity: 0,
    transform: 'scale(0.95) translateY(8px)',
    pointerEvents: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border, #e5e7eb)',
  },
  title: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text, #111827)',
  },
  closeButton: {
    padding: 4,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    borderRadius: 4,
  },
  closeIcon: {
    width: 18,
    height: 18,
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  stats: {
    fontSize: 12,
    color: 'var(--text-subtle)',
    marginTop: 8,
  },
};
