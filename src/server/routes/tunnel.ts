// src/server/routes/tunnel.ts
// REST API routes for tunnel and P2P subsystem management.

import type { ServerContext } from '../index.js'
import { appErrorResponse, errorResponse, json } from '../response.js'

export function createTunnelRouter(ctx: ServerContext) {
  return async function tunnelRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    // Get the service manager from context
    const rawCtx = ctx as unknown as { serviceManager?: {
      getStatus: () => Record<string, unknown>
      getTunnelClient: () => { isConnected: () => boolean; getSubdomain: () => string | null; getMetrics: () => Record<string, unknown> }
      getP2PNode: () => { isRunning: () => boolean; getPeerId: () => string | null; getPeers: () => unknown[]; getMetrics: () => Record<string, unknown> }
      getLocalServer: () => { isRunning: () => boolean; getPort: () => number; getRequestCount: () => number }
      start: () => Promise<void>
      stop: () => Promise<void>
    }}
    const serviceManager = rawCtx.serviceManager

    // Fallback: if no service manager, return basic status from config
    if (!serviceManager) {
      try {
        const { config } = await import('../../config.js')

        // GET /api/tunnel/status
        if (req.method === 'GET' && path === '/api/tunnel/status') {
          return json({
            tunnel: { enabled: config.tunnel.enabled, connected: false, subdomain: null },
            p2p: { enabled: config.p2p.enabled, running: false, peerCount: 0 },
            localServer: { enabled: config.localServer.enabled, running: false },
          })
        }

        // GET /api/tunnel/config
        if (req.method === 'GET' && path === '/api/tunnel/config') {
          return json({
            tunnel: { ...config.tunnel, authToken: config.tunnel.authToken ? '***' : null },
            p2p: config.p2p,
            localServer: config.localServer,
            orchestrator: config.orchestrator,
          })
        }

        // POST /api/tunnel/start
        if (req.method === 'POST' && path === '/api/tunnel/start') {
          return errorResponse('ServiceManager not initialized — start the orchestrator first', 'NotAvailable', 503)
        }

        // POST /api/tunnel/stop
        if (req.method === 'POST' && path === '/api/tunnel/stop') {
          return errorResponse('ServiceManager not initialized', 'NotAvailable', 503)
        }

        // For all other routes, return 404 when no service manager
        return errorResponse('Tunnel subsystem not available', 'NotAvailable', 503)
      } catch {
        return errorResponse('Config unavailable', 'NotAvailable', 503)
      }
    }

    try {
      // ═══════════════════════════════════════════════════════════════════
      // System status
      // ═══════════════════════════════════════════════════════════════════

      // GET /api/tunnel/status
      if (req.method === 'GET' && path === '/api/tunnel/status') {
        const status = serviceManager.getStatus()
        return json(status)
      }

      // GET /api/tunnel/health
      if (req.method === 'GET' && path === '/api/tunnel/health') {
        const status = serviceManager.getStatus()
        const tunnelStatus = status.tunnel as { connected: boolean }
        const p2pStatus = status.p2p as { running: boolean }
        const localStatus = status.localServer as { running: boolean }
        const allRunning =
          tunnelStatus.connected &&
          p2pStatus.running &&
          localStatus.running
        return json({
          healthy: allRunning,
          ...status,
        }, allRunning ? 200 : 503)
      }

      // ═══════════════════════════════════════════════════════════════════
      // Lifecycle
      // ═══════════════════════════════════════════════════════════════════

      // POST /api/tunnel/start
      if (req.method === 'POST' && path === '/api/tunnel/start') {
        await serviceManager.start()
        return json({ started: true })
      }

      // POST /api/tunnel/stop
      if (req.method === 'POST' && path === '/api/tunnel/stop') {
        await serviceManager.stop()
        return json({ stopped: true })
      }

      // ═══════════════════════════════════════════════════════════════════
      // Tunnel-specific
      // ═══════════════════════════════════════════════════════════════════

      // GET /api/tunnel/config
      if (req.method === 'GET' && path === '/api/tunnel/config') {
        const { config } = await import('../../config.js')
        return json({
          tunnel: { ...config.tunnel, authToken: config.tunnel.authToken ? '***' : null },
          p2p: config.p2p,
          localServer: config.localServer,
          orchestrator: config.orchestrator,
        })
      }

      // ═══════════════════════════════════════════════════════════════════
      // P2P-specific
      // ═══════════════════════════════════════════════════════════════════

      // GET /api/tunnel/p2p/peers
      if (req.method === 'GET' && path === '/api/tunnel/p2p/peers') {
        const p2pNode = serviceManager.getP2PNode()
        const peers = p2pNode.getPeers()
        return json({ peers, count: peers.length })
      }

      // GET /api/tunnel/p2p/metrics
      if (req.method === 'GET' && path === '/api/tunnel/p2p/metrics') {
        const p2pNode = serviceManager.getP2PNode()
        const metrics = p2pNode.getMetrics()
        return json(metrics)
      }

      return undefined
    } catch (err) {
      return appErrorResponse(err)
    }
  }
}
