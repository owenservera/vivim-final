import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { PluginManagerImpl } from '../../../src/engines/plugin-system.js'

describe('Plugin Install', () => {
  let manager: PluginManagerImpl
  let bus: ReturnType<typeof makeEventBus>

  function makeEventBus() {
    return { emit: mock(() => {}), on: mock(() => () => {}) } as any
  }

  beforeEach(() => {
    bus = makeEventBus()
    manager = new PluginManagerImpl(bus)
  })

  test('registers plugin with all required hooks', () => {
    const plugin = {
      providerId: 'test-provider',
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
    manager.register(plugin)
    expect(manager.getPlugin('test-provider')).toBe(plugin)
  })

  test('emits plugin:registered event on register', () => {
    const plugin = {
      providerId: 'test-provider',
      onRegister: mock(() => Promise.resolve()),
      onResolveCapabilities: mock(() => Promise.resolve(null)),
      onAction: mock(() => Promise.resolve(null)),
      onProjectState: mock((s: any) => Promise.resolve(s)),
      onParse: mock(() => Promise.resolve(null)),
    }
    manager.register(plugin)
    expect(bus.emit).toHaveBeenCalled()
    const calls = (bus.emit as any).mock.calls
    const registerCall = calls.find(
      (c: any[]) =>
        c[0]?.type === 'plugin:registered' && c[0]?.data?.providerId === 'test-provider',
    )
    expect(registerCall).toBeDefined()
  })

  test('prevents duplicate plugin registration by overwriting', () => {
    const p1 = {
      providerId: 'test-provider',
      onRegister: mock(() => Promise.resolve()),
      onResolveCapabilities: mock(() => Promise.resolve(null)),
      onAction: mock(() => Promise.resolve(null)),
      onProjectState: mock((s: any) => Promise.resolve(s)),
      onParse: mock(() => Promise.resolve(null)),
    }
    const p2 = { ...p1, version: '2.0.0' }
    manager.register(p1)
    manager.register(p2)
    expect(manager.getPlugin('test-provider')).toBe(p2)
  })

  test('executes onRegister hook successfully', async () => {
    const onRegister = mock(() => Promise.resolve())
    const plugin = {
      providerId: 'test-provider',
      onRegister,
      onResolveCapabilities: mock(() => Promise.resolve(null)),
      onAction: mock(() => Promise.resolve(null)),
      onProjectState: mock((s: any) => Promise.resolve(s)),
      onParse: mock(() => Promise.resolve(null)),
    }
    manager.register(plugin)
    await manager.executeOnRegister('test-provider', { provider: { slug: 'test-provider' } })
    expect(onRegister).toHaveBeenCalled()
  })

  test('handles onRegister error gracefully', async () => {
    const onRegister = mock(() => Promise.reject(new Error('register failed')))
    const plugin = {
      providerId: 'test-provider',
      onRegister,
      onResolveCapabilities: mock(() => Promise.resolve(null)),
      onAction: mock(() => Promise.resolve(null)),
      onProjectState: mock((s: any) => Promise.resolve(s)),
      onParse: mock(() => Promise.resolve(null)),
    }
    manager.register(plugin)
    await manager.executeOnRegister('test-provider', {})
    const calls = (bus.emit as any).mock.calls
    const errorCall = calls.find((c: any[]) => c[0]?.type === 'plugin:hook_error')
    expect(errorCall).toBeDefined()
    expect(errorCall[0].data.error).toBe('register failed')
  })
})
