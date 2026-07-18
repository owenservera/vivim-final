# 04 — Sandbox Hardening (C4)

**Unit:** C4.1 (`SandboxedLayer.tsx`)
**Principle (P8):** The frontend is *data*, not *code*. Layer JS runs in an
opaque-origin sandbox; it can never reach the host DOM or open its own channel.

---

## 1. Threat model

A `CanvasDefinition` carries `html`, `css`, and a `scriptUrl` (sandboxed JS).
This code is **untrusted** — it may come from a provider, an agent, or a
third-party plugin. It must not be able to:

1. Read the host page's DOM / cookies / `localStorage`
2. Make arbitrary `fetch()` calls to the backend impersonating the user
3. Reach into other layers' iframes
4. Escape the sandbox via `allow-same-origin`

---

## 2. The three-layer defense

```
┌──────────────────────────────────────────────────────────────┐
│  HOST PAGE (vivim-ui, opaque to layers)                       │
│                                                                │
│   SandboxedLayer                                               │
│     └─ <iframe sandbox="allow-scripts">   ← NO allow-same-origin
│          └─ srcDoc: immutable CSP header                      │
│               └─ layer HTML/CSS/JS                            │
│                    └─ window.__vivim_bridge.requestCapability()│
│                         └─ MessageChannel ──▶ host port1      │
│                              └─ host allow-list enforcement   │
└──────────────────────────────────────────────────────────────┘
```

### Layer 1 — `sandbox="allow-scripts"` (no `allow-same-origin`)

```tsx
<iframe
  ref={iframeRef}
  srcDoc={srcDoc}
  sandbox="allow-scripts"
  style={{ width: '100%', height: '100%', border: 'none' }}
  title={`sandboxed-layer-${instanceId}`}
/>
```

Without `allow-same-origin`, the iframe gets a **unique opaque origin**. It
cannot:
- Access `window.parent`, `window.top`, or any host DOM
- Read `document.cookie` of the host
- Share `localStorage`/`sessionStorage` with the host
- Navigate the host

`allow-scripts` is the *minimum* needed to run the layer's JS.

### Layer 2 — Immutable CSP

The `srcDoc` injects a `Content-Security-Policy` meta tag from
`SandboxPolicy.csp`:

```html
<meta http-equiv="Content-Security-Policy" content="${sandbox.csp}">
```

`SandboxPolicy` (from `shared/canvas-types.ts`):

```ts
export interface SandboxPolicy {
  csp: string
  allowNetwork: boolean
  allowCapabilities: string[]   // ← the allow-list (Layer 3)
  budgetMs: number
  allowInlineScript: false      // ← always false, enforced structurally
}
```

`allowInlineScript: false` is non-negotiable: **inline scripts are rejected at
definition time AND render time.** The `scriptUrl` (external, sandboxed) is the
only code path.

### Layer 3 — Capability allow-list + MessageChannel bridge

The layer cannot call the backend directly. It must go through the host via a
scoped `MessageChannel`:

```ts
// Host side: create a dedicated channel per layer instance
const channel = new MessageChannel()
iframe.contentWindow?.postMessage(
  { type: 'bridge:init', instanceId },
  '*',
  [channel.port2],          // transfer the port to the iframe
)
channel.port1.onmessage = handleMessage
```

The layer receives the port and exposes a safe bridge:

```js
window.__vivim_bridge = {
  requestCapability: (capability, input) => {
    return new Promise((resolve, reject) => {
      const requestId = 'req:' + Date.now() + ':' + Math.random()
      const handler = (ev) => { /* resolve/reject on response */ }
      port.addEventListener('message', handler)
      port.postMessage({
        type: 'bridge:capability:request',
        instanceId: e.data.instanceId, requestId, capability, input,
      })
    })
  }
}
```

**Host-side allow-list enforcement** (in `handleMessage`):

```ts
if (!sandbox.allowCapabilities.includes(capability)) {
  const response: BridgeMessage = {
    type: 'bridge:capability:response',
    instanceId, requestId,
    ok: false,
    error: `Capability '${capability}' not in allow list`,
  }
  channelRef.current?.port1.postMessage(response)
  return
}
```

If the capability is allowed, the host executes it (via the backend capability
executor) and returns the result over the same channel.

---

## 3. `BridgeMessage` protocol

Defined in `src/canvas/types.ts` (backend) and mirrored in `SandboxedLayer.tsx`:

```ts
interface BridgeMessage {
  type: string
  instanceId: string
  requestId?: string
  capability?: string
  input?: Record<string, unknown>
  ok?: boolean
  output?: unknown
  error?: string
}
```

Message types:
- `bridge:init` — host transfers the MessageChannel port to the iframe
- `bridge:ready` — iframe acknowledges port receipt
- `bridge:capability:request` — layer asks host to run a capability
- `bridge:capability:response` — host returns result or error
- `bridge:error` — protocol-level error

---

## 4. Budget enforcement (future)

`SandboxPolicy.budgetMs` is the execution time budget for the layer's JS. The
iframe has no native budget API, so enforcement is deferred to the host: when a
`bridge:capability:request` arrives, the host can reject if the layer has
exceeded its time/call quota. The field is plumbed through `data.sandbox` on the
node but not yet actively throttled.

---

## 5. Why no `allow-same-origin`?

If we added `allow-same-origin` alongside `allow-scripts`, the iframe would
share the host's origin — defeating the entire sandbox. The layer could read
cookies, call the backend with the user's session, and exfiltrate data. The
**opaque origin** is what makes the `MessageChannel` bridge the *only* path
out, which is exactly what we want: every capability call is visible to and
filterable by the host.

---

## 6. Acceptance (from PRD-C4)

- [x] `SandboxedLayer` renders HTML/CSS in an iframe with `sandbox="allow-scripts"`
- [x] No `allow-same-origin` — opaque origin enforced
- [x] Immutable CSP injected from `SandboxPolicy.csp`
- [x] `MessageChannel` bridge scoped per layer instance
- [x] Host-side `allowCapabilities` allow-list enforced on every request
- [x] `inlineScript` rejected (structurally `false`)
- [x] `bun run typecheck` passes

---

## 7. Open items

- **Budget enforcement:** `budgetMs` is plumbed but not yet actively throttled.
- **`bridge:observe` / `bridge:state`:** the backend `BridgeMessage` union
  includes `observe:request/response` and `state:push/apply` variants. The
  frontend `SandboxedLayer` currently handles only `capability:request`.
  Extend `handleMessage` to support observe (primitive reads) and state sync.
- **Error surfacing:** `bridge:error` should surface in the host UI (e.g. the
  `chat.error` slot), not just `console.error`.
