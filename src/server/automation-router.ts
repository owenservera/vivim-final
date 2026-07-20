// src/server/automation-router.ts
// Governor-mediated automation router (B9 / L7). All browser I/O goes through
// ChromeGovernor via the AutomationOrchestrator — never touches CDP directly
// (Governor Canon). Replaces the legacy src/automation/automation-router.ts.

import { AGENT_ROLES } from '../engines/automation/agents.js'
import type { AutomationOrchestrator } from '../engines/automation/orchestrator.js'
import { EngineError } from '../errors.js'
import { errorResponse, json } from './response.js'

export interface AutomationRouterDeps {
  orchestrator: AutomationOrchestrator
}

export function createAutomationRouter(deps: AutomationRouterDeps) {
  const { orchestrator } = deps

  return async function automationRouter(req: Request, url: URL): Promise<Response | null> {
    if (!url.pathname.startsWith('/api/automate/')) return null

    try {
      // GET /api/automate/recipes — list composite recipe library
      if (url.pathname === '/api/automate/recipes' && req.method === 'GET') {
        return json({
          ok: true,
          recipes: orchestrator
            .listRecipes()
            .map((r) => ({ id: r.id, description: r.description })),
        })
      }

      // GET /api/automate/roles — list config-role agents
      if (url.pathname === '/api/automate/roles' && req.method === 'GET') {
        return json({
          ok: true,
          roles: Object.values(AGENT_ROLES).map((r) => ({
            id: r.id,
            description: r.description,
            trust: r.trust,
          })),
        })
      }

      // POST /api/automate/run — execute an AutomationGoal
      if (url.pathname === '/api/automate/run' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}))
        const { role, recipeId, intent, params, destructive } = body as {
          role?: string
          recipeId?: string
          intent?: string
          params?: Record<string, string>
          destructive?: boolean
        }
        if (!role) {
          return errorResponse('Missing required field: role', 'BadRequest', 400)
        }
        const result = await orchestrator.run({
          role,
          recipeId,
          intent: intent ?? 'auto',
          params: params ?? {},
          destructive: destructive ?? false,
        })
        return json({ ok: true, ...result })
      }

      return errorResponse(`Unknown automation route: ${url.pathname}`, 'NotFound', 404)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const code = err instanceof EngineError ? 422 : 500
      return errorResponse(msg, 'AutomationError', code)
    }
  }
}
