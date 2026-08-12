// src/engines/kernel/kernel-bootstrap.ts
// KernelBootstrap — wires the kernel into the server bootstrap.
// Creates kernel, registers all engines/stores/capabilities/routes, and
// registers the NLCL (Natural Language Command Layer) as a first-class kernel citizen.

import { ulid } from '../../ids.js'
import { catchDebug } from '../../lib/catch-logger.js'
import type { ConfigStore } from '../../storage/contracts/config-store.js'
import type { KernelStore } from '../../storage/contracts/kernel-store.js'
import type { CapStoreDb } from '../../storage/db.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import { ConfigManager } from '../config-manager.js'
import type { ConversationManager } from '../conversation-manager.js'
import type { NLCLEngine } from '../nlcl/nlcl-engine.js'
import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import {
  ConsoleKernelLogger,
  type Kernel,
  type KernelContext,
  createKernel,
} from './kernel-context.js'
import { KernelProvenance } from './kernel-provenance.js'
import { KernelRegistry } from './kernel-registry.js'
import { KernelTracer } from './kernel-tracer.js'
import { OracleActuator } from './oracle-actuator.js'
import { OracleDiagnosticEngine } from './oracle-diagnostic.js'
import { OracleEventStream } from './oracle-event-stream.js'
import { OracleQueryEngine } from './oracle-query.js'

export interface KernelBootstrapDeps {
  eventBus: CapabilityEventBus
  store?: KernelStore
  db?: CapStoreDb
  governor?: ChromeGovernor
  conversationManager?: ConversationManager
  registry?: UnifiedCapabilityRegistry
  nlclEngine?: NLCLEngine
}

