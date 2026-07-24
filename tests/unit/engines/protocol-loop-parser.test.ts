import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { ProtocolLoopParser } from '../../../src/engines/protocol-loop-parser.js'

function makeEventBus() {
  return { emit: mock(() => {}) } as any
}

describe('protocol-loop-parser', () => {
  let bus: ReturnType<typeof makeEventBus>
  let parser: ProtocolLoopParser

  beforeEach(() => {
    bus = makeEventBus()
    parser = new ProtocolLoopParser(bus)
  })

  it('parses JSON frames from string', async () => {
    const frame = JSON.stringify({ id: 'f1', type: 'test', payload: { x: 1 }, timestamp: 100 })
    await parser.processStream(frame)
    expect(bus.emit).toHaveBeenCalledTimes(1)
    expect(bus.emit.mock.calls[0][0].type).toBe('capability:test')
  })

  it('ignores non-JSON lines', async () => {
    await parser.processStream('not json\nalso not json')
    expect(bus.emit).not.toHaveBeenCalled()
  })

  it('processes multiple frames', async () => {
    const f1 = JSON.stringify({ id: 'f1', type: 'a', payload: {}, timestamp: 1 })
    const f2 = JSON.stringify({ id: 'f2', type: 'b', payload: {}, timestamp: 2 })
    await parser.processStream(`${f1}\n${f2}`)
    expect(bus.emit).toHaveBeenCalledTimes(2)
  })

  it('skips empty lines', async () => {
    await parser.processStream('\n\n\n')
    expect(bus.emit).not.toHaveBeenCalled()
  })

  it('getState returns current state', () => {
    const state = parser.getState()
    expect(state.running).toBe(false)
    expect(state.cycleCount).toBe(0)
  })

  it('getState updates after processing', async () => {
    const frame = JSON.stringify({ id: 'f1', type: 'x', payload: {}, timestamp: 1 })
    await parser.processStream(frame)
    const state = parser.getState()
    expect(state.cycleCount).toBe(1)
    expect(state.lastFrame).toBeDefined()
  })
})
