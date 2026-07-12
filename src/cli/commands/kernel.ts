// src/cli/commands/kernel.ts
// vivim kernel CLI commands — oracle + config surface for the kernel system.

import { z } from 'zod'
import type { SystemQueryType } from '../../engines/kernel/oracle-query.js'
import type { CommandRegistry } from '../command-registry.js'
import type { ServerContext } from '../../server/index.js'
import type { ConfigUniversalSurface } from '../../engines/config-universal-surface.js'
import type { OracleQueryEngine } from '../../engines/kernel/oracle-query.js'

// Cast op to SystemQueryType for the query engine
function asQueryType(op: string): SystemQueryType {
  if (op === 'health' || op === 'topology' || op === 'capability' || op === 'config' || op === 'all') {
    return op as SystemQueryType
  }
  return 'all'
}

export function registerKernelCommands(
  registry: CommandRegistry,
  ctx: { kernel: ServerContext['kernel']; configSurface?: ConfigUniversalSurface },
): void {
  // vivim kernel oracle query
  registry.register({
    name: 'kernel oracle query',
    description: 'Query kernel oracle (health, topology, capabilities, config, all)',
    subsystem: 'backend',
    schema: z.object({
      op: z.enum(['health', 'topology', 'capability', 'config', 'all']).optional(),
      filter: z.record(z.unknown()).optional(),
      limit: z.number().int().positive().optional(),
    }),
    examples: [
      'kernel oracle query --op health',
      'kernel oracle query --op topology',
      'kernel oracle query --op all --limit 10',
    ],
    handler: async (raw) => {
      const args = raw as { op?: string; filter?: Record<string, unknown>; limit?: number }
      const op = asQueryType(args.op ?? 'all')

      if (!ctx.kernel?.context()?.oracle?.query) {
        return { data: { error: 'Oracle not available' } }
      }

      const result = await (ctx.kernel.context()!.oracle!.query as OracleQueryEngine).query({
        type: op,
        filter: args.filter,
        limit: args.limit,
      })
      return { data: result }
    },
  })

  // vivim kernel oracle heal
  registry.register({
    name: 'kernel oracle heal',
    description: 'Trigger oracle self-healing for an issue',
    subsystem: 'backend',
    schema: z.object({
      issueId: z.string(),
    }),
    examples: ['kernel oracle heal --issueId issue:123'],
    handler: async (raw) => {
      const args = raw as { issueId: string }
      const issueId = args.issueId

      if (!ctx.kernel?.context()?.oracle?.actuator) {
        return { data: { error: 'Actuator not available' } }
      }

      const result = await ctx.kernel.context()!.oracle!.actuator!.heal(issueId)
      return { data: result }
    },
  })

  // vivim kernel oracle scan
  registry.register({
    name: 'kernel oracle scan',
    description: 'Scan system for issues',
    subsystem: 'backend',
    schema: z.object({}),
    examples: ['kernel oracle scan'],
    handler: async () => {
      if (!ctx.kernel?.context()?.oracle?.diagnostic) {
        return { data: { error: 'Diagnostic not available' } }
      }
      const result = await ctx.kernel.context()!.oracle!.diagnostic!.scan()
      return { data: result }
    },
  })

  // vivim kernel oracle events
  registry.register({
    name: 'kernel oracle events',
    description: 'Get recent oracle events',
    subsystem: 'backend',
    schema: z.object({
      tail: z.number().int().positive().optional(),
    }),
    examples: ['kernel oracle events --tail 10'],
    handler: async (raw) => {
      const args = raw as { tail?: number }
      if (!ctx.kernel?.context()?.oracle?.events) {
        return { data: { error: 'Events not available' } }
      }
      const events = await ctx.kernel.context()!.oracle!.events!.getRecentEvents(args.tail ?? 50)
      return { data: events }
    },
  })

  // vivim kernel oracle visibility
  registry.register({
    name: 'kernel oracle visibility',
    description: 'Get oracle visibility snapshot',
    subsystem: 'backend',
    schema: z.object({}),
    examples: ['kernel oracle visibility'],
    handler: async () => {
      if (!ctx.kernel?.context()?.oracle?.query) {
        return { data: { error: 'Query not available' } }
      }
      const result = await (ctx.kernel.context()!.oracle!.query as OracleQueryEngine).query({ type: 'all' })
      return { data: result }
    },
  })

  // vivim kernel oracle manifest
  registry.register({
    name: 'kernel oracle manifest',
    description: 'Get canvas manifest from oracle',
    subsystem: 'backend',
    schema: z.object({}),
    examples: ['kernel oracle manifest'],
    handler: async () => {
      if (!ctx.kernel?.context()?.registry) {
        return { data: { error: 'Registry not available' } }
      }
      return { data: { manifest: ctx.kernel.context()!.registry!.describe() } }
    },
  })

  // vivim kernel config list
  registry.register({
    name: 'kernel config list',
    description: 'List all config scopes',
    subsystem: 'backend',
    schema: z.object({}),
    examples: ['kernel config list'],
    handler: async () => {
      if (!ctx.configSurface) {
        return { data: { error: 'Config surface not available' } }
      }
      const scopes = ctx.configSurface.listScopes()
      return { data: scopes }
    },
  })

  // vivim kernel config get
  registry.register({
    name: 'kernel config get',
    description: 'Get a config value (scope.key format)',
    subsystem: 'backend',
    schema: z.object({
      key: z.string(),
    }),
    examples: ['kernel config get autoheal.stalledEngineRestart.enabled'],
    handler: async (raw) => {
      const args = raw as { key: string }
      if (!ctx.configSurface) {
        return { data: { error: 'Config surface not available' } }
      }
      const [scope, key] = args.key.split('.')
      if (!scope || !key) {
        throw new Error('Usage: kernel config get <scope>.<key>')
      }
      const value = ctx.configSurface.get(scope, key)
      return { data: value }
    },
  })

  // vivim kernel config set
  registry.register({
    name: 'kernel config set',
    description: 'Set a config value (scope.key value format)',
    subsystem: 'backend',
    schema: z.object({
      key: z.string(),
      value: z.unknown(),
    }),
    examples: ['kernel config set autoheal.stalledEngineRestart.enabled true'],
    handler: async (raw) => {
      const args = raw as { key: string; value: unknown }
      if (!ctx.configSurface) {
        return { data: { error: 'Config surface not available' } }
      }
      const [scope, key] = args.key.split('.')
      if (!scope || !key) {
        throw new Error('Usage: kernel config set <scope>.<key> <value>')
      }
      const result = ctx.configSurface.set(scope, key, args.value)
      return { data: result }
    },
  })

  // vivim kernel config snapshot
  registry.register({
    name: 'kernel config snapshot',
    description: 'Create a config snapshot',
    subsystem: 'backend',
    schema: z.object({}),
    examples: ['kernel config snapshot'],
    handler: async () => {
      if (!ctx.configSurface) {
        return { data: { error: 'Config surface not available' } }
      }
      const id = ctx.configSurface.snapshot()
      return { data: { id } }
    },
  })

  // vivim kernel config rollback
  registry.register({
    name: 'kernel config rollback',
    description: 'Rollback to a config snapshot',
    subsystem: 'backend',
    schema: z.object({
      id: z.string(),
    }),
    examples: ['kernel config rollback --id snap:1234567890:1'],
    handler: async (raw) => {
      const args = raw as { id: string }
      if (!ctx.configSurface) {
        return { data: { error: 'Config surface not available' } }
      }
      ctx.configSurface.rollback(args.id)
      return { data: { ok: true, rolledBack: args.id } }
    },
  })
}