function createInMemoryConfigStore(): ConfigStore {
  const entries = new Map<string, ConfigEntry>()
  return {
    async getConfigEntry(engineId, scopeType, scopeId) {
      const key = `${engineId}:${scopeType}:${scopeId ?? 'null'}`
      return entries.get(key) ?? null
    },
    async upsertConfigEntry(engineId, scopeType, scopeId, configJson, schemaVersion) {
      const key = `${engineId}:${scopeType}:${scopeId ?? 'null'}`
      const now = Date.now()
      const existing = entries.get(key)
      const row = {
        id: existing?.id ?? ulid(),
        engineId,
        scopeType,
        scopeId,
        configJson,
        schemaVersion,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      entries.set(key, row)
      return row
    },
    async insertConfigAudit(row) {
      return { ...row, id: ulid() }
    },
    async getConfigAuditHistory() {
      return []
    },
    async getConfigEntryById(id) {
      for (const [, entry] of entries) {
        if (entry.id === id) return entry
      }
      return null
    },
  }
}

interface ConfigEntry {
  id: string
  engineId: string
  scopeType: string
  scopeId: string | null
  configJson: string
  schemaVersion: number
  createdAt: number
  updatedAt: number
}

export function bootstrapKernel(deps: KernelBootstrapDeps): Kernel {
  const registry = new KernelRegistry()
  const tracer = new KernelTracer({ store: deps.store })
  const provenance = new KernelProvenance({ store: deps.store })
  const config = new ConfigManager(createInMemoryConfigStore(), { emit: () => {} })
  const logger = new ConsoleKernelLogger()

  const kernel = createKernel({
    registry,
    tracer,
    provenance,
    eventBus: deps.eventBus,
    config,
    store: deps.store,
    logger,
  })

  // ── Register all engines with the kernel ────────────────────────────────

  if (deps.governor) {
    registry.registerEngine({
      id: 'chrome-governor',
      kind: 'engine',
      layer: 'chrome',
      dependencies: [],
      status: 'registered',
      config: {},
      metadata: { description: 'Chrome browser lifecycle + CDP proxy' },
    })
  }

  if (deps.conversationManager) {
    registry.registerEngine({
      id: 'conversation-manager',
      kind: 'engine',
      layer: 'conversation',
      dependencies: ['chrome-governor'],
      status: 'registered',
      config: {},
      metadata: { description: '8-step send pipeline orchestrator' },
    })
  }

  if (deps.registry) {
    registry.registerEngine({
      id: 'unified-registry',
      kind: 'engine',
      layer: 'capability',
      dependencies: [],
      status: 'registered',
      config: {},
      metadata: { description: 'Unified capability registry (CLI/UI/MCP/API)' },
    })
  }

  // ── Register NLCL as a first-class kernel citizen ───────────────────────
  // The NLCL is the "comms system" — it's how users talk to the entire platform.
  if (deps.nlclEngine) {
    registry.registerEngine({
      id: 'nlcl-engine',
      kind: 'engine',
      layer: 'comms',
      dependencies: ['chrome-governor', 'conversation-manager', 'unified-registry'],
      status: 'registered',
      config: {
        resolver: 'deterministic',
        aiFallback: true,
        commandCount: deps.nlclEngine.listCommands().length,
      },
      metadata: {
        description: 'Natural Language Command Layer — the comms system',
        surfaces: ['cli', 'ui', 'frontend', 'mcp', 'api'],
      },
    })

    // Register NLCL command patterns as capabilities
    const commands = deps.nlclEngine.listCommands()
    for (const cmd of commands) {
      registry.registerCapability({
        id: `nlcl:${cmd.id}`,
        kind: 'capability',
        layer: 'comms',
        dependencies: ['nlcl-engine'],
        status: 'registered',
        config: {
          intent: cmd.intent,
          executor: cmd.executor,
          category: cmd.category,
        },
        metadata: {
          description: cmd.description,
          examples: cmd.examples,
          aliases: cmd.aliases,
        },
      })
    }

    logger.info('NLCL registered with kernel', {
      commands: commands.length,
      categories: Object.keys(deps.nlclEngine.getHelp().categories).length,
    })
  }

  // ── Register stores ─────────────────────────────────────────────────────
  if (deps.db) {
    registry.registerStore({
      id: 'capstore-db',
      kind: 'store',
      layer: 'storage',
      dependencies: [],
      status: 'running',
      config: {},
      metadata: { description: 'Primary database (Prisma/SQLite)' },
    })
  }

  // ── Register routes ─────────────────────────────────────────────────────
  const routes = [
    { id: 'route:conversations', path: '/api/conversations' },
    { id: 'route:setup', path: '/api/setup' },
    { id: 'route:knowledge', path: '/api/knowledge' },
    { id: 'route:mux', path: '/api/route' },
    { id: 'route:autonomous', path: '/api/autonomous' },
    { id: 'route:nlcl', path: '/api/nlcl' },
    { id: 'route:health', path: '/health' },
    { id: 'route:websocket', path: '/ws' },
  ]

  for (const route of routes) {
    registry.registerRoute({
      id: route.id,
      kind: 'route',
      layer: 'api',
      dependencies: [],
      status: 'running',
      config: { path: route.path },
      metadata: {},
    })
  }

  logger.info('kernel bootstrap complete', {
    engines: registry.describe().engines.length,
    capabilities: registry.describe().capabilities.length,
    routes: registry.describe().routes.length,
  })

  // ── Construct Kernel Oracle (Phase 15) ───────────────────────────────────
  const diagnostic = new OracleDiagnosticEngine(registry, deps.store ?? null)
  const query = new OracleQueryEngine(registry, tracer, provenance, config)
  const actuator = new OracleActuator(registry, diagnostic, deps.store ?? null, deps.eventBus)
  const events = new OracleEventStream(diagnostic, actuator, registry, deps.eventBus)

  // Register ChromeGovernor as a reconnectable engine so the oracle's
  // `reconnect` heal action triggers real slave re-launch.
  if (deps.governor) {
    actuator.registerReconnectable('chrome-governor', {
      reconnect: async (providerId: string) => {
        // Kill any errored slave for this provider, then relaunch.
        const governor = deps.governor
        if (!governor) return
        const slaves = governor.getAllSlaves({ providerId })
        for (const slave of slaves) {
          if (slave.status === 'error') {
            await governor.kill(slave.slaveId).catch(() => {})
  // [audit] log the error with context here
          }
        }
        await governor.launch(providerId)
      },
    })
  }

  kernel.context().oracle = { query, diagnostic, actuator, events }

  // Register oracle engines as first-class kernel citizens.
  const oracleEngines: Array<{ id: string; description: string }> = [
    { id: 'oracle-query', description: 'Structured system-state queries' },
    { id: 'oracle-diagnostic', description: 'Problem detection (stubs, wires, health)' },
    { id: 'oracle-actuator', description: 'Self-healing corrective actions' },
    { id: 'oracle-event-stream', description: 'Real-time oracle event broadcast' },
  ]
  for (const oe of oracleEngines) {
    registry.registerEngine({
      id: oe.id,
      kind: 'engine',
      layer: 'oracle',
      dependencies: ['kernel'],
      status: 'running',
      config: {},
      metadata: { description: oe.description },
    })
  }

  // ── Background diagnostic-to-healing loop ────────────────────────────────
  // Periodically scan for issues and auto-heal what the policy allows.
  // Runs every 60s; the interval is stopped when `stopKernelDiagnosticLoop()`
  // is called (e.g. on server shutdown).
  const DIAGNOSTIC_INTERVAL_MS = 60_000
  let diagnosticTimer: ReturnType<typeof setInterval> | null = null
  diagnosticTimer = setInterval(() => {
    void (async () => {
      try {
        const issues = await diagnostic.scan()
        if (issues.length > 0) {
          const healed = await actuator.autoHeal(issues)
          if (healed.length > 0) {
            logger.info('oracle auto-heal cycle', {
              issuesDetected: issues.length,
              actionsExecuted: healed.length,
            })
          }
        }
      } catch (err) {
        catchDebug(err, 'engines:kernel:kernel-bootstrap:299')
        // Diagnostic loop must never crash the server.
      }
    })()
  }, DIAGNOSTIC_INTERVAL_MS)

  // Attach stop function to kernel for graceful shutdown.
  const origStop = kernel.stop.bind(kernel)
  kernel.stop = async () => {
    if (diagnosticTimer) {
      clearInterval(diagnosticTimer)
      diagnosticTimer = null
    }
    await origStop()
  }

  return kernel
}

export type { Kernel, KernelContext }
