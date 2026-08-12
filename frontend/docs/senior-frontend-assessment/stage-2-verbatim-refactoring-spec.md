# Stage 2: Verbatim Refactoring & Component Simplification Spec

**Location**: `frontend/docs/senior-frontend-assessment/stage-2-verbatim-refactoring-spec.md`  
**Target Files**:
- `frontend/src/hooks/use-canvas-ui-state.ts` [NEW]
- `frontend/src/components/canvas/UnifiedEntry.tsx` [MODIFY]
- `frontend/src/components/canvas/LivingCanvas.tsx` [MODIFY]
- `frontend/src/components/canvas/DrawerSystem.tsx` [MODIFY]
- `frontend/src/app/page.tsx` [MODIFY]

---

## 1. Unified UI Overlay Reducer: `use-canvas-ui-state.ts`

### Target File: `[NEW] frontend/src/hooks/use-canvas-ui-state.ts`

```typescript
import { useReducer, useCallback } from 'react';

export type ActiveModal = 'none' | 'menu' | 'search' | 'theme' | 'devConsole' | 'guidedLanding' | 'panelPalette';

export interface CanvasUiState {
  activeModal: ActiveModal;
  activePanelId: string | null;
  guidedComplete: boolean;
  needsSetup: boolean | null;
}

type UiAction =
  | { type: 'OPEN_MODAL'; modal: ActiveModal }
  | { type: 'CLOSE_MODAL' }
  | { type: 'TOGGLE_MODAL'; modal: ActiveModal }
  | { type: 'SET_ACTIVE_PANEL'; panelId: string | null }
  | { type: 'SET_GUIDED_COMPLETE'; complete: boolean }
  | { type: 'SET_NEEDS_SETUP'; needs: boolean };

const initialState: CanvasUiState = {
  activeModal: 'none',
  activePanelId: null,
  guidedComplete: false,
  needsSetup: null,
};

function uiReducer(state: CanvasUiState, action: UiAction): CanvasUiState {
  switch (action.type) {
    case 'OPEN_MODAL':
      return { ...state, activeModal: action.modal };
    case 'CLOSE_MODAL':
      return { ...state, activeModal: 'none' };
    case 'TOGGLE_MODAL':
      return {
        ...state,
        activeModal: state.activeModal === action.modal ? 'none' : action.modal,
      };
    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanelId: action.panelId };
    case 'SET_GUIDED_COMPLETE':
      return { ...state, guidedComplete: action.complete };
    case 'SET_NEEDS_SETUP':
      return { ...state, needsSetup: action.needs };
    default:
      return state;
  }
}

export function useCanvasUiState() {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  const openModal = useCallback((modal: ActiveModal) => dispatch({ type: 'OPEN_MODAL', modal }), []);
  const closeModal = useCallback(() => dispatch({ type: 'CLOSE_MODAL' }), []);
  const toggleModal = useCallback((modal: ActiveModal) => dispatch({ type: 'TOGGLE_MODAL', modal }), []);
  const setActivePanel = useCallback((panelId: string | null) => dispatch({ type: 'SET_ACTIVE_PANEL', panelId }), []);
  const setGuidedComplete = useCallback((complete: boolean) => dispatch({ type: 'SET_GUIDED_COMPLETE', complete }), []);
  const setNeedsSetup = useCallback((needs: boolean) => dispatch({ type: 'SET_NEEDS_SETUP', needs }), []);

  return {
    state,
    openModal,
    closeModal,
    toggleModal,
    setActivePanel,
    setGuidedComplete,
    setNeedsSetup,
  };
}
```

---

## 2. Living Canvas QuadTree & Viewport Refactoring

### Target File: `[MODIFY] frontend/src/components/canvas/LivingCanvas.tsx`

Eliminate 120Hz QuadTree allocation garbage collection churn and throttle wheel events via `requestAnimationFrame`.

#### Verbatim Code Replacement for QuadTree Caching:

