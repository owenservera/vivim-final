import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { PluginHotReload } from '../../../src/engines/plugin-hot-reload.js'

describe('plugin-hot-reload', () => {
  let plugin: PluginHotReload

  beforeEach(() => {
    plugin = new PluginHotReload()
  })

  it('can be instantiated', () => {
    expect(plugin).toBeDefined()
  })

  it('registers load handler', () => {
    const handler = mock(() => {})
    plugin.onPluginLoaded(handler)
  })

  it('registers unload handler', () => {
    const handler = mock(() => {})
    plugin.onPluginUnloaded(handler)
  })

  it('registers error handler', () => {
    const handler = mock(() => {})
    plugin.onPluginError(handler)
  })

  it('listLoaded returns empty array initially', () => {
    expect(plugin.listLoaded()).toEqual([])
  })

  it('stop does not throw when not started', () => {
    expect(() => plugin.stop()).not.toThrow()
  })
})
