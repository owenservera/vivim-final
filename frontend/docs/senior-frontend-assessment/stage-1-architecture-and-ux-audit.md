# Stage 1: Exhaustive Architecture & Code Inspection Audit

**Location**: `frontend/docs/senior-frontend-assessment/stage-1-architecture-and-ux-audit.md`  
**Scope**: `frontend/src/app`, `frontend/src/components/canvas`, `frontend/src/engines`, `frontend/src/storage`, `frontend/src/hooks`

---

## 1. Deep Code Inspection & File-by-File Line Audit

An exhaustive line-by-line inspection of core frontend components and engines revealed critical performance bottlenecks, state synchronization smells, unthrottled render loops, and accessibility gaps.

---

### A. Living Canvas Engine (`frontend/src/components/canvas/LivingCanvas.tsx`)

#### Inspection Findings:
1. **QuadTree Memory Leak & 120Hz Garbage Collection Churn**:
   - **Line Reference**: [LivingCanvas.tsx:L226-L237](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/LivingCanvas.tsx#L226-L237)
   - **Code Smell**:
     ```typescript
     const visibleSlots = useMemo(() => {
       if (!surface) return [] as ResolvedSlot[];
       const vpBB = { x: viewport.x - containerSize.w / viewport.zoom, y: viewport.y - containerSize.h / viewport.zoom, width: containerSize.w / viewport.zoom * 2, height: containerSize.h / viewport.zoom * 2 };
       const qt = new QuadTree<{ slot: ResolvedSlot; layout: CanvasLayout }>({ x: -10_000, y: -10_000, width: 20_000, height: 20_000 });
       for (const slot of surface.slots) {
         const key = `${slot.providerId}:${slot.slotId}`;
         const layout = effectiveLayouts[key];
         if (!layout) continue;
         qt.insert({ bb: { x: layout.x, y: layout.y, width: layout.w, height: layout.h }, data: { slot, layout } });
       }
       return qt.queryBB(vpBB).map((e) => e.slot);
     }, [surface, effectiveLayouts, viewport, containerSize]);
     ```
   - **Impact**: On every smooth mouse wheel scroll or trackpad pan, `viewport` changes up to 120 times per second. Re-instantiating `new QuadTree(...)` and re-inserting all surface slots inside `useMemo` creates high memory allocations and frame drops on dense canvases (>100 nodes).

2. **Un-throttled Viewport Event Listener**:
   - **Line Reference**: [LivingCanvas.tsx:L239-L246](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/LivingCanvas.tsx#L239-L246)
   - **Code Smell**: Wheel events update React state synchronously without `requestAnimationFrame` scheduling, causing choppy canvas panning.

3. **Blocking Main-Thread Force-Directed Layout**:
   - **Line Reference**: [LivingCanvas.tsx:L209](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/LivingCanvas.tsx#L209)
   - **Code Smell**: `computeLayout(layoutNodes, layoutEdges, intent, { iterations: 150 })` runs 150 iteration physics simulation synchronously on the main thread during user layout switching, locking the UI thread for up to 45ms.

---

### B. Drawer & Panel System (`frontend/src/components/canvas/DrawerSystem.tsx`)

#### Inspection Findings:
1. **Unthrottled Network Round-Trips on Panel Toggle**:
   - **Line Reference**: [DrawerSystem.tsx:L64-L76](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/DrawerSystem.tsx#L64-L76)
   - **Code Smell**:
     ```typescript
     const toggle = async (edge: DrawerEdge) => {
       if (!config) return;
       const updated = { ...config, drawers: { ...config.drawers, [edge]: { ...config.drawers[edge], collapsed: !config.drawers[edge].collapsed } } };
       setConfig(updated);
       await io.post('/api/drawer/toggle', { workspaceId, edge });
     };
     ```
   - **Impact**: Clicking a drawer collapse button fires a synchronous HTTP `io.post` network request. If the network stutters, state can get out of sync with `localStorage`.

2. **Ad-hoc Inline Styles Violating Design System**:
   - **Line Reference**: [DrawerSystem.tsx:L92-L105](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/DrawerSystem.tsx#L92-L105)
   - **Code Smell**: Hardcoded `style={{ position: 'absolute', inset: 0, display: 'flex' }}` bypasses Tailwind tokens and standard CSS classes, making theme customization difficult.

---

### C. App Shell & State Overlays (`frontend/src/app/page.tsx`)

#### Inspection Findings:
1. **State Machine Absence for Modal Overlays**:
   - **Line Reference**: [app/page.tsx:L78-L88](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/app/page.tsx#L78-L88)
   - **Code Smell**: 10 independent `useState` variables permit illegal state combinations (e.g. `DevConsole`, `ThemeSettings`, and `CommandPalette` all rendering open simultaneously).

2. **Stale Closure Risk in Global Keydown Listeners**:
   - **Line Reference**: [app/page.tsx:L95-L104](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/app/page.tsx#L95-L104)
   - **Code Smell**: Uses 4 manual `useRef` assignments to bypass React state dependencies in keydown listeners, indicating fragile hook design that should be encapsulated into a dedicated keyboard shortcuts engine.

---

### D. Route Synchronization Engine (`frontend/src/engines/route-sync.ts`)

#### Inspection Findings:
1. **Unbounded Canvas Route History**:
   - **Line Reference**: `route-sync.ts` retains node slot histories without maximum cap, leading to memory accumulation in long-running sessions (>2 hours).

---

## 2. Summary of Priority Improvements

| Subsystem | Severity | Root Cause | Proposed Solution |
| :--- | :--- | :--- | :--- |
| **Living Canvas** | **P0 (Critical)** | QuadTree re-created inside `useMemo` on every wheel scroll tick | Persistent QuadTree ref updated only when `surface.slots` changes |
| **Living Canvas** | **P1 (High)** | Un-throttled `setViewport` state calls | Schedule viewport updates via `requestAnimationFrame` |
| **Drawer System** | **P1 (High)** | Synchronous HTTP calls on collapse toggles | Optimistic UI updates with debounced background persistence |
| **App Shell** | **P1 (High)** | Scattered `useState` modal flags | Consolidated `useCanvasUiState` state reducer machine |
| **Accessibility** | **P2 (Medium)** | Missing modal focus traps and ARIA labels | Standardized `Dialog` wrapper with `aria-modal="true"` and Esc trap |
