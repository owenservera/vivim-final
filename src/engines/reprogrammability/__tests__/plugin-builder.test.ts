// src/engines/reprogrammability/__tests__/plugin-builder.test.ts
// Phase 9 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Plugin SDK v2.

import { beforeEach, describe, expect, test } from 'bun:test'
import { resetCanonicalSurfacesForTest } from '../../../reprogrammability/canonical-surfaces.js'
import { surfaceRegistry } from '../../../reprogrammability/registry.js'
import { pluginBuilder } from '../plugin-builder.js'

describe('PluginBuilder', () => {
  beforeEach(() => {
    surfaceRegistry.clear()
    resetCanonicalSurfacesForTest()
  })

  test('builds a plugin from an NL description', async () => {
    const result = await pluginBuilder.build({
      description: 'when I type /standup, show me a card with my open threads',
    })

    expect(result.ok).toBe(true)
    expect(result.plugin).toBeDefined()
    expect(result.manifest).toBeDefined()
    expect(result.manifest?.triggerCommand).toBe('/standup')
    expect(result.manifest?.surfaceId).toBe('plugin:standup:card')
    expect(result.manifest?.surfaceLabel).toBe('Plugin Card: /standup')
  })

  test('registers the surface with the SurfaceRegistry', async () => {
    await pluginBuilder.build({
      description: 'when I type /summary, summarize the current conversation',
    })

    const surface = surfaceRegistry.getOrNull('plugin:summary:card')
    expect(surface).not.toBeNull()
    expect(surface?.kind).toBe('custom')
    expect(surface?.label).toBe('Plugin Card: /summary')
  })

  test('plugin.onResolveCapabilities returns the registered capability', async () => {
    const result = await pluginBuilder.build({
      description: 'when I type /export, export the current canvas as PNG',
    })
    expect(result.ok).toBe(true)
    const caps = await result.plugin?.onResolveCapabilities('plugin:export:card', 'free')
    expect(caps).not.toBeNull()
    expect(caps).toHaveLength(1)
    expect(caps?.[0]?.id).toBe('cap:plugin:export')
  })

  test('plugin.onAction returns the render-surface action for the trigger command', async () => {
    const result = await pluginBuilder.build({
      description: 'when I type /standup, show me a card',
    })
    expect(result.ok).toBe(true)

    const action = await result.plugin?.onAction({ command: '/standup' })
    expect(action).not.toBeNull()
    expect((action as { type: string }).type).toBe('render-surface')
    expect((action as { surfaceId: string }).surfaceId).toBe('plugin:standup:card')

    // Other commands return null.
    const other = await result.plugin?.onAction({ command: '/something-else' })
    expect(other).toBeNull()
  })

  test('returns error for empty description', async () => {
    const result = await pluginBuilder.build({ description: '' })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Description is required')
  })

  test('synthesizes a trigger command when none in description', async () => {
    const result = await pluginBuilder.build({
      description: 'show me my open threads',
    })
    expect(result.ok).toBe(true)
    // No /word in description — triggerCommand should be a generated /plugin-XXXXXX
    expect(result.manifest?.triggerCommand).toMatch(/^\/plugin-[a-z0-9]{6}$/)
  })
})
