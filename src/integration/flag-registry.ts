// src/integration/flag-registry.ts
// Feature flag registry for Chrome Slave Architecture integration.
// Phase 12: Flags control which subsystems are active during migration.

import { getLogger } from '../observability/logger.js'

// ── Flag Types ──────────────────────────────────────────────────────────────

export interface IntegrationFlags {
  /** Phase 1: Observability (tracing, metrics, logger) — safe, always on */
  PHASE_1_OBSERVABILITY: boolean
  /** Phase 2: BrowserRuntime, Domain Layer, SlaveStateStore */
  PHASE_2_RUNTIME: boolean
  /** Phase 3: Actor Model (Mailbox, BrowserActor, ActorSupervisor) */
  PHASE_3_ACTOR: boolean
  /** Phase 4: Browser Pooling (warm spawn, Lease management) */
  PHASE_4_POOL: boolean
  /** Phase 5: Resource-Class Scheduler (6 classes, weighted round-robin) */
  PHASE_5_SCHEDULER: boolean
  /** Phase 6: Adaptive Resource Manager (PressureFeed, AdaptiveLimiter, GpuAllocator) */
  PHASE_6_RESOURCE: boolean
  /** Phase 7: Event Bus (typed pub/sub, DB projection) — safe, additive */
  PHASE_7_EVENTS: boolean
  /** Phase 8: Provider Platform (ProviderPlugin interface, registry) */
  PHASE_8_PROVIDERS: boolean
  /** Phase 9: Reliability (FailureClassifier, RecoveryOrchestrator, EventStore) */
  PHASE_9_RECOVERY: boolean
  /** Phase 10: Scale-Out (FleetManager, WorkerNode, RemoteCdp) */
  PHASE_10_FLEET: boolean
  /** Phase 12: Legacy Removal (remove old code paths) */
  PHASE_12_LEGACY_REMOVAL: boolean

  /** Run both old and new paths, return new path result */
  PARALLEL_MODE: boolean
  /** Run new path but discard result, return old path result (for comparison) */
  SHADOW_MODE: boolean
}

export type FlagName = keyof IntegrationFlags

// ── Flag Dependencies ───────────────────────────────────────────────────────

