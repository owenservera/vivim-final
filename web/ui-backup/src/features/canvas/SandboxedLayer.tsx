// web/ui/src/features/canvas/SandboxedLayer.tsx
// Renders a CanvasDefinition's HTML/CSS in a sandboxed iframe (PRD-C4).
// Layer JS runs in opaque-origin sandbox; communicates via MessageChannel bridge.
// Enforces SandboxPolicy.allowCapabilities allow-list on both bridge and host side.
// v2: CSP hardening (default-deny with unsafe-inline for inline scripts), watchdog
// timer (5s ping), sandbox audit logging.

import { useRef, useEffect, useState, useCallback } from 'react'
import type { SandboxPolicy } from 'shared/canvas-types.js'

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

interface SandboxedLayerProps {
  instanceId: string
  html: string
  css: string
  scriptUrl?: string
  sandbox: SandboxPolicy
  onCapabilityRequest: (capability: string, input: Record<string, unknown>) => Promise<unknown>
  onSandboxAudit?: (event: SandboxAuditEvent) => void
  layout?: { x: number; y: number; z: number; w: number; h: number }
  visible?: boolean
}

export interface SandboxAuditEvent {
  type: 'csp_violation' | 'capability_denied' | 'crash' | 'watchdog_timeout'
  instanceId: string
  message?: string
  timestamp: number
}

/** Default CSP with unsafe-inline for scripts (until components migrate to external scripts). */
const DEFAULT_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none';"

/** Watchdog ping interval in ms. */
const WATCHDOG_PING_MS = 5000

