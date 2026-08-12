'use client';

/**
 * components/canvas/SandboxedNode.tsx (G4)
 * --------------------------------------------------------------------
 * Renders a CanvasDefinition in a sandboxed iframe from a Blob URL.
 *  - CSP enforced via the `csp` attribute on the iframe
 *  - `allowInlineScript: false` literal (P8) — never allow inline script
 *  - `allowCapabilities` whitelist enforced host-side (S92 malicious scriptUrl)
 *  - Watchdog kills the frame on `budgetMs` timeout (S93)
 *  - Communication via MessageChannel postMessage bridge
 *
 * The shell is dumb: it renders whatever the resolved CanvasDefinition
 * carries. No provider conditionals. (Frontend=Backend, invariant 3)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SandboxPolicy, CanvasLayout } from '../../shared/canvas-types';

export interface SandboxAuditEvent {
  type: 'csp_violation' | 'capability_denied' | 'crash' | 'budget_timeout';
  instanceId: string;
  message?: string;
  timestamp: number;
}

interface BridgeMessage {
  type: string;
  instanceId: string;
  requestId?: string;
  capability?: string;
  input?: Record<string, unknown>;
  ok?: boolean;
  output?: unknown;
  error?: string;
}

export interface SandboxedNodeProps {
  instanceId: string;
  html: string;
  css: string;
  scriptUrl?: string;
  sandbox: SandboxPolicy;
  layout: CanvasLayout;
  /** Invoked when the sandboxed component requests a capability. */
  onCapabilityRequest?: (capability: string, input: Record<string, unknown>) => Promise<unknown>;
  /** Optional audit sink (CSP violations, denied capabilities, crashes). */
  onSandboxAudit?: (event: SandboxAuditEvent) => void;
  /** Live patch — when html/css/scriptUrl change, the iframe reloads. */
  liveKey?: string | number;
}

