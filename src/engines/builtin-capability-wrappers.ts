// src/engines/builtin-capability-wrappers.ts
// --------------------------------------------------------------------------
// F7 fix: Wraps legacy CLI builtins (automate, moments, seed, migrate)
// as UnifiedCapabilities so they are reachable via the registry,
// universal API dispatcher, and MCP — not just the raw CLI.

import { getLogger } from '../lib/logger.js'
import { makeCapability } from './capability-bootstrap.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

const log = getLogger('builtin-capability-wrappers')

const BUILTIN_SPECS = [
  {
    id: 'builtin:automate',
    slug: 'automate',
    name: 'Automate',
    description: 'Agent-driven frontend automation (navigate, click, type, screenshot)',
    category: 'automation',
    surfaces: ['cli', 'api', 'mcp'],
    apiEndpoint: { method: 'POST', path: '/api/automate' },
    cliCommand: {
      name: 'automate',
      aliases: ['auto'],
      examples: ['automate navigate http://localhost:5173'],
    },
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Automation subcommand and arguments',
        },
      },
      required: ['args'],
    },
  },
  {
    id: 'builtin:moments',
    slug: 'moments',
    name: 'Moments',
    description: 'User-journey moments — provider account setup workflows',
    category: 'admin',
    surfaces: ['cli', 'api', 'mcp'],
    apiEndpoint: { method: 'POST', path: '/api/moments' },
    cliCommand: {
      name: 'moments',
      aliases: ['moment'],
      examples: ['moments list', 'moments health'],
    },
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Moment subcommand and arguments',
        },
      },
      required: ['args'],
    },
  },
  {
    id: 'builtin:seed',
    slug: 'seed',
    name: 'Seed',
    description: 'Seed the database with initial data',
    category: 'admin',
    surfaces: ['cli', 'api', 'mcp'],
    apiEndpoint: { method: 'POST', path: '/api/seed' },
    cliCommand: { name: 'seed', aliases: [], examples: ['seed all'] },
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Seed targets (e.g. ["all"])',
        },
      },
    },
  },
  {
    id: 'builtin:migrate',
    slug: 'migrate',
    name: 'Migrate',
    description: 'Run database migrations',
    category: 'admin',
    surfaces: ['cli', 'api', 'mcp'],
    apiEndpoint: { method: 'POST', path: '/api/migrate' },
    cliCommand: { name: 'migrate', aliases: ['migration'], examples: ['migrate all'] },
    inputSchema: {
      type: 'object',
      properties: {
        args: { type: 'array', items: { type: 'string' }, description: 'Migration targets' },
      },
    },
  },
]

export function registerBuiltinCapabilities(registry: UnifiedCapabilityRegistry): number {
  let registered = 0
  for (const spec of BUILTIN_SPECS) {
    const cap = makeCapability(spec, async (input) => {
      // Import and delegate to the real builtin handler
      const { args = [] } = input as { args?: string[] }
      const slug = spec.slug
      try {
        let handler: (args: string[]) => Promise<unknown>
        switch (slug) {
          case 'automate':
            ;({ runAutomate: handler } = await import('../cli/commands/automate.js'))
            break
          case 'moments':
            ;({ runMoments: handler } = await import('../cli/commands/moments.js'))
            break
          case 'seed':
            ;({ runSeed: handler } = await import('../cli/commands/seed.js'))
            break
          case 'migrate':
            ;({ runMigrate: handler } = await import('../cli/commands/migrate.js'))
            break
          default:
            return { ok: false, error: `unknown builtin: ${slug}` }
        }
        await handler(args)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    })
    try {
      registry.register(cap)
      registered++
    } catch {
      // Already registered (e.g. from generated pool) — skip
    }
  }
  log.info(`[builtin-wrappers] Registered ${registered} builtin capabilities`)
  return registered
}
