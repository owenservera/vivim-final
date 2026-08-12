# Stage 1: Wave 2 Programmatic Deep Code Inspection Audit

**Location**: `frontend/docs/senior-frontend-assessment-wave2/stage-1-engines-and-sdk-audit.md`  
**Scope**: `frontend/src/sdk`, `frontend/src/engines`, `frontend/src/components/canvas`, `frontend/src/features`

---

## 1. Programmatic Line-Level Code Inspection Findings

### A. Stream Slot Auto-Reconnect Leak (`use-stream-slot.ts`)
- **Location**: [use-stream-slot.ts:L157-L159](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/use-stream-slot.ts#L157-L159)
- **Code Smell**:
  ```typescript
  if (autoReconnect) {
    setTimeout(() => startRef.current?.(), 2000)
  }
  ```
- **Defect**: Timer handle is not tracked in a `useRef` or cleared on component unmount. If a stream slot unmounts during a network reconnect backoff window, `startRef.current?.()` executes against an unmounted React tree, triggering memory leaks and React state warnings.

---

### B. Sandboxed Node PostMessage Wildcard Origin (`SandboxedNode.tsx`)
- **Location**: [SandboxedNode.tsx:L225](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/SandboxedNode.tsx#L225)
- **Code Smell**:
  ```typescript
  iframe.contentWindow?.postMessage(
    { type: 'bridge:init', instanceId },
    '*',
    [channel.port2],
  );
  ```
- **Defect**: Target origin is set to wildcard `'*'`. When transferring sensitive MessageChannel ports (`channel.port2`), wildcard target origins expose channel handles to any embedded frame origin.

---

### C. Dev Console Full Browser Page Reload (`DevConsole.tsx`)
- **Location**: [DevConsole.tsx:L52-L56](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/DevConsole.tsx#L52-L56)
- **Code Smell**:
  ```typescript
  const clearEvents = () => {
    window.location.reload();
  };
  ```
- **Defect**: Invokes complete browser page reload just to clear local diagnostic logs.

---

### D. Command Palette History Pollution & Emoji Usage (`CommandPalette.tsx`)
- **Location**: [CommandPalette.tsx:L25-L35](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/CommandPalette.tsx#L25-L35) & [L81](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/CommandPalette.tsx#L81)
- **Code Smell**: Raw emojis in `KIND_GROUPS` (`⚡`, `📁`, `📄`) violate SVG design token rules. Every 120ms debounce tick appends partial query fragments to `localStorage`.

---

## 2. Summary of Wave 2 Defect Matrix

| Surface | File | Severity | Impact | Fix |
| :--- | :--- | :--- | :--- | :--- |
| **Stream Slot** | `use-stream-slot.ts` | **P0 (Critical)** | Memory leak & unmounted component state updates | Store timer in `useRef` and cancel in unmount cleanup |
| **Sandboxed Node** | `SandboxedNode.tsx` | **P1 (High)** | Target origin `'*'` security risk on port transfer | Restrict `postMessage` target origin to `window.location.origin` |
| **Dev Console** | `DevConsole.tsx` | **P1 (High)** | Full page reload on log clear | Implement in-memory log buffer reset via `useIO` |
| **Command Palette** | `CommandPalette.tsx` | **P2 (Medium)** | Emojis & `localStorage` history pollution | Replace emojis with SVG icons; persist history on item execution |
