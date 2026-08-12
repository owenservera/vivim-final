# Stage 2: Wave 2 Verbatim Refactoring & Implementation Spec

**Location**: `frontend/docs/senior-frontend-assessment-wave2/stage-2-verbatim-refactoring-spec-wave2.md`  
**Target Files**:
- `frontend/src/components/canvas/use-stream-slot.ts` [MODIFY]
- `frontend/src/components/canvas/SandboxedNode.tsx` [MODIFY]
- `frontend/src/components/canvas/DevConsole.tsx` [MODIFY]
- `frontend/src/components/canvas/CommandPalette.tsx` [MODIFY]

---

## 1. Stream Slot Auto-Reconnect Timer Tracking

### Target File: `[MODIFY] frontend/src/components/canvas/use-stream-slot.ts`

Prevent unmounted state updates during auto-reconnect.

#### Verbatim Code Replacement:

Replace lines 153-167 of [use-stream-slot.ts](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/use-stream-slot.ts#L153-L167) with:

```typescript
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(String(err));
        setState('error');
        if (autoReconnect && mountedRef.current) {
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
              startRef.current?.();
            }
          }, 2000);
        }
      });
  }, [nodeId, capabilityId, input, state, autoReconnect]);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup reconnect timer on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);
```

---

## 2. Sandboxed Node PostMessage Target Origin Fix

### Target File: `[MODIFY] frontend/src/components/canvas/SandboxedNode.tsx`

Restrict `postMessage` target origin to avoid wildcard cross-origin port exposure.

#### Verbatim Code Replacement:

Replace lines 224-230 of [SandboxedNode.tsx](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/SandboxedNode.tsx#L224-L230) with:

```typescript
    const onLoad = () => {
      const targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;
      iframe.contentWindow?.postMessage(
        { type: 'bridge:init', instanceId },
        targetOrigin,
        [channel.port2],
      );
    };
```

---

## 3. In-Memory Dev Console Log Reset

### Target File: `[MODIFY] frontend/src/components/canvas/DevConsole.tsx`

Replace `window.location.reload()` with a clean state filter reset.

#### Verbatim Code Replacement:

Replace lines 52-56 of [DevConsole.tsx](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/DevConsole.tsx#L52-L56) with:

```typescript
  const [clearedBefore, setClearedBefore] = useState<number>(0);

  const clearEvents = () => {
    setClearedBefore(Date.now());
  };

  const activeEvents = useMemo(() => {
    return filteredEvents.filter((e) => e.timestamp >= clearedBefore);
  }, [filteredEvents, clearedBefore]);
```

---

## Next Stage
Proceed to [Stage 3: Dev Tools & Command Palette Blueprint](file:///c:/0-BlackBoxProject-0/vivim-final/frontend/docs/senior-frontend-assessment-wave2/stage-3-dev-tools-and-command-palette-blueprint.md).