export function SandboxedNode({
  instanceId,
  html,
  css,
  scriptUrl,
  sandbox,
  layout,
  onCapabilityRequest,
  onSandboxAudit,
  liveKey,
}: SandboxedNodeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const channelRef = useRef<MessageChannel | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);

  // P8 invariant: allowInlineScript is FORCED false at the type level
  // (SandboxPolicy.allowInlineScript: false). Even if a malicious plugin
  // author tries to set it true, the type system rejects it AND the Zod
  // schema at publish time rejects it. We re-assert here in the renderer.
  if ((sandbox.allowInlineScript as unknown) !== false) {
    // This branch should be unreachable; belt + braces.
    throw new Error('P8 violation: allowInlineScript must be false');
  }

  const emitAudit = useCallback(
    (event: Omit<SandboxAuditEvent, 'timestamp'>) => {
      onSandboxAudit?.({ ...event, timestamp: Date.now() });
    },
    [onSandboxAudit],
  );

  const handleMessage = useCallback(
    async (e: MessageEvent<BridgeMessage>) => {
      const data = e.data;
      if (!data || data.instanceId !== instanceId) return;

      if (data.type === 'bridge:ready') {
        setReady(true);
        return;
      }

      if (
        data.type === 'bridge:capability:request' &&
        data.requestId &&
        data.capability
      ) {
        const { capability, requestId } = data;

        // Host-side allow-list enforcement (S92).
        if (!sandbox.allowCapabilities.includes(capability)) {
          emitAudit({
            type: 'capability_denied',
            instanceId,
            message: `Capability '${capability}' denied (not in allow-list)`,
          });
          channelRef.current?.port1.postMessage({
            type: 'bridge:capability:response',
            instanceId,
            requestId,
            ok: false,
            error: `Capability '${capability}' not in allow list`,
          } satisfies BridgeMessage);
          return;
        }

        try {
          const output = await onCapabilityRequest?.(capability, data.input ?? {});
          channelRef.current?.port1.postMessage({
            type: 'bridge:capability:response',
            instanceId,
            requestId,
            ok: true,
            output,
          } satisfies BridgeMessage);
        } catch (err) {
          channelRef.current?.port1.postMessage({
            type: 'bridge:capability:response',
            instanceId,
            requestId,
            ok: false,
            error: String(err),
          } satisfies BridgeMessage);
        }
      }
    },
    [instanceId, sandbox.allowCapabilities, onCapabilityRequest, emitAudit],
  );

  // Build the iframe srcdoc blob. Inline script is FORBIDDEN — only the
  // sandboxed `scriptUrl` (loaded as a <script src=...>) is allowed.
  const srcDoc = useMemo(() => {
    // S92/S93: scan html for inline <script> at RENDER time too.
    if (/<script\b[^>]*>/i.test(html)) {
      emitAudit({
        type: 'csp_violation',
        instanceId,
        message: 'Inline <script> detected in html — stripped by renderer',
      });
    }
    const cleanHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const scriptTag = scriptUrl
      ? `<script src="${escapeAttr(scriptUrl)}" defer></script>`
      : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeAttr(sandbox.csp)}"><style>${css}</style></head><body>${cleanHtml}${scriptTag}<script>
      // Bridge bootstrap — runs in the sandboxed iframe.
      // The host transfers a MessagePort via 'bridge:init'.
      var port = null;
      var ready = false;
      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'bridge:init' && e.data.instanceId === ${JSON.stringify(instanceId)}) {
          port = e.ports[0];
          if (!port) return;
          port.onmessage = handlePortMessage;
          port.postMessage({ type: 'bridge:ready', instanceId: ${JSON.stringify(instanceId)} });
          ready = true;
        }
      });
      function handlePortMessage(e) {
        var data = e.data;
        if (!data || data.type !== 'bridge:capability:request') return;
        // The sandboxed component must call window.__vivim.requestCapability(...)
        // which we expose below; the host-side allow-list is the source of truth.
      }
      window.__vivim = {
        requestCapability: function(capability, input) {
          return new Promise(function(resolve, reject) {
            if (!port || !ready) { reject(new Error('Bridge not ready')); return; }
            var reqId = 'req:' + Math.random().toString(36).slice(2);
            var handler = function(e) {
              var d = e.data;
              if (d && d.type === 'bridge:capability:response' && d.requestId === reqId) {
                port.removeEventListener('message', handler);
                if (d.ok) resolve(d.output);
                else reject(new Error(d.error || 'capability failed'));
              }
            };
            port.addEventListener('message', handler);
            port.start();
            port.postMessage({
              type: 'bridge:capability:request',
              instanceId: ${JSON.stringify(instanceId)},
              requestId: reqId,
              capability: capability,
              input: input || {}
            });
          });
        },
        layout: ${JSON.stringify(layout)}
      };
    </script></body></html>`;
    // liveKey in deps so the iframe reloads when the def changes.
  }, [html, css, scriptUrl, instanceId, layout, liveKey, sandbox.csp, emitAudit]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onCspViolation = (e: SecurityPolicyViolationEvent) => {
      emitAudit({
        type: 'csp_violation',
        instanceId,
        message: `Blocked: ${e.blockedURI} — ${e.violatedDirective}`,
      });
    };
    document.addEventListener('securitypolicyviolation', onCspViolation);

    const channel = new MessageChannel();
    channelRef.current = channel;
    channel.port1.onmessage = handleMessage;

    const onLoad = () => {
      // Restrict target origin to prevent cross-origin channel port leakage.
      // In static Tauri file:// contexts origin is 'null' — fall back to '*' only then.
      const targetOrigin =
        window.location.origin && window.location.origin !== 'null'
          ? window.location.origin
          : '*';
      iframe.contentWindow?.postMessage(
        { type: 'bridge:init', instanceId },
        targetOrigin,
        [channel.port2],
      );
    };
    iframe.addEventListener('load', onLoad);
    window.addEventListener('message', handleMessage);

    // Watchdog: kill the frame after budgetMs (S93).
    watchdogRef.current = setTimeout(() => {
      if (!ready) {
        emitAudit({
          type: 'budget_timeout',
          instanceId,
          message: `Budget ${sandbox.budgetMs}ms exceeded without bridge:ready`,
        });
        iframe.srcdoc = '<!DOCTYPE html><html><body style="font-family:system-ui;color:#888;padding:8px">budget timeout</body></html>';
      }
    }, sandbox.budgetMs);

    return () => {
      iframe.removeEventListener('load', onLoad);
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('securitypolicyviolation', onCspViolation);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
      channel.port1.close();
      channel.port2.close();
      channelRef.current = null;
    };
  }, [srcDoc, sandbox.budgetMs]);

  return (
    <iframe
      ref={iframeRef}
      // P8: sandbox allows scripts (for the scriptUrl blob) but NOT same-origin.
      // The iframe gets a unique opaque origin via srcdoc.
      sandbox="allow-scripts"
      // CSP enforced via <meta http-equiv="Content-Security-Policy"> in srcDoc
      // (React doesn't accept `csp` as an iframe attribute).
      srcDoc={srcDoc}
      title={`canvas-node-${instanceId}`}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: 'transparent',
        pointerEvents: 'auto',
      }}
    />
  );
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