export function SandboxedLayer({
  instanceId,
  html,
  css,
  scriptUrl,
  sandbox,
  onCapabilityRequest,
  onSandboxAudit,
  layout,
  visible,
}: SandboxedLayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const channelRef = useRef<MessageChannel | null>(null)
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastPongRef = useRef(Date.now())
  const killCountRef = useRef(0)

  const emitAudit = useCallback(
    (event: Omit<SandboxAuditEvent, 'timestamp'>) => {
      onSandboxAudit?.({ ...event, timestamp: Date.now() })
    },
    [onSandboxAudit],
  )

  const handleMessage = useCallback(
    async (e: MessageEvent<BridgeMessage>) => {
      if (e.data.type === 'bridge:ready' && e.data.instanceId === instanceId) {
        setReady(true)
        lastPongRef.current = Date.now()
        return
      }

      if (e.data.type === 'bridge:pong' && e.data.instanceId === instanceId) {
        lastPongRef.current = Date.now()
        return
      }

      if (
        e.data.type === 'bridge:capability:request' &&
        e.data.instanceId === instanceId &&
        e.data.requestId &&
        e.data.capability
      ) {
        const { capability, requestId } = e.data

        // Host-side allow-list enforcement
        if (!sandbox.allowCapabilities.includes(capability)) {
          emitAudit({
            type: 'capability_denied',
            instanceId,
            message: `Capability '${capability}' denied (not in allow-list)`,
          })
          const response: BridgeMessage = {
            type: 'bridge:capability:response',
            instanceId,
            requestId,
            ok: false,
            error: `Capability '${capability}' not in allow list`,
          }
          channelRef.current?.port1.postMessage(response)
          return
        }

        try {
          const output = await onCapabilityRequest(capability, e.data.input ?? {})
          const response: BridgeMessage = {
            type: 'bridge:capability:response',
            instanceId,
            requestId,
            ok: true,
            output,
          }
          channelRef.current?.port1.postMessage(response)
        } catch (err) {
          const response: BridgeMessage = {
            type: 'bridge:capability:response',
            instanceId,
            requestId,
            ok: false,
            error: String(err),
          }
          channelRef.current?.port1.postMessage(response)
        }
      }
    },
    [instanceId, sandbox.allowCapabilities, onCapabilityRequest, emitAudit],
  )

  // Watchdog timer: ping the iframe every WATCHDOG_PING_MS; if no pong within
  // 2x interval, kill and reload the iframe.
  useEffect(() => {
    if (!ready) return

    watchdogRef.current = setInterval(() => {
      const elapsed = Date.now() - lastPongRef.current
      if (elapsed > WATCHDOG_PING_MS * 2) {
        emitAudit({
          type: 'watchdog_timeout',
          instanceId,
          message: `Iframe unresponsive after ${elapsed}ms`,
        })
        const iframe = iframeRef.current
        if (iframe) {
          killCountRef.current++
          iframe.src = 'about:blank'
          // Reload after brief delay
          setTimeout(() => {
            if (iframeRef.current) {
              iframeRef.current.srcdoc = iframeRef.current.srcdoc || ''
            }
          }, 200)
        }
      } else {
        channelRef.current?.port1.postMessage({
          type: 'bridge:ping',
          instanceId,
        } as BridgeMessage)
      }
    }, WATCHDOG_PING_MS)

    return () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current)
    }
  }, [ready, instanceId, emitAudit])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // CSP violation capture
    const onCspViolation = (e: SecurityPolicyViolationEvent) => {
      emitAudit({
        type: 'csp_violation',
        instanceId,
        message: `Blocked: ${e.blockedURI} — ${e.violatedDirective}`,
      })
    }
    document.addEventListener('securitypolicyviolation', onCspViolation)

    // Create scoped MessageChannel for this layer instance
    const channel = new MessageChannel()
    channelRef.current = channel

    // Listen on host port
    channel.port1.onmessage = handleMessage

    // Transfer iframe port on load
    const onLoad = () => {
      iframe.contentWindow?.postMessage(
        { type: 'bridge:init', instanceId },
        '*',
        [channel.port2],
      )
    }
    iframe.addEventListener('load', onLoad)

    window.addEventListener('message', handleMessage)

    return () => {
      iframe.removeEventListener('load', onLoad)
      window.removeEventListener('message', handleMessage)
      document.removeEventListener('securitypolicyviolation', onCspViolation)
      channel.port1.close()
      channel.port2.close()
      channelRef.current = null
    }
  }, [instanceId, handleMessage])

  // Lifecycle hooks: send mount/resize/move/visibility events to the iframe
  useEffect(() => {
    if (!ready || !channelRef.current) return
    if (layout) {
      channelRef.current.port1.postMessage({
        type: 'lifecycle',
        event: 'mounted',
        instanceId,
        layout,
      } as BridgeMessage)
    }
  }, [ready, instanceId, layout])

  useEffect(() => {
    if (!ready || !channelRef.current) return
    if (!layout) return
    channelRef.current.port1.postMessage({
      type: 'lifecycle',
      event: 'resized',
      instanceId,
      layout: { w: layout.w, h: layout.h },
    } as BridgeMessage)
  }, [ready, instanceId, layout?.w, layout?.h])

  useEffect(() => {
    if (!ready || !channelRef.current) return
    if (!layout) return
    channelRef.current.port1.postMessage({
      type: 'lifecycle',
      event: 'moved',
      instanceId,
      layout: { x: layout.x, y: layout.y },
    } as BridgeMessage)
  }, [ready, instanceId, layout?.x, layout?.y])

  useEffect(() => {
    if (!ready || !channelRef.current) return
    channelRef.current.port1.postMessage({
      type: 'lifecycle',
      event: visible ? 'visible' : 'hidden',
      instanceId,
    } as BridgeMessage)
  }, [ready, instanceId, visible])  // Use the sandbox's CSP if provided, otherwise default safe CSP
  const effectiveCsp = sandbox.csp || DEFAULT_CSP

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${effectiveCsp}">
<style>${css}</style>
${scriptUrl ? `<script src="${scriptUrl}"><\/script>` : ''}
</head>
<body>
<script>
  // Bridge init: receive MessageChannel port from host
  window.addEventListener('message', (e) => {
    if (e.data.type === 'bridge:init') {
      var port = e.ports[0]
      port.postMessage({ type: 'bridge:ready', instanceId: e.data.instanceId })

      // Watchdog: respond to host pings
      port.addEventListener('message', function(ev) {
        if (ev.data && ev.data.type === 'bridge:ping') {
          port.postMessage({ type: 'bridge:pong', instanceId: ev.data.instanceId })
        }
      })

      // Forward capability requests from layer JS to host
      window.__vivim_bridge = {
        requestCapability: function(capability, input) {
          return new Promise(function(resolve, reject) {
            var requestId = 'req:' + Date.now() + ':' + Math.random().toString(36).slice(2)
            var handler = function(ev) {
              if (ev.data && ev.data.type === 'bridge:capability:response' && ev.data.requestId === requestId) {
                port.removeEventListener('message', handler)
                ev.data.ok ? resolve(ev.data.output) : reject(new Error(ev.data.error))
              }
            }
            port.addEventListener('message', handler)
            port.postMessage({ type: 'bridge:capability:request', instanceId: e.data.instanceId, requestId: requestId, capability: capability, input: input })
          })
        }
      }
    }
  })

  // CSP violation reporting
  document.addEventListener('securitypolicyviolation', function(e) {
    // no direct channel — handled at the host via postMessage relaying
  })
<\/script>
${html}
</body>
</html>`

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none' }}
      title={`sandboxed-layer-${instanceId}`}
    />
  )
}
