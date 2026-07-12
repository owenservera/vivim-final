import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { PluginManagerImpl, type ProviderPlugin } from '../../../src/engines/plugin-system.js'

function makeEventBus() {
  return { emit: mock(() => {}), on: mock(() => () => {}) } as any
}

function makePlugin(providerId: string): ProviderPlugin {
  return {
    providerId,
    onRegister: mock(() => Promise.resolve()),
    onResolveCapabilities: mock(() => Promise.resolve(null)),
    onAction: mock(() => Promise.resolve(null)),
    onProjectState: mock((s: any) => Promise.resolve(s)),
    onParse: mock(() => Promise.resolve(null)),
  }
}

describe('PluginManagerImpl', () => {
  let bus: ReturnType<typeof makeEventBus>
  let manager: PluginManagerImpl

  beforeEach(() => {
    bus = makeEventBus()
    manager = new PluginManagerImpl(bus)
  })

  test('register adds plugin and emits event', () => {
    const p = makePlugin('claude')
    manager.register(p)
    expect(manager.getPlugin('claude')).toBe(p)
    expect(bus.emit).toHaveBeenCalled()
  })

  test('unregister removes plugin', () => {
    const p = makePlugin('claude')
    manager.register(p)
    manager.unregister('claude')
    expect(manager.getPlugin('claude')).toBeNull()
  })

  test('getAllPlugins returns all registered', () => {
    manager.register(makePlugin('a'))
    manager.register(makePlugin('b'))
    expect(manager.getAllPlugins()).toHaveLength(2)
  })

  test('getPlugin returns null for unknown', () => {
    expect(manager.getPlugin('unknown')).toBeNull()
  })
})
