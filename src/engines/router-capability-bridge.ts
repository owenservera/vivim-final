// src/engines/router-capability-bridge.ts
// --------------------------------------------------------------------------
// F2/F8 fix: Auto-registers capabilities for router-only API endpoints
// that are not yet in the capability registry. This ensures the CLI,
// universal dispatcher, and MCP can reach ALL backend operations.
//
// Called after router setup in the bootstrap phase. Each router endpoint
// gets a capability whose handler proxies to localhost (the running server),
// so the invariant "as capable via CLI as via frontend" holds.
//
// This is a bridge layer — as real handlers are written in
// capability-bootstrap-generated.ts, they take precedence.

import { getLogger } from '../lib/logger.js'
import { makeCapability } from './capability-bootstrap.js'
import type { UnifiedCapability, UnifiedCapabilityRegistry } from './unified-registry.js'

const log = getLogger('router-capability-bridge')

/**
 * Router endpoint declarations that need capability wrappers.
 * Each entry maps to one or more HTTP endpoints served by a dedicated router.
 * Format: [method, pathPattern, capabilitySlug, description, category]
 *   - pathPattern uses :param syntax (same as the universal dispatcher)
 */
interface RouterEndpoint {
  method: string
  path: string
  slug: string
  description: string
  category: string
  surfaces?: string[]
}

/**
 * All router-only endpoints that should be CLI/API/MCP-reachable.
 * This table is the single source of truth for the bridge.
 */
