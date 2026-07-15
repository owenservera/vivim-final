// src/engines/nlcl/executors/system-executor.ts
// SystemExecutor — system-level commands (health, status, config, providers, fleet).

import { newId } from '../../../ids.js'
import type { CapStoreDb } from '../../../storage/db.js'
import type { ChromeGovernor } from '../../chrome-governor.js'
import type { UnifiedCapabilityRegistry } from '../../unified-registry.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../types.js'

export class SystemExecutor implements CommandExecutor {
  readonly id = 'system' as const

  constructor(
    private db?: CapStoreDb,
    private governor?: ChromeGovernor,
    private registry?: UnifiedCapabilityRegistry,
  ) {}

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    try {
      switch (intent.intent) {
        case 'system.health':
          return await this.health(intent, traceId, start)
        case 'system.providers':
          return await this.listProviders(intent, traceId, start)
        case 'system.fleet':
          return await this.fleetStatus(intent, traceId, start)
        case 'system.capabilities':
          return await this.listCapabilities(intent, traceId, start)
        case 'system.version':
          return {
            ok: true,
            intent: intent.intent,
            output: { version: '1.0.0', uptime: process.uptime() },
            text: `vivim v1.0.0 (uptime: ${Math.round(process.uptime())}s)`,
            latencyMs: Date.now() - start,
            traceId,
            classification: 'system',
          }
        case 'system.workspace':
          return {
            ok: true,
            intent: intent.intent,
            output: { workspace: ctx.workspacePath ?? process.cwd() },
            text: `Workspace: ${ctx.workspacePath ?? process.cwd()}`,
            latencyMs: Date.now() - start,
            traceId,
            classification: 'system',
          }
        default:
          return this.fail(intent, traceId, start, `Unknown system intent: ${intent.intent}`)
      }
    } catch (err) {
      return this.fail(intent, traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  private async health(
    intent: ParsedIntent,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const memUsage = process.memoryUsage()
    return {
      ok: true,
      intent: intent.intent,
      output: {
        status: 'ok',
        uptime: process.uptime(),
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
      },
      text: 'System healthy',
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }

  private async listProviders(
    intent: ParsedIntent,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    if (!this.db) {
      return this.fail(intent, traceId, start, 'Database not available')
    }
    const providers = await this.db.prisma.providerDefinition.findMany({
      select: { id: true, slug: true, displayName: true },
    })
    const providerList = providers.map((p) => `${p.slug} (${p.displayName})`).join(', ')
    return {
      ok: true,
      intent: intent.intent,
      output: { providers, count: providers.length },
      text:
        providers.length > 0 ? `Available providers: ${providerList}` : 'No providers registered',
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }

  private async fleetStatus(
    intent: ParsedIntent,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    if (!this.governor) {
      return this.fail(intent, traceId, start, 'Governor not available')
    }
    const slaves = this.governor.getAllSlaves()
    return {
      ok: true,
      intent: intent.intent,
      output: { slaves, count: slaves.length },
      text:
        slaves.length > 0 ? `${slaves.length} Chrome slave(s) running` : 'No Chrome slaves running',
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }

  private async listCapabilities(
    intent: ParsedIntent,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    if (!this.registry) {
      return this.fail(intent, traceId, start, 'Registry not available')
    }
    const caps = this.registry.list()
    return {
      ok: true,
      intent: intent.intent,
      output: {
        capabilities: caps.map((c) => ({ slug: c.slug, name: c.name, category: c.category })),
        count: caps.length,
      },
      text: `${caps.length} capabilities registered`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }

  private fail(intent: ParsedIntent, traceId: string, start: number, error: string): CommandResult {
    return {
      ok: false,
      intent: intent.intent,
      error,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }
}
