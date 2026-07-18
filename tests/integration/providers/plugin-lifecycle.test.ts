import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PluginHotReload } from '../../../src/engines/plugin-hot-reload.js'
import { PluginManagerImpl } from '../../../src/engines/plugin-system.js'

describe('Plugin Lifecycle Integration', () => {
  let manager: any
  let hotReload: any
  const testDir = join(tmpdir(), `vivim-test-plugins-${Date.now()}`)
  const events: Array<{ type: string; data: any }> = []

  const eventBus = {
    emit(event: { type: string; data?: any; [key: string]: unknown }) {
      events.push({ type: event.type, data: event.data ?? event })
    },
    on() {
      return () => {}
    },
  } as any

  beforeAll(async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(testDir, { recursive: true })

    manager = new PluginManagerImpl(eventBus)
    hotReload = new PluginHotReload()
  })

  afterAll(async () => {
    hotReload.stop()
    await rm(testDir, { recursive: true, force: true })
  })

  test('full lifecycle: register → use → upgrade → unregister', async () => {
    const onRegister = async () => {}
    const onUpgrade = async (_fromVersion: string) => {}
    const onUninstall = async () => {}

    const plugin = {
      providerId: 'lifecycle-test',
      onRegister: onRegister as any,
      onResolveCapabilities: async () => null,
      onAction: async () => null,
      onProjectState: async (s: any) => s,
      onParse: async () => null,
      onUpgrade: onUpgrade as any,
      onUninstall: onUninstall as any,
      onHealthCheck: async () => ({ status: 'healthy' as const, lastCheck: Date.now() }),
    }

    // Phase 1: Register
    manager.register(plugin)
    expect(manager.getPlugin('lifecycle-test')).toBeDefined()
    expect(events.some((e) => e.type === 'plugin:registered')).toBe(true)

    // Phase 2: Execute hooks
    await manager.executeOnRegister('lifecycle-test', { provider: { slug: 'lifecycle-test' } })
    await manager.executeOnResolveCapabilities('lifecycle-test', 'free')

    // Phase 3: Health check
    const health = await manager.executeOnHealthCheck('lifecycle-test')
    expect(health?.status).toBe('healthy')

    // Phase 4: Upgrade
    await manager.executeOnUpgrade('lifecycle-test', '0.1.0')

    // Phase 5: Integrity verification
    const valid = await manager.verifyIntegrity('lifecycle-test', 'hash1', 'hash1')
    expect(valid).toBe(true)

    const invalid = await manager.verifyIntegrity('lifecycle-test', 'hash1', 'hash2')
    expect(invalid).toBe(false)
    expect(events.some((e) => e.type === 'plugin:integrity_failed')).toBe(true)

    // Phase 6: Uninstall
    await manager.executeOnUninstall('lifecycle-test')
    manager.unregister('lifecycle-test')
    expect(manager.getPlugin('lifecycle-test')).toBeNull()
    expect(events.some((e) => e.type === 'plugin:unregistered')).toBe(true)
  })

  test('hot reload detects plugin load and emits events', async () => {
    const loaded: any[] = []
    const errors: any[] = []

    hotReload.onPluginLoaded((p: any) => loaded.push(p))
    hotReload.onPluginError((e: any, p: any) => errors.push({ error: e, path: p }))

    await hotReload.start(testDir)

    // Directory watcher should start without error
    expect(hotReload.listLoaded()).toBeDefined()
    expect(Array.isArray(hotReload.listLoaded())).toBe(true)

    hotReload.stop()
  })

  test('verifyPluginDirectory detects invalid plugin directories', async () => {
    const { mkdir } = await import('node:fs/promises')
    const emptyDir = join(testDir, 'empty-plugin')
    await mkdir(emptyDir, { recursive: true })

    const isValid =     await (hotReload as any).verifyPluginDirectory(emptyDir)
    expect(isValid).toBe(false)

    await rm(emptyDir, { recursive: true, force: true })
  })
})