const ROUTER_ENDPOINTS: RouterEndpoint[] = [
  // Canvas v7
  { method: 'GET', path: '/api/canvas/definitions', slug: 'canvas_list_definitions', description: 'List canvas definitions', category: 'canvas' },
  { method: 'POST', path: '/api/canvas/spawn', slug: 'canvas_spawn', description: 'Spawn a new canvas instance', category: 'canvas' },
  { method: 'POST', path: '/api/canvas/resolve', slug: 'canvas_resolve', description: 'Resolve canvas nodes for a workspace', category: 'canvas' },
  { method: 'GET', path: '/api/canvas/events', slug: 'canvas_events', description: 'Get canvas events', category: 'canvas' },
  { method: 'POST', path: '/api/canvas/observe', slug: 'canvas_observe', description: 'Observe canvas mutations', category: 'canvas' },
  { method: 'GET', path: '/api/canvas/manifest', slug: 'canvas_manifest', description: 'Get canvas manifest', category: 'canvas' },
  { method: 'GET', path: '/api/canvas/instance/:id', slug: 'canvas_get_instance', description: 'Get a canvas instance', category: 'canvas' },
  { method: 'POST', path: '/api/canvas/instance/:id/mutate', slug: 'canvas_mutate_instance', description: 'Mutate a canvas instance', category: 'canvas' },
  { method: 'POST', path: '/api/canvas/save', slug: 'canvas_save', description: 'Save canvas state', category: 'canvas' },

  // Agent Canvas
  { method: 'POST', path: '/api/agent/canvas/command', slug: 'agent_canvas_command', description: 'Send command to agent canvas', category: 'agent' },
  { method: 'GET', path: '/api/agent/canvas/policy', slug: 'agent_canvas_get_policy', description: 'Get agent canvas policy', category: 'agent' },
  { method: 'POST', path: '/api/agent/canvas/policy', slug: 'agent_canvas_set_policy', description: 'Set agent canvas policy', category: 'agent' },
  { method: 'POST', path: '/api/agent/canvas/plan', slug: 'agent_canvas_plan', description: 'Get agent plan for canvas', category: 'agent' },

  // Automation
  { method: 'GET', path: '/api/automate/recipes', slug: 'automation_list_recipes', description: 'List automation recipes', category: 'automation' },
  { method: 'POST', path: '/api/automate/run', slug: 'automation_run', description: 'Run an automation', category: 'automation' },

  // Autonomous
  { method: 'POST', path: '/api/autonomous/execute', slug: 'autonomous_execute', description: 'Execute autonomous task', category: 'system' },
  { method: 'GET', path: '/api/autonomous/tasks', slug: 'autonomous_list_tasks', description: 'List autonomous tasks', category: 'system' },
  { method: 'GET', path: '/api/autonomous/gates', slug: 'autonomous_gates', description: 'Get autonomous gates', category: 'system' },
  { method: 'POST', path: '/api/autonomous/search', slug: 'autonomous_search', description: 'Search autonomous capabilities', category: 'system' },

  // Chrome/CDP
  { method: 'POST', path: '/api/chrome/factory', slug: 'chrome_create', description: 'Create Chrome browser instance', category: 'browser' },
  { method: 'POST', path: '/api/chrome/reset', slug: 'chrome_reset', description: 'Reset Chrome browser', category: 'browser' },

  // Conceptual
  { method: 'GET', path: '/api/conceptual/families', slug: 'conceptual_list_families', description: 'List conceptual families', category: 'knowledge' },
  { method: 'POST', path: '/api/conceptual/resolve', slug: 'conceptual_resolve', description: 'Resolve conceptual model', category: 'knowledge' },
  { method: 'GET', path: '/api/conceptual/surface', slug: 'conceptual_surface', description: 'Get conceptual surface', category: 'knowledge' },

  // Kernel
  { method: 'POST', path: '/api/kernel/oracle/query', slug: 'kernel_oracle_query', description: 'Query kernel oracle', category: 'system' },
  { method: 'POST', path: '/api/kernel/oracle/scan', slug: 'kernel_oracle_scan', description: 'Scan kernel oracle', category: 'system' },
  { method: 'POST', path: '/api/kernel/oracle/heal', slug: 'kernel_oracle_heal', description: 'Heal via kernel oracle', category: 'system' },

  // Mutation
  { method: 'POST', path: '/api/mutation/apply', slug: 'mutation_apply', description: 'Apply a mutation', category: 'system' },
  { method: 'POST', path: '/api/mutation/preview', slug: 'mutation_preview', description: 'Preview a mutation', category: 'system' },
  { method: 'GET', path: '/api/mutation/history', slug: 'mutation_history', description: 'Get mutation history', category: 'system' },
  { method: 'GET', path: '/api/mutation/status', slug: 'mutation_status', description: 'Get mutation status', category: 'system' },
  { method: 'POST', path: '/api/mutation/undo', slug: 'mutation_undo', description: 'Undo last mutation', category: 'system' },
  { method: 'POST', path: '/api/mutation/redo', slug: 'mutation_redo', description: 'Redo undone mutation', category: 'system' },

  // Mux / Routing
  { method: 'POST', path: '/api/route/auto', slug: 'route_auto', description: 'Auto-route a request', category: 'system' },
  { method: 'POST', path: '/api/route/mux', slug: 'route_mux', description: 'Multiplex a request', category: 'system' },
  { method: 'POST', path: '/api/route/fanout', slug: 'route_fanout', description: 'Fan out a request', category: 'system' },
  { method: 'GET', path: '/api/route/cost-report', slug: 'route_cost_report', description: 'Get routing cost report', category: 'system' },

  // Plugins
  { method: 'GET', path: '/api/plugins', slug: 'plugin_list', description: 'List installed plugins', category: 'system' },
  { method: 'POST', path: '/api/plugins/install', slug: 'plugin_install', description: 'Install a plugin', category: 'system' },

  // Setup
  { method: 'POST', path: '/api/setup/workspace', slug: 'setup_workspace', description: 'Set up workspace', category: 'admin' },
  { method: 'POST', path: '/api/setup/launch-visible', slug: 'setup_launch', description: 'Launch server visibly', category: 'admin' },
  { method: 'POST', path: '/api/setup/verify', slug: 'setup_verify', description: 'Verify setup', category: 'admin' },
  { method: 'POST', path: '/api/setup/complete', slug: 'setup_complete', description: 'Complete setup', category: 'admin' },

  // Storage
  { method: 'GET', path: '/api/storage/status', slug: 'storage_status', description: 'Get storage status', category: 'storage' },
  { method: 'POST', path: '/api/storage/move', slug: 'storage_move', description: 'Move storage data', category: 'storage' },
  { method: 'POST', path: '/api/storage/rollback', slug: 'storage_rollback', description: 'Rollback storage', category: 'storage' },
  { method: 'POST', path: '/api/storage/cleanup', slug: 'storage_cleanup', description: 'Cleanup storage', category: 'storage' },

  // Generative
  { method: 'POST', path: '/api/generative/task', slug: 'generative_create_task', description: 'Create generative task', category: 'ai' },
  { method: 'GET', path: '/api/generative/task/:id', slug: 'generative_get_task', description: 'Get generative task', category: 'ai' },

  // Surface/Template/Variant
  { method: 'GET', path: '/api/template', slug: 'template_list', description: 'List templates', category: 'canvas' },
  { method: 'POST', path: '/api/template/instantiate', slug: 'template_instantiate', description: 'Instantiate a template', category: 'canvas' },

  // Update
  { method: 'GET', path: '/api/update/check', slug: 'update_check', description: 'Check for updates', category: 'system' },
  { method: 'POST', path: '/api/update/download', slug: 'update_download', description: 'Download update', category: 'system' },
  { method: 'POST', path: '/api/update/install', slug: 'update_install', description: 'Install update', category: 'system' },

  // Users
  { method: 'GET', path: '/api/users', slug: 'user_list', description: 'List users', category: 'user' },
  { method: 'GET', path: '/api/users/current', slug: 'user_current', description: 'Get current user', category: 'user' },

  // Webhook
  { method: 'POST', path: '/api/webhook', slug: 'webhook_ingress', description: 'Receive webhook', category: 'system' },

  // LLM Harness
  { method: 'POST', path: '/api/harness/plan', slug: 'llm_harness_plan', description: 'Plan LLM harness execution', category: 'llm' },
  { method: 'POST', path: '/api/harness/apply', slug: 'llm_harness_apply', description: 'Apply LLM harness', category: 'llm' },

  // Audit
  { method: 'GET', path: '/api/audit/list', slug: 'audit_list', description: 'List audit entries', category: 'admin' },
  { method: 'GET', path: '/api/audit/export', slug: 'audit_export', description: 'Export audit log', category: 'admin' },
  { method: 'GET', path: '/api/audit/stats', slug: 'audit_stats', description: 'Get audit statistics', category: 'admin' },

  // Provenance
  { method: 'GET', path: '/api/provenance/weights', slug: 'provenance_weights', description: 'Get provenance weights', category: 'system' },

  // Workspace
  { method: 'POST', path: '/api/workspace/backup', slug: 'workspace_backup', description: 'Backup workspace', category: 'system' },
  { method: 'POST', path: '/api/workspace/restore', slug: 'workspace_restore', description: 'Restore workspace', category: 'system' },

  // Version
  { method: 'GET', path: '/api/version/diff', slug: 'version_diff', description: 'Get version diff', category: 'system' },
]

