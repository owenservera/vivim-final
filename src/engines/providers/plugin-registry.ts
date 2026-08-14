import { getLogger } from '../../observability/logger.js'
import type { CapabilityEventBus } from '../capability-event-bus.js'
import type {
  HealthCheckResult,
  ProviderCapabilityDescriptor,
  ProviderMetadata,
  ProviderPlugin,
  ProviderPluginFactory,
  ProviderPluginManifest,
} from './provider-plugin-interface.js'

export class ProviderPluginRegistry {
  private readonly plugins = new Map<string, ProviderPlugin>()
  private readonly factories = new Map<string, ProviderPluginFactory>()
  private healthResults = new Map<string, HealthCheckResult>()
  private initOrder: string[] = []
  private initialized = false
  private started = false
  private logger = getLogger('ProviderPluginRegistry')

  // ── Factory Registration ───────────────────────────────────────────────

  /**
   * Register a plugin factory (before init). The factory will be invoked
   * during initAll() to instantiate the plugin.
   */
  registerFactory(slug: string, factory: ProviderPluginFactory): void {
    if (this.factories.has(slug)) {
      this.logger.warn('Factory already registered, overwriting', { slug })
    }
    if (this.plugins.has(slug)) {
      this.logger.warn('Plugin already instantiated; factory will not be used until next init', {
        slug,
      })
    }
    this.factories.set(slug, factory)
    this.logger.info('Registered provider plugin factory', { slug })
  }

  /**
   * Register an already-instantiated plugin. The plugin will be included in
   * the next initAll() / startAll() cycle.
   */
  registerPlugin(plugin: ProviderPlugin): void {
    const slug = plugin.metadata.slug
    if (this.plugins.has(slug)) {
      this.logger.warn('Plugin already registered, overwriting', { slug })
    }
    this.plugins.set(slug, plugin)
    this.logger.info('Registered provider plugin', { slug, name: plugin.metadata.name })
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Initialize all registered plugins. Plugins registered via factory are
   * instantiated first (in registration order), then all plugins receive init().
   */
  async initAll(eventBus: CapabilityEventBus, config: Record<string, unknown>): Promise<void> {
    if (this.initialized) {
      this.logger.warn('initAll() called but plugins are already initialized')
      return
    }

    // Instantiate any pending factories
    for (const [slug, factory] of this.factories) {
      if (!this.plugins.has(slug)) {
        try {
          const plugin = factory()
          this.plugins.set(slug, plugin)
          this.logger.info('Instantiated plugin from factory', { slug })
        } catch (err) {
          this.logger.error('Failed to instantiate plugin from factory', {
            slug,
            error: String(err),
          })
        }
      }
    }

    // Initialize each plugin in registration order
    for (const [slug, plugin] of this.plugins) {
      try {
        const context = {
          eventBus,
          config,
          registerCapability: (descriptor: ProviderCapabilityDescriptor) => {
            this.logger.debug('Capability registered', {
              provider: slug,
              capability: descriptor.capabilityId,
            })
          },
          unregisterCapability: (capabilityId: string) => {
            this.logger.debug('Capability unregistered', {
              provider: slug,
              capability: capabilityId,
            })
          },
        }

        await plugin.init(context)
        this.initOrder.push(slug)
        this.logger.info('Initialized provider plugin', { slug })
      } catch (err) {
        this.logger.error('Failed to initialize provider plugin', { slug, error: String(err) })
      }
    }

    this.initialized = true
    this.logger.info('All provider plugins initialized', { count: this.plugins.size })
  }

  /**
   * Start all plugins (after init). Called in init order.
   */
  async startAll(): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('startAll() called before initAll()')
      return
    }
    if (this.started) {
      this.logger.warn('startAll() called but plugins are already started')
      return
    }

    for (const slug of this.initOrder) {
      const plugin = this.plugins.get(slug)
      if (!plugin) continue

      if (typeof plugin.start === 'function') {
        try {
          await plugin.start()
          this.logger.info('Started provider plugin', { slug })
        } catch (err) {
          this.logger.error('Failed to start provider plugin', { slug, error: String(err) })
        }
      }
    }

