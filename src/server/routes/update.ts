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

import { z } from 'zod'
import { getUpdateEngine } from '../../engines/update-engine.js'
import { getLogger } from '../../lib/logger.js'
import { appErrorResponse, errorResponse, json } from '../response.js'

const log = getLogger('server:routes:update')
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
        return appErrorResponse(error)
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
        return appErrorResponse(error)
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
        return appErrorResponse(error)
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
        return appErrorResponse(error)
      }
    }

    // ── POST /api/update/download ──────────────────────────────────────────
    if (path === '/api/update/download' && req.method === 'POST') {
      try {
        const schema = z.object({
          url: z.string().url('url must be a valid URL'),
          filename: z.string().min(1, 'filename is required'),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)

        const engine = getUpdateEngine()
        const filePath = await engine.downloadUpdate(parsed.data.url, parsed.data.filename)

        return json({ ok: true, filePath })
      } catch (error) {
        return appErrorResponse(error)
      }
    }

    // ── POST /api/update/install ───────────────────────────────────────────
    if (path === '/api/update/install' && req.method === 'POST') {
      try {
        const schema = z.object({
          filePath: z.string().min(1, 'filePath is required'),
          type: z.enum(['app', 'provider']),
          provider: z.string().optional(),
          parserCode: z.string().optional(),
          capabilities: z.array(z.record(z.unknown())).optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const body = parsed.data

        if (body.type === 'provider' && body.provider) {
          // Provider update
          if (!body.parserCode || !body.capabilities) {
            return errorResponse(
              'parserCode and capabilities are required for provider updates',
              'ValidationError',
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
          return errorResponse('filePath is required for app updates', 'ValidationError', 400)
        }

        const engine = getUpdateEngine()
        // Install in background - app will restart
        engine
          .installAppUpdate(body.filePath)
          .catch((e: unknown) => log.error({ err: e }, 'update install failed'))

        return json({
          ok: true,
          message: 'Update installation started. Application will restart.',
        })
      } catch (error) {
        return appErrorResponse(error)
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
        engine
          .installAppUpdate(filePath)
          .catch((e: unknown) => log.error({ err: e }, 'update install failed'))

        return json({
          ok: true,
          updated: true,
          from: updateInfo.currentVersion,
          to: updateInfo.latestVersion,
          message: 'Update installation started. Application will restart.',
        })
      } catch (error) {
        return appErrorResponse(error)
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
