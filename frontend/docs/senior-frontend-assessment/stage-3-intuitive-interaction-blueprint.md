# Stage 3: Intuitive UX, Accessibility & Interaction Blueprint

**Location**: `frontend/docs/senior-frontend-assessment/stage-3-intuitive-interaction-blueprint.md`  
**Focus**: Visual design system, ARIA accessibility focus traps, QuickActionDock, touch navigation, and stream feedback pills.

---

## 1. Accessibility (a11y) & Focus Trap Specifications

### Modal Dialog Traps (`aria-modal="true"`)
To comply with WCAG 2.1 AA standards, all floating modal overlays (`MainMenu`, `ThemeSettings`, `DevConsole`, `CommandPalette`) must enforce focus traps and close on `Escape`.

```tsx
import { useEffect, useRef } from 'react';

export function ModalFocusTrap({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Focus first focusable child on mount
    const focusables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length > 0) focusables[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs"
    >
      {children}
    </div>
  );
}
```

---

## 2. Floating Quick Action Dock Component

### Target File: `[NEW] frontend/src/components/canvas/QuickActionDock.tsx`

```tsx
'use client';

import React from 'react';
import { Icon } from './Icon';

export interface QuickActionDockProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onToggleGrid?: () => void;
  onToggleDevConsole: () => void;
  zoomLevel: number;
}

export function QuickActionDock({
  onZoomIn,
  onZoomOut,
  onResetView,
  onToggleGrid,
  onToggleDevConsole,
  zoomLevel,
}: QuickActionDockProps) {
  return (
    <div
      aria-label="Canvas Quick Actions"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-panel shadow-xl"
    >
      <button
        type="button"
        onClick={onZoomOut}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
        title="Zoom Out (-)"
        aria-label="Zoom Out"
      >
        <Icon name="minus" className="w-4 h-4" />
      </button>

      <button
        type="button"
        onClick={onResetView}
        className="px-2 py-1 text-xs font-mono text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/50 transition-colors"
        title="Reset Zoom (100%)"
        aria-label="Reset View to 100%"
      >
        {Math.round(zoomLevel * 100)}%
      </button>

      <button
        type="button"
        onClick={onZoomIn}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        <Icon name="plus" className="w-4 h-4" />
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      {onToggleGrid && (
        <button
          type="button"
          onClick={onToggleGrid}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
          title="Toggle Grid"
          aria-label="Toggle Grid"
        >
          <Icon name="grid" className="w-4 h-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onToggleDevConsole}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted/50 transition-colors"
        title="Dev Console (Cmd+`)"
        aria-label="Toggle Developer Console"
      >
        <Icon name="terminal" className="w-4 h-4" />
      </button>
    </div>
  );
}
```

---

## 3. Streaming Status & Diagnostic Feedback Pill

### Target File: `[NEW] frontend/src/components/canvas/StreamStatusPill.tsx`

```tsx
'use client';

import React from 'react';
import { Spinner } from './Spinner';

export interface StreamStatusPillProps {
  isStreaming: boolean;
  providerId?: string;
  tokenCount?: number;
  error?: string | null;
}

export function StreamStatusPill({ isStreaming, providerId, tokenCount = 0, error }: StreamStatusPillProps) {
  if (!isStreaming && !error) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full glass-pill text-xs font-medium border shadow-lg transition-all animate-in fade-in slide-in-from-top-2"
    >
      {error ? (
        <>
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-destructive font-semibold">Error: {error}</span>
        </>
      ) : (
        <>
          <Spinner className="w-3.5 h-3.5 text-primary" />
          <span className="text-foreground capitalize">{providerId ?? 'Provider'} streaming...</span>
          {tokenCount > 0 && <span className="text-muted-foreground font-mono text-[10px]">({tokenCount} tokens)</span>}
        </>
      )}
    </div>
  );
}
```

---

## Next Stage
Proceed to [Stage 4: Capabilities Preservation & Future Roadmap](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/docs/senior-frontend-assessment/stage-4-capabilities-and-future-roadmap.md).
