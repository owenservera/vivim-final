// src/engines/plugin-system.ts
// Plugin system — escape hatch for self-describing providers
//
// Phase 9 of ROADMAP-REPROGRAMMABLE-CANVAS.md extends ProviderPlugin with
// optional `surfaces` and `mutationHandlers` so plugins can register
// ReprogrammableSurface implementations + custom mutation handlers.

import type { ReprogrammableSurface } from '../reprogrammability/contract.js'
import type { SurfaceMutation } from '../reprogrammability/mutation-schema.js'
import type { SurfaceSpec } from '../reprogrammability/schema/spec.js'
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

  // ── Phase 9 additions — Plugin SDK v2 ────────────────────────────────────
  /**
   * Optional: surfaces this plugin registers with the SurfaceRegistry on
   * boot. The PluginManager calls `surfaceRegistry.register(s)` for each.
   * Surfaces should use the `custom` SurfaceKind unless the plugin is
   * promoted to a first-class kind via contract amendment (Phase 10).
   */
  surfaces?: ReprogrammableSurface[]
  /**
   * Optional: custom mutation handlers per SurfaceKind. The default handler
   * (InMemorySurface.mutate) is used if no handler is registered for the
   * kind. Handlers receive the mutation + the current spec; they return the
   * new spec or throw on failure.
   */
  mutationHandlers?: Partial<
    Record<
      ReprogrammableSurface['kind'],
      (mutation: SurfaceMutation, currentSpec: SurfaceSpec) => Promise<SurfaceSpec>
    >
  >
  /**
   * Optional: capabilities this plugin exposes. Reaffirmed from Phase 1;
   * the PluginManager emits a `plugin:capabilities-registered` event for each.
   */
  capabilities?: Array<{ id: string; label: string; spec?: unknown }>
}

export type PluginHookName =
  | 'onRegister'
  | 'onResolveCapabilities'
  | 'onAction'
  | 'onProjectState'
  | 'onParse'
  | 'surfaces'
  | 'mutationHandlers'
  | 'capabilities'

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
    })

    // ── Phase 9 — register plugin surfaces + emit capabilities events ──────
    // These are best-effort: if a plugin's surface fails to register (e.g.
    // duplicate id), we log + continue rather than failing the whole register.
    if (plugin.surfaces) {
      // Lazy import to avoid a hard dependency cycle (SurfaceRegistry imports
      // from contract.ts which is fine, but plugin-system.ts is loaded early
      // in bootstrap and we don't want to force surfaceRegistry init here).
      import('../reprogrammability/registry.js')
        .then(({ surfaceRegistry }) => {
          for (const surface of plugin.surfaces!) {
            try {
              surfaceRegistry.register(surface)
              this.eventBus.emit({
                type: 'plugin:surface-registered',
                data: {
                  providerId: plugin.providerId,
                  surfaceId: surface.id,
                  kind: surface.kind,
                },
              })
            } catch (err) {
              this.eventBus.emit({
                type: 'plugin:hook_error',
                data: {
                  providerId: plugin.providerId,
                  hook: 'surfaces',
                  error: err instanceof Error ? err.message : String(err),
                },
              })
            }
          }
        })
        .catch((err) => {
          this.eventBus.emit({
            type: 'plugin:hook_error',
            data: {
              providerId: plugin.providerId,
              hook: 'surfaces',
              error: `Failed to load SurfaceRegistry: ${err instanceof Error ? err.message : String(err)}`,
            },
          })
        })
    }

    if (plugin.capabilities) {
      for (const cap of plugin.capabilities) {
        this.eventBus.emit({
          type: 'plugin:capabilities-registered',
          data: {
            providerId: plugin.providerId,
            capabilityId: cap.id,
            label: cap.label,
          },
        })
      }
    }
  }

  unregister(providerId: string): void {
    const existing = this.plugins.get(providerId)
    this.plugins.delete(providerId)
    this.eventBus.emit({
      type: 'plugin:unregistered',
      data: { providerId },
    })

    // ── Phase 9 — unregister plugin surfaces ───────────────────────────────
    if (existing?.surfaces) {
      import('../reprogrammability/registry.js')
        .then(({ surfaceRegistry }) => {
          for (const surface of existing.surfaces!) {
            surfaceRegistry.unregister(surface.id)
          }
        })
        .catch(() => {
  // [audit] log the error with context here
          // Best-effort.
        })
    }
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
      })
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
      })
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
      })
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
      })
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
      })
      return null
    }
  }
}
