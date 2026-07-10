// src/engines/plugin-system.ts
// Plugin system — escape hatch for self-describing providers

import type { ContentBlock } from '../schema/streaming.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

export interface ProviderPlugin {
  providerId: string
  onRegister(manifest: unknown): Promise<void>
  onResolveCapabilities(
    providerId: string,
    planTier: string,
  ): Promise<Record<string, unknown>[] | null>
  onAction(action: Record<string, unknown>): Promise<Record<string, unknown> | null>
  onProjectState(rawState: Record<string, unknown>): Promise<Record<string, unknown>>
  onParse(rawBody: string): Promise<ContentBlock[] | null>
}

export type PluginHookName =
  | 'onRegister'
  | 'onResolveCapabilities'
  | 'onAction'
  | 'onProjectState'
  | 'onParse'

export interface PluginManager {
  register(plugin: ProviderPlugin): void
  unregister(providerId: string): void
  getPlugin(providerId: string): ProviderPlugin | null
  getAllPlugins(): ProviderPlugin[]
}

export class PluginManagerImpl implements PluginManager {
  private plugins = new Map<string, ProviderPlugin>()

  constructor(private readonly eventBus: CapabilityEventBus) {}

  register(plugin: ProviderPlugin): void {
    this.plugins.set(plugin.providerId, plugin)
    this.eventBus.emit({
      type: 'plugin:registered',
      data: { providerId: plugin.providerId },
    } as never)
  }

  unregister(providerId: string): void {
    this.plugins.delete(providerId)
    this.eventBus.emit({
      type: 'plugin:unregistered',
      data: { providerId },
    } as never)
  }

  getPlugin(providerId: string): ProviderPlugin | null {
    return this.plugins.get(providerId) ?? null
  }

  getAllPlugins(): ProviderPlugin[] {
    return [...this.plugins.values()]
  }

  async executeOnRegister(providerId: string, manifest: unknown): Promise<void> {
    const plugin = this.plugins.get(providerId)
    if (!plugin) return
    try {
      await plugin.onRegister(manifest)
    } catch (err) {
      this.eventBus.emit({
        type: 'plugin:hook_error',
        data: {
          providerId,
          hook: 'onRegister',
          error: err instanceof Error ? err.message : String(err),
        },
      } as never)
    }
  }

  async executeOnResolveCapabilities(
    providerId: string,
    planTier: string,
  ): Promise<Record<string, unknown>[] | null> {
    const plugin = this.plugins.get(providerId)
    if (!plugin) return null
    try {
      return await plugin.onResolveCapabilities(providerId, planTier)
    } catch (err) {
      this.eventBus.emit({
        type: 'plugin:hook_error',
        data: {
          providerId,
          hook: 'onResolveCapabilities',
          error: err instanceof Error ? err.message : String(err),
        },
      } as never)
      return null
    }
  }

  async executeOnAction(
    providerId: string,
    action: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const plugin = this.plugins.get(providerId)
    if (!plugin) return null
    try {
      return await plugin.onAction(action)
    } catch (err) {
      this.eventBus.emit({
        type: 'plugin:hook_error',
        data: {
          providerId,
          hook: 'onAction',
          error: err instanceof Error ? err.message : String(err),
        },
      } as never)
      return null
    }
  }

  async executeOnProjectState(
    providerId: string,
    rawState: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const plugin = this.plugins.get(providerId)
    if (!plugin) return rawState
    try {
      return await plugin.onProjectState(rawState)
    } catch (err) {
      this.eventBus.emit({
        type: 'plugin:hook_error',
        data: {
          providerId,
          hook: 'onProjectState',
          error: err instanceof Error ? err.message : String(err),
        },
      } as never)
      return rawState
    }
  }

  async executeOnParse(providerId: string, rawBody: string): Promise<ContentBlock[] | null> {
    const plugin = this.plugins.get(providerId)
    if (!plugin) return null
    try {
      return await plugin.onParse(rawBody)
    } catch (err) {
      this.eventBus.emit({
        type: 'plugin:hook_error',
        data: {
          providerId,
          hook: 'onParse',
          error: err instanceof Error ? err.message : String(err),
        },
      } as never)
      return null
    }
  }
}