const FLAG_DEPENDENCIES: Record<FlagName, FlagName[]> = {
  PHASE_1_OBSERVABILITY: [],
  PHASE_7_EVENTS: [],
  PHASE_2_RUNTIME: ['PHASE_1_OBSERVABILITY'],
  PHASE_3_ACTOR: ['PHASE_2_RUNTIME'],
  PHASE_4_POOL: ['PHASE_2_RUNTIME', 'PHASE_3_ACTOR'],
  PHASE_6_RESOURCE: ['PHASE_1_OBSERVABILITY', 'PHASE_7_EVENTS'],
  PHASE_5_SCHEDULER: ['PHASE_6_RESOURCE'],
  PHASE_8_PROVIDERS: ['PHASE_1_OBSERVABILITY', 'PHASE_7_EVENTS'],
  PHASE_9_RECOVERY: ['PHASE_7_EVENTS', 'PHASE_2_RUNTIME'],
  PHASE_10_FLEET: ['PHASE_9_RECOVERY', 'PHASE_4_POOL'],
  PHASE_12_LEGACY_REMOVAL: [], // Manual gate, no auto-dependencies
  PARALLEL_MODE: [],
  SHADOW_MODE: [],
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_FLAGS: IntegrationFlags = {
  PHASE_1_OBSERVABILITY: true,  // safe, always on
  PHASE_2_RUNTIME: false,
  PHASE_3_ACTOR: false,
  PHASE_4_POOL: false,
  PHASE_5_SCHEDULER: false,
  PHASE_6_RESOURCE: false,
  PHASE_7_EVENTS: true,         // safe, additive
  PHASE_8_PROVIDERS: false,
  PHASE_9_RECOVERY: false,
  PHASE_10_FLEET: false,
  PHASE_12_LEGACY_REMOVAL: false,
  PARALLEL_MODE: true,
  SHADOW_MODE: false,
}

// ── Flag Registry ───────────────────────────────────────────────────────────

export class FlagRegistry {
  private flags: IntegrationFlags
  private logger = getLogger('FlagRegistry')
  private overrides = new Map<FlagName, boolean>()

  constructor(envPrefix = 'CHROME_') {
    this.flags = { ...DEFAULT_FLAGS }
    this.loadFromEnv(envPrefix)
    this.validateDependencies()
  }

  /**
   * Get a flag value.
   */
  get(name: FlagName): boolean {
    return this.flags[name]
  }

  /**
   * Set a flag override (takes precedence over env).
   */
  set(name: FlagName, value: boolean): void {
    this.overrides.set(name, value)
    this.flags[name] = value
    this.logger.info('Flag overridden', { name, value })
  }

  /**
   * Get all flags as a snapshot.
   */
  getAll(): Readonly<IntegrationFlags> {
    return { ...this.flags }
  }

  /**
   * Check if a phase is enabled.
   */
  isPhaseEnabled(phase: number): boolean {
    const phaseMap: Record<number, FlagName> = {
      1: 'PHASE_1_OBSERVABILITY',
      2: 'PHASE_2_RUNTIME',
      3: 'PHASE_3_ACTOR',
      4: 'PHASE_4_POOL',
      5: 'PHASE_5_SCHEDULER',
      6: 'PHASE_6_RESOURCE',
      7: 'PHASE_7_EVENTS',
      8: 'PHASE_8_PROVIDERS',
      9: 'PHASE_9_RECOVERY',
      10: 'PHASE_10_FLEET',
      12: 'PHASE_12_LEGACY_REMOVAL',
    }
    const flagName = phaseMap[phase]
    return flagName ? this.flags[flagName] : false
  }

  /**
   * Check if shadow mode is active (new path runs but result discarded).
   */
  isShadowMode(): boolean {
    return this.flags.SHADOW_MODE
  }

  /**
   * Check if parallel mode is active (both paths run).
   */
  isParallelMode(): boolean {
    return this.flags.PARALLEL_MODE
  }

  /**
   * Get flags that are enabled.
   */
  getEnabledFlags(): FlagName[] {
    return (Object.keys(this.flags) as FlagName[]).filter((k) => this.flags[k])
  }

  /**
   * Get a summary of enabled phases.
   */
  getSummary(): string {
    const enabled = this.getEnabledFlags()
    return `Enabled: ${enabled.join(', ')}`
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private loadFromEnv(prefix: string): void {
    for (const key of Object.keys(DEFAULT_FLAGS) as FlagName[]) {
      const envKey = `${prefix}${key}`
      const envVal = process.env[envKey]
      if (envVal !== undefined) {
        const boolVal = envVal === 'true' || envVal === '1'
        this.flags[key] = boolVal
        this.logger.debug('Loaded flag from env', { key: envKey, value: boolVal })
      }
    }
  }

  private validateDependencies(): void {
    for (const [flag, deps] of Object.entries(FLAG_DEPENDENCIES) as [FlagName, FlagName[]][]) {
      if (!this.flags[flag]) continue
      for (const dep of deps) {
        if (!this.flags[dep]) {
          this.logger.warn('Flag dependency not met', { flag, dependency: dep })
          // Auto-enable dependency
          this.flags[dep] = true
          this.logger.info('Auto-enabled dependency', { flag: dep })
        }
      }
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let instance: FlagRegistry | null = null

export function getFlagRegistry(): FlagRegistry {
  if (!instance) {
    instance = new FlagRegistry()
  }
  return instance
}

export function initFlagRegistry(prefix?: string): FlagRegistry {
  instance = new FlagRegistry(prefix)
  return instance
}
