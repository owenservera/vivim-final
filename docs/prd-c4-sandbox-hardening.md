# PRD-C4: Sandbox Bridge Hardening

**Status:** Proposed | **Author:** vivim runtime | **Date:** 2026-07-16
**Part of:** [PRD-C1: Unified Infinite-Canvas Surface](prd-canvas-unified-surface.md)

## 1. Problem

The `SandboxBridge` (`src/canvas/capability-bridge.ts`) and `BridgeMessage` protocol (`src/canvas/types.ts:180–224`) are well-designed but not hardened against real browser attacks. Research validated the iframe+CSP+MessageChannel pattern but flagged:
- `allow-scripts` + `allow-same-origin` together is dangerous (allows iframe to remove sandbox)
- CSP must be immutable (meta tag, not mutable header)
- MessageChannel must be scoped to the specific layer instance

## 2. Goals

- **G1 — iframe sandbox enforcement.** Layer JS runs in `sandbox="allow-scripts"` (without `allow-same-origin`) for opaque origin.
- **G2 — Immutable CSP.** Each layer iframe gets a `<meta http-equiv="Content-Security-Policy">` tag with the layer's `SandboxPolicy.csp`.
- **G3 — Scoped MessageChannel.** Each layer instance gets its own `MessageChannel` pair; host port stored, iframe port transferred via `postMessage`.
- **G4 — Allow-list enforcement.** `SandboxPolicy.allowCapabilities` checked both bridge-side (server) and host-side (browser) before executing any capability request.
- **G5 — Time budget.** `SandboxPolicy.budgetMs` enforced via `AbortController` + `setTimeout` in the bridge.

## 3. Design

### 3.1 iframe creation

```tsx
const iframe = document.createElement('iframe')
iframe.sandbox = 'allow-scripts' // NO allow-same-origin
iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${policy.csp}">
<style>${def.css}</style>
${def.scriptUrl ? `<script src="${def.scriptUrl}"><\/script>` : ''}
</head>
<body>${def.html}</body>
</html>`
```

### 3.2 MessageChannel scoping

```tsx
const channel = new MessageChannel()
// Host keeps channel.port1; transfers channel.port2 to iframe
iframe.onload = () => {
  iframe.contentWindow.postMessage({ type: 'bridge:init', port: channel.port2 }, '*', [channel.port2])
}
// Host listens on channel.port1
channel.port1.onmessage = (e) => handleBridgeMessage(e.data)
```

### 3.3 Allow-list check

```tsx
function handleCapabilityRequest(req: BridgeCapabilityRequest) {
  if (!sandbox.allowCapabilities.includes(req.capability)) {
    port.postMessage({ type: 'bridge:capability:response', ok: false, error: 'Not allowed' })
    return
  }
  // Execute with time budget
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), sandbox.budgetMs)
  executor.execute(req.capability, req.input, { signal: controller.signal })
    .then((output) => port.postMessage({ type: 'bridge:capability:response', ok: true, output }))
    .catch((err) => port.postMessage({ type: 'bridge:capability:response', ok: false, error: String(err) }))
    .finally(() => clearTimeout(timer))
}
```

## 4. Acceptance

- Layer iframe has `sandbox="allow-scripts"` (no `allow-same-origin`)
- Layer iframe has immutable CSP meta tag from `SandboxPolicy.csp`
- Each layer instance gets its own `MessageChannel` pair
- Capability request for non-allowlisted capability is rejected with error
- Capability execution exceeding `budgetMs` is aborted
- `bun test tests/unit/canvas/canvas.test.ts` passes
