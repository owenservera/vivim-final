import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  type MirrorAction,
  MirrorEngine,
  type MirrorStore,
} from '../../../src/engines/mirror-engine.js'

function makeMocks() {
  const governor = {
    cdp: {
      send: mock(() => Promise.resolve({})),
      getPageState: mock(() => Promise.resolve({})),
    },
  } as any
  const resolution = {} as any
  const store: MirrorStore = {
    getMirrorState: mock(() =>
      Promise.resolve({
        conversationId: 'c1',
        chromeState: { url: 'x' },
        uiState: {},
        lastSyncAt: 1000,
      }),
    ),
    upsertMirrorState: mock(() => Promise.resolve()),
    createOptimisticUpdate: mock(() =>
      Promise.resolve({
        id: 'u1',
        conversationId: 'c1',
        action: 'click',
        expectedState: {},
        confirmed: false,
        createdAt: 1000,
      }),
    ),
    resolveOptimisticUpdate: mock(() => Promise.resolve()),
    recordLatency: mock(() => Promise.resolve()),
    getLatencyReport: mock(() => Promise.resolve({ conversationId: 'c1', stages: {}, totalMs: 0 })),
    createSnapshot: mock(() =>
      Promise.resolve({
        id: 'snap1',
        conversationId: 'c1',
        trigger: 'test',
        state: {},
        timestamp: 1000,
      }),
    ),
    getSnapshots: mock(() => Promise.resolve([])),
  } as any
  const eventBus = { emit: mock(() => {}) } as any
  const memoizer = {} as any
  return { governor, resolution, store, eventBus, memoizer }
}

describe('MirrorEngine', () => {
  let m: ReturnType<typeof makeMocks>
  let engine: MirrorEngine

  beforeEach(() => {
    m = makeMocks()
    engine = new MirrorEngine(m.governor, m.resolution, m.store, m.eventBus, m.memoizer)
  })

  test('sendAction navigate routes to CDP Page.navigate', async () => {
    const action: MirrorAction = {
      type: 'navigate',
      slaveId: 's1',
      value: 'https://x.com',
      conversationId: 'c1',
    }
    const result = await engine.sendAction(action)
    expect(m.governor.cdp.send).toHaveBeenCalledWith('s1', 'Page.navigate', {
      url: 'https://x.com',
    })
    expect(result.success).toBe(true)
  })

  test('sendAction click routes to CDP Runtime.evaluate', async () => {
    const action: MirrorAction = {
      type: 'click',
      slaveId: 's1',
      target: '#btn',
      conversationId: 'c1',
    }
    const result = await engine.sendAction(action)
    expect(m.governor.cdp.send).toHaveBeenCalledWith('s1', 'Runtime.evaluate', {
      expression: "document.querySelector('#btn')?.click()",
    })
    expect(result.success).toBe(true)
  })

  test('sendAction type routes to CDP Runtime.evaluate', async () => {
    const action: MirrorAction = {
      type: 'type',
      slaveId: 's1',
      target: 'input',
      value: 'hello',
      conversationId: 'c1',
    }
    const result = await engine.sendAction(action)
    expect(m.governor.cdp.send).toHaveBeenCalledWith('s1', 'Runtime.evaluate', {
      expression: "document.querySelector('input').value = 'hello'",
    })
    expect(result.success).toBe(true)
  })

  test('sendAction scroll routes to CDP Input.dispatchMouseEvent', async () => {
    const action: MirrorAction = {
      type: 'scroll',
      slaveId: 's1',
      value: '-200',
      conversationId: 'c1',
    }
    const result = await engine.sendAction(action)
    expect(m.governor.cdp.send).toHaveBeenCalledWith('s1', 'Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: 0,
      y: 0,
      deltaX: 0,
      deltaY: -200,
    })
    expect(result.success).toBe(true)
  })

  test('sendAction without slaveId returns error', async () => {
    const action: MirrorAction = { type: 'click', conversationId: 'c1' }
    const result = await engine.sendAction(action)
    expect(result.success).toBe(false)
    expect(result.error).toContain('slaveId required')
  })

  test('projectState returns mirror state', async () => {
    const state = await engine.projectState('c1')
    expect(state.chrome).toEqual({ url: 'x' })
    expect(state.lastSyncAt).toBe(1000)
  })
})
