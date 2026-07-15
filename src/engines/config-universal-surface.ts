// src/engines/config-universal-surface.ts
// ConfigUniversalSurface — unified configuration interface for ALL system points.
// One surface, all scopes: engine, capability, store, route, autoheal, nlcl,
// stealth, provider, workflow, canvas:layer, kernel:topology, telemetry.

import { z } from 'zod'
import { EngineError } from '../errors.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { ConfigManager } from './config-manager.js'
import type { Kernel } from './kernel/kernel-context.js'
import type { TelemetryAggregator } from './telemetry-aggregator.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface ConfigScope {
  id: string
  description: string
  schema?: z.ZodSchema
  source: string
}

export interface ConfigValue {
  scope: string
  key: string
  value: unknown
  updatedAt: number
}

// Default schemas for each scope
const AUTOHEAL_SCHEMA = z.object({
  stalledEngineRestart: z.object({
    enabled: z.boolean(),
    maxAgeMinutes: z.number().int().positive(),
    backoffMs: z.number().int().positive(),
  }),
  healthDecayRestart: z.object({
    enabled: z.boolean(),
    decayThreshold: z.number().int().positive(),
    minHealth: z.number().min(0).max(1),
    cooldownMinutes: z.number().int().positive(),
  }),
})

const NLCL_SCHEMA = z.object({
  resolver: z.string(),
  aiFallback: z.boolean(),
  confidenceThreshold: z.number().min(0).max(1),
})

const STEALTH_SCHEMA = z.object({
  enabled: z.boolean(),
  sessionTimeoutMinutes: z.number().int().positive(),
  autoClear: z.boolean(),
})

// ── ConfigUniversalSurface ───────────────────────────────────────────────

export class ConfigUniversalSurface {
  private snapshots = new Map<string, Map<string, unknown>>()
  private snapshotCounter = 0

  constructor(
    private deps: {
      registry: UnifiedCapabilityRegistry
      kernel?: Kernel
      configManager: ConfigManager
      configStore?: import('../storage/contracts/config-store.js').ConfigStore
      telemetry?: TelemetryAggregator
      eventBus: CapabilityEventBus
    },
  ) {}

  // List all 12 config scopes
  listScopes(): ConfigScope[] {
    return [
      { id: 'engine', description: 'Engine configuration points', source: 'KernelRegistry' },
      {
        id: 'capability',
        description: 'Capability configuration points',
        source: 'UnifiedCapabilityRegistry',
      },
      { id: 'store', description: 'Store configuration points', source: 'ConfigStore' },
      { id: 'route', description: 'Route configuration points', source: 'RouteRegistry' },
      {
        id: 'autoheal',
        description: 'AutoHealPolicy for OracleActuator',
        source: 'OracleActuator',
        schema: AUTOHEAL_SCHEMA,
      },
      {
        id: 'nlcl',
        description: 'NLCL resolver configuration',
        source: 'NLCLEngine',
        schema: NLCL_SCHEMA,
      },
      {
        id: 'stealth',
        description: 'Stealth profile configuration',
        source: 'StealthManager',
        schema: STEALTH_SCHEMA,
      },
      { id: 'provider', description: 'Provider definition fields', source: 'ProviderRegistrar' },
      { id: 'workflow', description: 'Workflow DAG definition', source: 'WorkflowEngine' },
      {
        id: 'canvas:layer',
        description: 'Canvas layer definition bindings',
        source: 'CanvasRegistry',
      },
      { id: 'kernel:topology', description: 'Live kernel topology', source: 'KernelRegistry' },
      { id: 'telemetry', description: 'Telemetry pipeline config', source: 'TelemetryAggregator' },
    ]
  }

  // Get a config value by scope.key
  get(scope: string, key: string): ConfigValue | null {
    const cacheKey = `${scope}:${key}`
    const cached = this.snapshots.get('current')?.get(cacheKey)
    return cached
      ? { scope, key, value: cached, updatedAt: Date.now() }
      : { scope, key, value: null, updatedAt: 0 }
  }

  // Set a config value (Zod-validated for known scopes)
  set(scope: string, key: string, value: unknown): ConfigValue {
    // Validate against schema if available
    const scopeInfo = this.listScopes().find((s) => s.id === scope)
    if (scopeInfo?.schema) {
      try {
        scopeInfo.schema.parse(value)
      } catch (err) {
        throw new EngineError(
          `Invalid config value for ${scope}.${key}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }

    // Store the value
    if (!this.snapshots.has('current')) {
      this.snapshots.set('current', new Map())
    }
    this.snapshots.get('current')?.set(`${scope}:${key}`, value)

    // Emit config:changed on event bus
    this.deps.eventBus.emit({
      type: 'config:changed',
      engineId: scope,
      actor: 'cli',
      ...(value as Record<string, unknown>),
    })

    return { scope, key, value, updatedAt: Date.now() }
  }

  // Snapshot current config state
  snapshot(): string {
    const id = `snap:${Date.now()}:${++this.snapshotCounter}`
    const current = new Map(this.snapshots.get('current'))
    this.snapshots.set(id, current)
    return id
  }

  // Rollback to a previous snapshot
  rollback(id: string): void {
    const snapshot = this.snapshots.get(id)
    if (!snapshot) {
      throw new EngineError(`Snapshot ${id} not found`)
    }
    this.snapshots.set('current', snapshot)
  }
}
