import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { PluginManagerImpl } from '../../../src/engines/plugin-system.js'

describe('Plugin Uninstall Cleanup', () => {
  let manager: any
  let bus: ReturnType<typeof makeEventBus>

  function makeEventBus() {
    return { emit: mock(() => {}), on: mock(() => () => {}) } as any
  }

  function makeFullPlugin(providerId: string) {
    return {
      providerId,
      onRegister: mock(() => Promise.resolve()),
      onResolveCapabilities: mock(() => Promise.resolve(null)),
      onAction: mock(() => Promise.resolve(null)),
      onProjectState: mock((s: any) => Promise.resolve(s)),
      onParse: mock(() => Promise.resolve(null)),
      onUninstall: mock(() => Promise.resolve()),
      onUpgrade: mock(() => Promise.resolve()),
      onHealthCheck: mock(() =>
        Promise.resolve({ status: 'healthy' as const, lastCheck: Date.now() }),
      ),
    }
  }

  beforeEach(() => {
    bus = makeEventBus()
    manager = new PluginManagerImpl(bus) as any
  })

  test('unregisters plugin and emits event', () => {
    const p = makeFullPlugin('test-provider')
    manager.register(p)
    manager.unregister('test-provider')
    expect(manager.getPlugin('test-provider')).toBeNull()

    const calls = (bus.emit as any).mock.calls
    const unregisterCall = calls.find((c: any[]) => c[0]?.type === 'plugin:unregistered')
    expect(unregisterCall).toBeDefined()
  })

  test('unregister is idempotent', () => {
    const p = makeFullPlugin('test-provider')
    manager.register(p)
    manager.unregister('test-provider')
    manager.unregister('test-provider')
    expect(manager.getPlugin('test-provider')).toBeNull()
  })

  test('executeOnUninstall calls plugin hook', async () => {
    const onUninstall = mock(() => Promise.resolve())
    const p = { ...makeFullPlugin('test-provider'), onUninstall }
    manager.register(p)
    await manager.executeOnUninstall('test-provider')
    expect(onUninstall).toHaveBeenCalledTimes(1)
  })

  test('executeOnUninstall handles missing hook gracefully', async () => {
    const p = {
      providerId: 'test-provider',
      onRegister: mock(() => Promise.resolve()),
      onResolveCapabilities: mock(() => Promise.resolve(null)),
      onAction: mock(() => Promise.resolve(null)),
      onProjectState: mock((s: any) => Promise.resolve(s)),
      onParse: mock(() => Promise.resolve(null)),
      // no onUninstall
    }
    manager.register(p)
    await manager.executeOnUninstall('test-provider')
    // should not throw
  })

  test('executeOnUninstall handles plugin not found', async () => {
    await manager.executeOnUninstall('nonexistent')
    // should not throw
  })

  test('executeOnUninstall emits error on hook failure', async () => {
    const onUninstall = mock(() => Promise.reject(new Error('cleanup failed')))
    const p = { ...makeFullPlugin('test-provider'), onUninstall }
    manager.register(p)
    await manager.executeOnUninstall('test-provider')
    const calls = (bus.emit as any).mock.calls
    const errorCall = calls.find(
      (c: any[]) => c[0]?.type === 'plugin:hook_error' && c[0]?.data?.hook === 'onUninstall',
    )
    expect(errorCall).toBeDefined()
  })

  test('gets all plugins excluding unregistered ones', () => {
    manager.register(makeFullPlugin('a'))
    manager.register(makeFullPlugin('b'))
    manager.register(makeFullPlugin('c'))
    manager.unregister('b')
    expect(manager.getAllPlugins()).toHaveLength(2)
    expect(
      manager
        .getAllPlugins()
        .map((p: any) => p.providerId)
        .sort(),
    ).toEqual(['a', 'c'])
  })
})
