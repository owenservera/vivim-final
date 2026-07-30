/**
 * Update API Routes
 *
 * Provides endpoints for checking and installing updates.
 *
 * Routes:
 *   GET  /api/update/check              — Check if app update available
 *   GET  /api/update/provider/:slug     — Check if provider update available
 *   POST /api/update/download           — Download update
 *   POST /api/update/install            — Install update
 *   POST /api/update/apply              — Check + download + install
 *   GET  /api/update/version            — Get current version
 *   GET  /api/update/providers          — List installed providers
 *   GET  /api/update/provider/:slug/status — Get provider status
 */

import { getUpdateEngine } from '../../engines/update-engine.js'
import { errorResponse, json } from '../response.js'

export function createUpdateRouter() {
  return async function updateRouter(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname

    // ── GET /api/update/check ──────────────────────────────────────────────
    if (path === '/api/update/check' && req.method === 'GET') {
      try {
        const engine = getUpdateEngine()
        const updateInfo = await engine.checkForAppUpdates()

        return json({
          ok: true,
          currentVersion: engine.getCurrentVersion(),
          update: updateInfo,
        })
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : 'Failed to check for updates',
          'UPDATE_CHECK_FAILED',
          500,
        )
      }
    }

    // ── GET /api/update/provider/:slug ─────────────────────────────────────
    const providerMatch = path.match(/^\/api\/update\/provider\/([^/]+)$/)
    if (providerMatch && req.method === 'GET') {
      const slug = providerMatch[1] ?? ''
      try {
        const engine = getUpdateEngine()
        const providerUpdate = await engine.checkForProviderUpdates(slug)

        return json({
          ok: true,
          provider: slug,
          update: providerUpdate,
        })
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : 'Failed to check provider updates',
          'PROVIDER_UPDATE_CHECK_FAILED',
          500,
        )
      }
    }

    // ── GET /api/update/provider/:slug/status ──────────────────────────────
    const statusMatch = path.match(/^\/api\/update\/provider\/([^/]+)\/status$/)
    if (statusMatch && req.method === 'GET') {
      const slug = statusMatch[1] ?? ''
      try {
        const engine = getUpdateEngine()
        const status = await engine.getProviderStatus(slug)

        return json({
          ok: true,
          provider: slug,
          ...status,
        })
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : 'Failed to get provider status',
          'PROVIDER_STATUS_FAILED',
          500,
        )
      }
    }

    // ── GET /api/update/providers ──────────────────────────────────────────
    if (path === '/api/update/providers' && req.method === 'GET') {
      try {
        const engine = getUpdateEngine()
        const providers = await engine.listInstalledProviders()

        // Get status for each provider
        const providersWithStatus = await Promise.all(
          providers.map(async (slug) => {
            const status = await engine.getProviderStatus(slug)
            return { slug, ...status }
          }),
        )

        return json({
          ok: true,
          providers: providersWithStatus,
        })
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : 'Failed to list providers',
          'PROVIDERS_LIST_FAILED',
          500,
        )
      }
    }

    // ── POST /api/update/download ──────────────────────────────────────────
    if (path === '/api/update/download' && req.method === 'POST') {
      try {
        const body = (await req.json()) as { url?: string; filename?: string }

        if (!body.url || !body.filename) {
          return errorResponse('url and filename are required', 'VALIDATION_ERROR', 400)
        }

        const engine = getUpdateEngine()
        const filePath = await engine.downloadUpdate(body.url, body.filename)

        return json({ ok: true, filePath })
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : 'Download failed',
          'DOWNLOAD_FAILED',
          500,
        )
      }
    }

    // ── POST /api/update/install ───────────────────────────────────────────
    if (path === '/api/update/install' && req.method === 'POST') {
      try {
        const body = (await req.json()) as {
          filePath?: string
          type?: 'app' | 'provider'
          provider?: string
          parserCode?: string
          capabilities?: Record<string, unknown>[]
        }

        if (body.type === 'provider' && body.provider) {
          // Provider update
          if (!body.parserCode || !body.capabilities) {
            return errorResponse(
              'parserCode and capabilities are required for provider updates',
              'VALIDATION_ERROR',
              400,
            )
          }

          const engine = getUpdateEngine()
          await engine.installProviderUpdate(body.provider, body.parserCode, body.capabilities)

          return json({
            ok: true,
            message: `Provider ${body.provider} updated successfully`,
          })
        }
        // App update
        if (!body.filePath) {
          return errorResponse('filePath is required for app updates', 'VALIDATION_ERROR', 400)
        }

        const engine = getUpdateEngine()
        // Install in background - app will restart
        engine.installAppUpdate(body.filePath).catch(console.error)

        return json({
          ok: true,
          message: 'Update installation started. Application will restart.',
        })
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : 'Installation failed',
          'INSTALL_FAILED',
          500,
        )
      }
    }

    // ── POST /api/update/apply ─────────────────────────────────────────────
    if (path === '/api/update/apply' && req.method === 'POST') {
      try {
        const engine = getUpdateEngine()

        // Check for update
        const updateInfo = await engine.checkForAppUpdates()
        if (!updateInfo || !updateInfo.available) {
          return json({
            ok: true,
            updated: false,
            message: 'App is up to date',
          })
        }

        // Download
        const filename = `vivim-update-${updateInfo.latestVersion}.exe`
        const filePath = await engine.downloadUpdate(updateInfo.downloadUrl, filename)

        // Install (app will restart)
        engine.installAppUpdate(filePath).catch(console.error)

        return json({
          ok: true,
          updated: true,
          from: updateInfo.currentVersion,
          to: updateInfo.latestVersion,
          message: 'Update installation started. Application will restart.',
        })
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : 'Update failed',
          'UPDATE_FAILED',
          500,
        )
      }
    }

    // ── GET /api/update/version ────────────────────────────────────────────
    if (path === '/api/update/version' && req.method === 'GET') {
      const engine = getUpdateEngine()
      return json({
        ok: true,
        version: engine.getCurrentVersion(),
      })
    }

    return null
  }
}
