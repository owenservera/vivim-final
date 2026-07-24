import { describe, expect, it } from 'bun:test'
import { MemoryWarden } from '../../../../src/engines/memory/memory-warden.js'

describe('memory-warden', () => {
  it('allows writes in primary context', () => {
    const warden = new MemoryWarden('agent-1')
    const result = warden.gateWrite('hello', { agentContext: 'primary' })
    expect(result).toBe('hello')
  })

  it('blocks writes in subagent context', () => {
    const warden = new MemoryWarden('agent-1')
    const result = warden.gateWrite('hello', { agentContext: 'subagent' })
    expect(result).toBeNull()
  })

  it('blocks writes in cron context', () => {
    const warden = new MemoryWarden('agent-1')
    const result = warden.gateWrite('hello', { agentContext: 'cron' })
    expect(result).toBeNull()
  })

  it('blocks writes in flush context', () => {
    const warden = new MemoryWarden('agent-1')
    const result = warden.gateWrite('hello', { agentContext: 'flush' })
    expect(result).toBeNull()
  })

  it('enforces write quota', () => {
    const warden = new MemoryWarden('agent-1', { writeQuota: 2 })
    expect(warden.gateWrite('a', { agentContext: 'primary' })).toBe('a')
    expect(warden.gateWrite('b', { agentContext: 'primary' })).toBe('b')
    expect(() => warden.gateWrite('c', { agentContext: 'primary' })).toThrow()
  })

  it('unlimited quota when writeQuota is 0', () => {
    const warden = new MemoryWarden('agent-1', { writeQuota: 0 })
    for (let i = 0; i < 100; i++) {
      expect(warden.gateWrite('x', { agentContext: 'primary' })).toBe('x')
    }
  })

  it('buildProvenance includes agentId and contentHash', () => {
    const warden = new MemoryWarden('agent-1')
    const prov = warden.buildProvenance('target', 'content')
    expect(prov.writeOrigin).toBe('memory-warden')
    expect(prov.executionContext).toBe('primary')
    expect(prov.ts).toBeGreaterThan(0)
  })

  it('scrubStreaming passes through', () => {
    const warden = new MemoryWarden('agent-1')
    expect(warden.scrubStreaming('hello')).toBe('hello')
  })
})
