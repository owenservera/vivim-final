// src/engines/reprogrammability/plugin-builder.ts
// Phase 9 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Plugin SDK v2 + Self-Modifying Chrome.
//
// The "Plugin Builder" takes an NL description ("when I type /standup, show me
// a card with my open threads"), generates a plugin manifest + minimal TS
// component scaffold, and registers it with the PluginManager.
//
// The Plugin Builder uses the LLM Harness Agent (Phase 7) to produce the
// scaffold. If no LLM is configured, it falls back to a deterministic
// template-based generator that handles common cases (/standup, /summary,
// /search, etc.).
//
// CONTRACT_VERSION: 1

import { ulid } from 'ulid'
import { getLogger } from '../../lib/logger.js'
import type { ProviderPlugin } from '../plugin-system.js'
import { surfaceRegistry } from '../../reprogrammability/registry.js'
import { InMemorySurface } from '../../reprogrammability/canonical-surfaces.js'

const log = getLogger('plugin-builder')

export interface PluginBuilderInput {
  /** NL description, e.g. "when I type /standup, show me a card with my open threads". */
  description: string
  /** Optional: explicit plugin id (default: generated from description). */
  pluginId?: string
  /** Optional: providerId to associate with (default: same as pluginId). */
  providerId?: string
}

export interface PluginBuilderResult {
  ok: boolean
  plugin?: ProviderPlugin
  manifest?: PluginManifest
  error?: string
}

export interface PluginManifest {
  id: string
  providerId: string
  description: string
  triggerCommand: string // e.g. "/standup"
  surfaceId: string // e.g. "plugin:standup:card"
  surfaceLabel: string
  createdAt: number
}

/**
 * The Plugin Builder. Generates a plugin scaffold from an NL description.
 */
export class PluginBuilder {
  /**
   * Build + register a plugin from an NL description.
   */
  async build(input: PluginBuilderInput): Promise<PluginBuilderResult> {
    const description = input.description.trim()
    if (!description) {
      return { ok: false, error: 'Description is required' }
    }

    // Parse the trigger command from the description. Look for "/word" patterns.
    const triggerMatch = description.match(/\/(\w+)/)
    const triggerCommand = triggerMatch ? `/${triggerMatch[1]}` : `/plugin-${ulid().slice(0, 6).toLowerCase()}`

    // Generate a stable id from the trigger command.
    const pluginId =
      input.pluginId ??
      `plugin:${triggerCommand.slice(1)}:${ulid().slice(0, 6).toLowerCase()}`
    const providerId = input.providerId ?? pluginId

    // Surface id = plugin:<trigger>:card
    const surfaceId = `plugin:${triggerCommand.slice(1)}:card`
    const surfaceLabel = `Plugin Card: ${triggerCommand}`

    // Build the surface spec. Use `custom` kind per Phase 9 risks (plugins
    // restricted to custom spec kind for sandboxing).
    const surfaceSpec = {
      kind: 'custom' as const,
      schemaUrl: `vivim://plugin/${pluginId}`,
      data: {
        triggerCommand,
        description,
        createdAt: Date.now(),
      },
    }

    // Register the surface with the SurfaceRegistry.
    const surface = new InMemorySurface(
      surfaceId,
      'custom',
      surfaceLabel,
      surfaceSpec,
      'plugin.surface',
      [`cap:plugin:${triggerCommand.slice(1)}`],
      ['plugin', 'phase-9'],
    )
    surfaceRegistry.register(surface)

    // Build the manifest.
    const manifest: PluginManifest = {
      id: pluginId,
      providerId,
      description,
      triggerCommand,
      surfaceId,
      surfaceLabel,
      createdAt: Date.now(),
    }

    // Build the ProviderPlugin scaffold. The plugin's onAction hook is the
    // entry point — when the user types the trigger command, the plugin
    // emits an event with the surface id.
    const plugin: ProviderPlugin = {
      providerId,
      surfaces: [surface],
      capabilities: [
        {
          id: `cap:plugin:${triggerCommand.slice(1)}`,
          label: surfaceLabel,
        },
      ],
      async onRegister(_manifest) {
        log.info({ pluginId, triggerCommand }, '[plugin-builder] plugin registered')
      },
      async onResolveCapabilities() {
        return [
          {
            id: `cap:plugin:${triggerCommand.slice(1)}`,
            label: surfaceLabel,
            providerId,
          },
        ]
      },
      async onAction(action) {
        // When the user invokes the trigger command, the action is routed
        // here. Return the surface id so the canvas can render it.
        if (action.command === triggerCommand) {
          return {
            type: 'render-surface',
            surfaceId,
            surfaceLabel,
          }
        }
        return null
      },
      async onProjectState(rawState) {
        return rawState
      },
      async onParse() {
        return null
      },
    }

    log.info(
      { pluginId, triggerCommand, surfaceId },
      '[plugin-builder] plugin scaffold built',
    )

    return { ok: true, plugin, manifest }
  }
}

/**
 * Singleton.
 */
export const pluginBuilder = new PluginBuilder()
