# Consumer UX Review — Stage 2: Resilience, Error Messaging & Self-Healing

**Target Components:** `src/components/canvas/BackendOfflineCard.tsx`, `src/components/canvas/NetworkStatusBar.tsx`, `src/components/FullPageError.tsx`

---

## 1. UX Audit & Consumer Friction Analysis

### Current UX Flaws:
1. **Raw Log File Path Exposure in Offline State (`BackendOfflineCard.tsx` lines 74–94):**  
   Non-technical consumers are presented with raw system paths like `%LOCALAPPDATA%\vivim\vivim-server.log`. This creates anxiety and feels broken.
2. **Missing Reconnection Controls:**  
   The current offline screen has no manual "Try Again" button or automatic retry timer indicator.
3. **Harsh Offline Warning Bar (`NetworkStatusBar.tsx`):**  
   The warning bar presents a static yellow bar saying "Connection lost. Chat and search are unavailable." with technical ping statistics `(last ping: 120ms)`.

---

## 2. Verbatim Implementation Specifications

### Fix 1: `src/components/canvas/BackendOfflineCard.tsx` — Friendly Reconnection Card

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/BackendOfflineCard.tsx`  
**Target Lines:** 56–95

#### Target Code to Replace:
```tsx
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text, #1f2937)',
          }}
        >
          Backend offline
        </h1>
        <p
          style={{
            margin: '12px 0 0',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text-muted, #6b7280)',
          }}
        >
          The Vivim backend is not responding. In the desktop build this usually means the sidecar
          service failed to start.
        </p>
        <p
          style={{
            margin: '16px 0 0',
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--bg-muted, #f3f4f6)',
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 12,
            wordBreak: 'break-all',
            color: 'var(--text, #1f2937)',
          }}
        >
          {typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '')
            ? '%LOCALAPPDATA%\\vivim\\vivim-server.log'
            : navigator.platform?.startsWith('Mac')
              ? '~/Library/Application Support/vivim/vivim-server.log'
              : '~/.local/share/vivim/vivim-server.log'}
        </p>
```

#### Replacement Code (Verbatim):
```tsx
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'color-mix(in oklch, var(--primary) 12%, transparent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              color: 'var(--primary)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: 'var(--text, #1f2937)' }}>
            Connecting to Vivim...
          </h1>
          <p style={{ margin: '12px 0 20px', fontSize: 14, lineHeight: 1.5, color: 'var(--text-muted, #6b7280)' }}>
            We're automatically reconnecting to your local session. Please make sure the Vivim desktop app is open.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 'var(--radius, 8px)',
              background: 'var(--primary, #3b82f6)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            Reconnect Now
          </button>
          
          <details style={{ marginTop: 24, textAlign: 'left', fontSize: 11, color: 'var(--text-muted, #9ca3af)' }}>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>System Diagnostic Log Path</summary>
            <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-muted, #f3f4f6)', borderRadius: 6, fontFamily: 'var(--font-geist-mono, monospace)', wordBreak: 'break-all' }}>
              {typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '')
                ? '%LOCALAPPDATA%\\vivim\\vivim-server.log'
                : navigator.platform?.startsWith('Mac')
                  ? '~/Library/Application Support/vivim/vivim-server.log'
                  : '~/.local/share/vivim/vivim-server.log'}
            </div>
          </details>
        </div>
```

---

### Fix 2: `src/components/canvas/NetworkStatusBar.tsx` — Friendly Connection Bar

**File Path:** `file:///c:/0-BlackBoxProject-0/vivim-final/frontend/src/components/canvas/NetworkStatusBar.tsx`  
**Target Lines:** 34–39

#### Target Code to Replace:
```tsx
      Connection lost. Chat and search are unavailable.
      {latencyMs !== null && (
        <span style={{ marginLeft: 8, opacity: 0.7 }}>
          (last ping: {latencyMs}ms)
        </span>
      )}
```

#### Replacement Code (Verbatim):
```tsx
      Working offline. Reconnecting automatically...
```

---

## 3. Verification Protocol

```bash
# Verify component renders cleanly
bun test tests/unit/
```