export function registerRouterCapabilities(
  registry: UnifiedCapabilityRegistry,
  port: number,
): { registered: number; skipped: number } {
  const baseUrl = `http://localhost:${port}`
  let registered = 0
  let skipped = 0

  for (const ep of ROUTER_ENDPOINTS) {
    // Skip if a capability with this apiEndpoint already exists
    const existing = registry.list({ surface: 'api' }) as UnifiedCapability[]
    const alreadyExists = existing.some(
      (c) =>
        c.apiEndpoint &&
        c.apiEndpoint.method === ep.method &&
        c.apiEndpoint.path === ep.path,
    )
    if (alreadyExists) {
      skipped++
      continue
    }

    // Convert path :param to CLI-friendly name
    const cliName = pathToCliName(ep.slug)

    const cap = makeCapability(
      {
        id: `router:${ep.slug}`,
        slug: ep.slug,
        name: ep.description,
        description: ep.description,
        category: ep.category,
        surfaces: ep.surfaces ?? ['cli', 'api', 'mcp'],
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object' },
        cliCommand: {
          name: cliName,
          aliases: [],
          examples: [`vivim ${cliName}`],
        },
        apiEndpoint: { method: ep.method, path: ep.path },
        tags: ['router-bridge', 'auto-generated'],
      },
      // Handler: proxy to self (the running server)
      async (input) => {
        let url = `${baseUrl}${ep.path}`
        // Replace :param placeholders with input values
        const paramNames: string[] = []
        const regexStr = ep.path
          .replace(/:([^/]+)/g, (_, name) => {
            paramNames.push(name)
            return '([^/]+)'
          })
        // Merge path params and query params
        const merged = { ...input }
        for (const name of paramNames) {
          if (merged[name] !== undefined) {
            url = url.replace(`:${name}`, String(merged[name]))
            delete merged[name]
          }
        }
        // Append remaining as query params for GET
        const qp = new URLSearchParams()
        for (const [k, v] of Object.entries(merged)) {
          if (v !== undefined) qp.set(k, String(v))
        }
        const queryStr = qp.toString()
        if (queryStr && ep.method === 'GET') url += `?${queryStr}`

        const opts: RequestInit = {
          method: ep.method,
          headers: { 'Content-Type': 'application/json', 'X-Source': 'capability-bridge' },
        }
        if (ep.method !== 'GET' && ep.method !== 'HEAD') {
          opts.body = JSON.stringify(merged)
        }
        const resp = await fetch(url, opts)
        const data = await resp.json()
        if (!resp.ok) {
          return { ok: false, status: resp.status, ...data }
        }
        return { ok: true, ...data }
      },
    )

    try {
      registry.register(cap)
      registered++
    } catch {
      skipped++
    }
  }

  log.info(
    `[router-bridge] Registered ${registered} router capabilities${skipped > 0 ? ` (${skipped} skipped — already exist)` : ''}`,
  )
  return { registered, skipped }
}

/** Convert a slug like 'canvas_list_definitions' to a CLI name like 'canvas list definitions'. */
function pathToCliName(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/([a-z])([0-9])/g, '$1 $2')
}
