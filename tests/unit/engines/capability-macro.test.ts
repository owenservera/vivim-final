import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  CapabilityMacroEngine,
  type CapabilityMacroStore,
  type HarnessRuntime,
} from '../../../src/engines/capability-macro.js'

function makeStore(): CapabilityMacroStore {
  return {
    list: mock(() => Promise.resolve([])),
    get: mock(() => Promise.resolve(null)),
    create: mock((input: any) => Promise.resolve(input)),
    update: mock(() => Promise.resolve()),
    delete: mock(() => Promise.resolve()),
  }
}

function makeRuntime(): HarnessRuntime {
  return {
    executeDag: mock(() => Promise.resolve({ ok: true, output: { result: 42 } })),
  }
}

describe('CapabilityMacroEngine', () => {
  let store: CapabilityMacroStore
  let runtime: HarnessRuntime
  let engine: CapabilityMacroEngine

  beforeEach(() => {
    store = makeStore()
    runtime = makeRuntime()
    engine = new CapabilityMacroEngine(store, runtime)
  })

  test('define creates a macro', async () => {
    const macro = await engine.define({
      name: 'test',
      dagJson: '{"nodes":[]}',
      description: null,
      providerId: null,
      isActive: true,
    })
    expect(macro.name).toBe('test')
    expect(store.create).toHaveBeenCalled()
  })

  test('run executes macro via runtime', async () => {
    ;(store.get as any).mockResolvedValue({ id: 'm1', dagJson: '{"nodes":[]}', isActive: true })
    const result = await engine.run('m1', { input: 'hi' })
    expect(result.ok).toBe(true)
    expect(result.output).toEqual({ result: 42 })
  })

  test('list delegates to store', async () => {
    await engine.list({ activeOnly: true })
    expect(store.list).toHaveBeenCalledWith({ activeOnly: true })
  })

  test('remove delegates to store', async () => {
    await engine.remove('m1')
    expect(store.delete).toHaveBeenCalledWith('m1')
  })
})