    this.started = true
    this.logger.info('All provider plugins started')
  }

  /**
   * Stop all plugins in reverse initialization order.
   */
  async stopAll(): Promise<void> {
    const reversedOrder = [...this.initOrder].reverse()

    for (const slug of reversedOrder) {
      const plugin = this.plugins.get(slug)
      if (!plugin) continue

      try {
        await plugin.stop()
        this.logger.info('Stopped provider plugin', { slug })
      } catch (err) {
        this.logger.error('Error stopping provider plugin', { slug, error: String(err) })
      }
    }

    this.started = false
    this.initialized = false
    this.initOrder = []
    this.healthResults.clear()
    this.logger.info('All provider plugins stopped')
  }

  // ── Queries ────────────────────────────────────────────────────────────

  /** Get a plugin by slug */
  get(slug: string): ProviderPlugin | undefined {
    return this.plugins.get(slug)
  }

  /** Get all plugin metadata */
  listMetadata(): ProviderMetadata[] {
    return Array.from(this.plugins.values()).map((p) => p.metadata)
  }

  /** Check if a plugin is registered */
  has(slug: string): boolean {
    return this.plugins.has(slug)
  }

  /** Get the number of registered plugins */
  get size(): number {
    return this.plugins.size
  }

  // ── Health Checks ──────────────────────────────────────────────────────

  /**
   * Run health checks on all plugins. Returns a map of slug → result.
   * Errors from individual plugins are captured — one failing health check
   * does not prevent others from running.
   */
  async healthCheckAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>()

    for (const [slug, plugin] of this.plugins) {
      try {
        const result = await plugin.healthCheck()
        results.set(slug, result)
        this.healthResults.set(slug, result)

        // Emit health change event if status shifted
        const prev = this.healthResults.get(slug)
        if (prev && prev.status !== result.status) {
          // We don't hold a reference to the event bus here, so we skip
          // emission. Callers who need events can compare before/after.
        }
      } catch (err) {
        const errorResult: HealthCheckResult = {
          status: 'unhealthy',
          checkedAt: Date.now(),
          latencyMs: 0,
          details: `Health check threw: ${String(err)}`,
        }
        results.set(slug, errorResult)
        this.healthResults.set(slug, errorResult)
        this.logger.error('Health check failed for plugin', { slug, error: String(err) })
      }
    }

    return results
  }

  /**
   * Run health check on a single plugin.
   */
  async healthCheck(slug: string): Promise<HealthCheckResult | undefined> {
    const plugin = this.plugins.get(slug)
    if (!plugin) {
      this.logger.warn('Health check requested for unknown plugin', { slug })
      return undefined
    }

    try {
      const result = await plugin.healthCheck()
      this.healthResults.set(slug, result)
      return result
    } catch (err) {
      const errorResult: HealthCheckResult = {
        status: 'unhealthy',
        checkedAt: Date.now(),
        latencyMs: 0,
        details: `Health check threw: ${String(err)}`,
      }
      this.healthResults.set(slug, errorResult)
      this.logger.error('Health check failed for plugin', { slug, error: String(err) })
      return errorResult
    }
  }

  /**
   * Get the last cached health result for a plugin (without running a check).
   */
  getCachedHealth(slug: string): HealthCheckResult | undefined {
    return this.healthResults.get(slug)
  }

  // ── Capability Queries ─────────────────────────────────────────────────

  /**
   * Get all plugins that offer a specific capability.
   */
  getPluginsByCapability(capabilityId: string): ProviderPlugin[] {
    const result: ProviderPlugin[] = []
    for (const plugin of this.plugins.values()) {
      const caps = plugin.getCapabilities()
      if (caps.some((c) => c.capabilityId === capabilityId)) {
        result.push(plugin)
      }
    }
    return result
  }

  /**
   * Get all capabilities across all plugins, tagged with their provider.
   */
  getAllCapabilities(): Array<{
    provider: ProviderMetadata
    capability: ProviderCapabilityDescriptor
  }> {
    const result: Array<{ provider: ProviderMetadata; capability: ProviderCapabilityDescriptor }> =
      []
    for (const plugin of this.plugins.values()) {
      for (const cap of plugin.getCapabilities()) {
        result.push({ provider: plugin.metadata, capability: cap })
      }
    }
    return result
  }

  // ── Manifest Support ───────────────────────────────────────────────────

  /**
   * Load plugins from an array of manifests. Each manifest's factory is
   * registered; actual instantiation happens during initAll().
   */
  loadManifests(
    manifests: ProviderPluginManifest[],
    factoryLoader: (entryPoint: string) => ProviderPluginFactory,
  ): void {
    for (const manifest of manifests) {
      try {
        const factory = factoryLoader(manifest.entryPoint)
        this.registerFactory(manifest.slug, factory)
      } catch (err) {
        this.logger.error('Failed to load plugin manifest', {
          slug: manifest.slug,
          entryPoint: manifest.entryPoint,
          error: String(err),
        })
      }
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

let globalRegistry: ProviderPluginRegistry | null = null

export function getProviderPluginRegistry(): ProviderPluginRegistry {
  if (!globalRegistry) {
    globalRegistry = new ProviderPluginRegistry()
  }
  return globalRegistry
}

/** Reset the singleton (for testing only). */
export function resetProviderPluginRegistry(): void {
  if (globalRegistry) {
    // Attempt graceful shutdown
    globalRegistry.stopAll().catch(() => {})
    // [audit] log the error with context here
  }
  globalRegistry = null
}
