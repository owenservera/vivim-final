// src/engines/providers/registry.ts
// ProviderRegistry — manages provider plugins.
// Phase 8: Plugins register at boot. Adding a provider = 1 file + 1 DB row.

import { getLogger } from '../../observability/logger.js'
import type { ProviderPlugin } from './plugin.js'
import { getBuiltinPlugins } from './plugins/index.js'

export class ProviderRegistry {
  private plugins = new Map<string, ProviderPlugin>()
  private logger = getLogger('ProviderRegistry')

  constructor() {
    // Load built-in plugins
    for (const plugin of getBuiltinPlugins()) {
      this.register(plugin)
    }
  }

  /**
   * Register a provider plugin.
   */
  register(plugin: ProviderPlugin): void {
    if (this.plugins.has(plugin.id)) {
      this.logger.warn('Plugin already registered, overwriting', { id: plugin.id })
    }
    this.plugins.set(plugin.id, plugin)
    this.logger.info('Registered provider plugin', { id: plugin.id, name: plugin.name })
  }

  /**
   * Unregister a provider plugin.
   */
  unregister(id: string): boolean {
    const result = this.plugins.delete(id)
    if (result) {
      this.logger.info('Unregistered provider plugin', { id })
    }
    return result
  }

  /**
   * Get a plugin by ID.
   */
  get(id: string): ProviderPlugin | undefined {
    return this.plugins.get(id)
  }

  /**
   * Get all registered plugins.
   */
  getAll(): ProviderPlugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * Get plugin count.
   */
  getCount(): number {
    return this.plugins.size
  }

  /**
   * Check if a provider is registered.
   */
  has(id: string): boolean {
    return this.plugins.has(id)
  }
}

// Singleton registry
let globalRegistry: ProviderRegistry | null = null

export function getProviderRegistry(): ProviderRegistry {
  if (!globalRegistry) {
    globalRegistry = new ProviderRegistry()
  }
  return globalRegistry
}
