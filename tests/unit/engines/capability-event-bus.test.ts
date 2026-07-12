// tests/unit/engines/capability-event-bus.test.ts
// Tests for CapabilityEventBus — typed in-process pub/sub.

import { beforeEach, describe, expect, it } from 'bun:test'
import {
  CapabilityEventBus,
  type EngineEvent,
  type WsLike,
} from '../../../src/engines/capability-event-bus.js'

describe('CapabilityEventBus', () => {
  let bus: CapabilityEventBus

  beforeEach(() => {
    CapabilityEventBus.resetInstance()
    bus = CapabilityEventBus.getInstance()
  })

  it('getInstance() returns singleton', () => {
    const a = CapabilityEventBus.getInstance()
    const b = CapabilityEventBus.getInstance()
    expect(a).toBe(b)
  })

  it('emit() delivers event to all registered handlers', () => {
    const received: EngineEvent[] = []
    bus.on('conversation:complete', (e) => received.push(e))
    bus.on('conversation:complete', (e) => received.push(e))

    bus.emit({ type: 'conversation:complete', conversationId: 'c1', message: {} })
    expect(received).toHaveLength(2)
    expect(received[0]).toEqual({
      type: 'conversation:complete',
      conversationId: 'c1',
      message: {},
    })
  })

  it('on() registers handler, returns unsubscribe function', () => {
    const received: EngineEvent[] = []
    const unsub = bus.on('provider:seeded', (e) => received.push(e))

    bus.emit({ type: 'provider:seeded', providerId: 'claude', capabilities: 5 })
    expect(received).toHaveLength(1)

    unsub()
    bus.emit({ type: 'provider:seeded', providerId: 'openai', capabilities: 3 })
    expect(received).toHaveLength(1)
  })

  it('once() fires handler once then auto-removes', () => {
    const received: EngineEvent[] = []
    bus.once('config:changed', (e) => received.push(e))

    bus.emit({ type: 'config:changed', engineId: 'eng_1', actor: 'admin' })
    bus.emit({ type: 'config:changed', engineId: 'eng_2', actor: 'user' })
    expect(received).toHaveLength(1)
  })

  it('subscribe(ws, entityType, entityId) registers WebSocket subscription', () => {
    const sent: string[] = []
    const ws: WsLike = { send: (data: string) => sent.push(data) }

    bus.subscribe(ws, 'conversation', 'conv_1')
    bus.emit({ type: 'conversation:complete', conversationId: 'conv_1', message: {} })
    expect(sent).toHaveLength(1)

    // Different entity ID — should not receive
    bus.emit({ type: 'conversation:complete', conversationId: 'conv_2', message: {} })
    expect(sent).toHaveLength(1)
  })

  it('unsubscribe(ws, entityType, entityId) removes subscription', () => {
    const sent: string[] = []
    const ws: WsLike = { send: (data: string) => sent.push(data) }

    bus.subscribe(ws, 'conversation', 'conv_1')
    bus.unsubscribe(ws, 'conversation', 'conv_1')
    bus.emit({ type: 'conversation:complete', conversationId: 'conv_1', message: {} })
    expect(sent).toHaveLength(0)
  })

  it('unsubscribeAll(ws) removes all subscriptions for a WebSocket', () => {
    const sent: string[] = []
    const ws: WsLike = { send: (data: string) => sent.push(data) }

    bus.subscribe(ws, 'conversation', 'conv_1')
    bus.subscribe(ws, 'provider', 'claude')
    bus.unsubscribeAll(ws)

    bus.emit({ type: 'conversation:complete', conversationId: 'conv_1', message: {} })
    bus.emit({ type: 'provider:seeded', providerId: 'claude', capabilities: 5 })
    expect(sent).toHaveLength(0)
  })

  it('Multiple handlers for same event type all receive the event', () => {
    let count = 0
    bus.on('fleet:slave_status', () => {
      count++
    })
    bus.on('fleet:slave_status', () => {
      count++
    })
    bus.on('fleet:slave_status', () => {
      count++
    })

    bus.emit({
      type: 'fleet:slave_status',
      slaveId: 's1',
      providerId: 'claude',
      status: 'running',
      superState: 'idle',
    })
    expect(count).toBe(3)
  })
})
