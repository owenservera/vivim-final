import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { PluginManagerImpl } from '../../../src/engines/plugin-system.js'

describe('Plugin Integrity Verification', () => {
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
    bus = makeEventBus() as any
    manager = new PluginManagerImpl(bus) as any
  })

  test('verifyIntegrity returns true when hashes match', async () => {
    const hash = 'abc123'
    const result = await manager.verifyIntegrity('test-provider', hash, hash)
    expect(result).toBe(true)
  })

  test('verifyIntegrity returns false and emits event when hashes mismatch', async () => {
    const result = await manager.verifyIntegrity('test-provider', 'abc123', 'def456')
    expect(result).toBe(false)

    const calls = (bus.emit as any).mock.calls
    const integrityCall = calls.find((c: any[]) => c[0]?.type === 'plugin:integrity_failed')
    expect(integrityCall).toBeDefined()
    expect(integrityCall[0].data.expectedHash).toBe('abc123')
    expect(integrityCall[0].data.actualHash).toBe('def456')
  })

  test('executeOnUpgrade calls plugin hook with version', async () => {
    const onUpgrade = mock(() => Promise.resolve())
    const p = { ...makeFullPlugin('test-provider'), onUpgrade }
    manager.register(p)
    await manager.executeOnUpgrade('test-provider', '1.0.0')
    expect(onUpgrade).toHaveBeenCalledWith('1.0.0')
  })

  test('executeOnUpgrade handles missing hook gracefully', async () => {
    const p = {
      providerId: 'test-provider',
      onRegister: mock(() => Promise.resolve()),
      onResolveCapabilities: mock(() => Promise.resolve(null)),
      onAction: mock(() => Promise.resolve(null)),
      onProjectState: mock((s: any) => Promise.resolve(s)),
      onParse: mock(() => Promise.resolve(null)),
      // no onUpgrade
    }
    manager.register(p)
    await manager.executeOnUpgrade('test-provider', '1.0.0')
    // should not throw
  })

  test('executeOnHealthCheck returns status from plugin', async () => {
    const healthStatus = { status: 'healthy' as const, message: 'all good', lastCheck: Date.now() }
    const onHealthCheck = mock(() => Promise.resolve(healthStatus))
    const p = { ...makeFullPlugin('test-provider'), onHealthCheck }
    manager.register(p)
    const result = await manager.executeOnHealthCheck('test-provider')
    expect(result).toEqual(healthStatus)
  })

  test('executeOnHealthCheck returns null when no hook', async () => {
    const p = {
      providerId: 'test-provider',
      onRegister: mock(() => Promise.resolve()),
      onResolveCapabilities: mock(() => Promise.resolve(null)),
      onAction: mock(() => Promise.resolve(null)),
      onProjectState: mock((s: any) => Promise.resolve(s)),
      onParse: mock(() => Promise.resolve(null)),
    }
    manager.register(p)
    const result = await manager.executeOnHealthCheck('test-provider')
    expect(result).toBeNull()
  })

  test('executeOnHealthCheck emits error on hook failure', async () => {
    const onHealthCheck = mock(() => Promise.reject(new Error('check failed')))
    const p = { ...makeFullPlugin('test-provider'), onHealthCheck }
    manager.register(p)
    const result = await manager.executeOnHealthCheck('test-provider')
    expect(result).toBeNull()
    const calls = (bus.emit as any).mock.calls
    const errorCall = calls.find(
      (c: any[]) => c[0]?.type === 'plugin:hook_error' && c[0]?.data?.hook === 'onHealthCheck',
    )
    expect(errorCall).toBeDefined()
  })
})