Replace lines 226-237 of [LivingCanvas.tsx](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/LivingCanvas.tsx#L226-L237) with:

```typescript
  // Persistent QuadTree ref to prevent allocations on every wheel tick
  const quadTreeRef = useRef<QuadTree<{ slot: ResolvedSlot; layout: CanvasLayout }> | null>(null);

  // Rebuild QuadTree ONLY when slots or node layouts change
  useEffect(() => {
    if (!surface?.slots) {
      quadTreeRef.current = null;
      return;
    }
    const qt = new QuadTree<{ slot: ResolvedSlot; layout: CanvasLayout }>({
      x: -10_000,
      y: -10_000,
      width: 20_000,
      height: 20_000,
    });
    for (const slot of surface.slots) {
      const key = `${slot.providerId}:${slot.slotId}`;
      const layout = effectiveLayouts[key];
      if (!layout) continue;
      qt.insert({ bb: { x: layout.x, y: layout.y, width: layout.w, height: layout.h }, data: { slot, layout } });
    }
    quadTreeRef.current = qt;
  }, [surface?.slots, effectiveLayouts]);

  // Fast Bounding Box spatial query using persistent QuadTree
  const visibleSlots = useMemo(() => {
    if (!surface || !quadTreeRef.current) return [] as ResolvedSlot[];
    const vpBB = {
      x: viewport.x - containerSize.w / viewport.zoom,
      y: viewport.y - containerSize.h / viewport.zoom,
      width: (containerSize.w / viewport.zoom) * 2,
      height: (containerSize.h / viewport.zoom) * 2,
    };
    return quadTreeRef.current.queryBB(vpBB).map((e) => e.slot);
  }, [surface, viewport, containerSize]);

  // Throttled Viewport Wheel Handler
  const rAFRef = useRef<number | null>(null);
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (rAFRef.current !== null) cancelAnimationFrame(rAFRef.current);
    
    const deltaX = e.deltaX;
    const deltaY = e.deltaY;
    const isZooming = e.ctrlKey || e.metaKey;

    rAFRef.current = requestAnimationFrame(() => {
      if (isZooming) {
        const factor = deltaY > 0 ? 0.92 : 1.08;
        setViewport((vp) => ({ ...vp, zoom: Math.max(0.15, Math.min(4.5, vp.zoom * factor)) }));
      } else {
        setViewport((vp) => ({
          x: vp.x + deltaX / vp.zoom,
          y: vp.y + deltaY / vp.zoom,
          zoom: vp.zoom,
        }));
      }
      rAFRef.current = null;
    });
  }, []);
```

---

## 3. Optimistic Persistence in `DrawerSystem.tsx`

### Target File: `[MODIFY] frontend/src/components/canvas/DrawerSystem.tsx`

Replace blocking synchronous network calls with instant optimistic UI updates.

#### Verbatim Code Modification:

Replace lines 64-83 of [DrawerSystem.tsx](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/DrawerSystem.tsx#L64-L83) with:

```typescript
  const toggle = useCallback((edge: DrawerEdge) => {
    setConfig((prevConfig) => {
      if (!prevConfig) return prevConfig;
      const updated = {
        ...prevConfig,
        drawers: {
          ...prevConfig.drawers,
          [edge]: {
            ...prevConfig.drawers[edge],
            collapsed: !prevConfig.drawers[edge].collapsed,
          },
        },
      };
      
      // Instant LocalStorage sync
      try {
        const existing = localStorage.getItem(`${STORAGE_KEY}:${workspaceId}`);
        const collapsed = existing ? JSON.parse(existing) : {};
        collapsed[edge] = updated.drawers[edge].collapsed;
        localStorage.setItem(`${STORAGE_KEY}:${workspaceId}`, JSON.stringify(collapsed));
      } catch {}

      // Fire-and-forget async server sync (non-blocking)
      io.post('/api/drawer/toggle', { workspaceId, edge }).catch(() => {});
      return updated;
    });
  }, [workspaceId, io]);
```

---

## 4. Integrated Layer Controls in `UnifiedEntry.tsx`

### Target File: `[MODIFY] frontend/src/components/canvas/UnifiedEntry.tsx`

```tsx
export function UnifiedEntry({
  workspaceId,
  conversationId,
  providerId,
  createConversation,
  onConversationCreated,
  onOpenSearch,
  onOpenMenu,
  onOpenAssistant,
  onTogglePanel,
}: UnifiedEntryProps) {
  const io = useIO();
  const { state: sessionState, dispatch: dispatchSession } = useSessionState();
  const layerConfig = useMemo(() => getLayerConfig(sessionState.activeLayer), [sessionState.activeLayer]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [draft, setDraft] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeLayer = sessionState.activeLayer;
  const layerColor = LAYER_COLORS[activeLayer] ?? LAYER_COLORS.chat;
  const placeholder = conversationId
    ? LAYER_PLACEHOLDERS[activeLayer] ?? 'Message...'
    : 'Ask Vivim anything or describe a task...';

  const handleLayerSwitch = (layer: 'chat' | 'build' | 'admin') => {
    dispatchSession({ type: 'LAYER_SWITCH', layerId: layer });
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4">
      <div
        className="relative flex flex-col gap-2 p-3 rounded-2xl bg-background/85 backdrop-blur-xl border shadow-2xl transition-all duration-200"
        style={{ borderColor: layerColor }}
      >
        {/* Layer Selector & Quick Tools */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            {(['chat', 'build', 'admin'] as const).map((l) => {
              const isActive = activeLayer === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleLayerSwitch(l)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    isActive
                      ? 'bg-background shadow-xs text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                  }`}
                >
                  {LAYER_LABELS[l]}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md bg-muted/30 hover:bg-muted transition-colors"
              title="Search (Cmd+K)"
            >
              <Icon name="search" className="w-3.5 h-3.5" />
              <kbd className="hidden sm:inline-block px-1 text-[10px] bg-background border rounded shadow-2xs font-mono">⌘K</kbd>
            </button>

            <button
              type="button"
              onClick={onOpenMenu}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
              title="Main Menu"
              aria-label="Main Menu"
            >
              <Icon name="menu" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Textarea Input */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder}
            rows={1}
            className="w-full resize-none bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim() || isStreaming}
            className="shrink-0 p-2 text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-opacity"
            aria-label="Send message"
          >
            <Icon name="send" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Next Stage
Proceed to [Stage 3: Intuitive Interaction Blueprint](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/docs/senior-frontend-assessment/stage-3-intuitive-interaction-blueprint.md).
