// tests/unit/engines/adaptive-workspace.test.ts
// AdaptiveWorkspaceEngine — mode switching, panel config, promotion checks.
import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { AdaptiveWorkspaceEngine, type WorkspaceMode } from '../../../src/engines/adaptive-workspace.js'
import type { WorkspaceStore } from '../../../src/storage/contracts/workspace-store.js'

function makeStore() {
  return {
    getMode: mock(() => Promise.resolve('chat')),
    setMode: mock(() => Promise.resolve()),
    getUserStats: mock(() => Promise.resolve({ messageCount: 0, capabilityCount: 0 })),
  }
}

describe('AdaptiveWorkspaceEngine', () => {
  let store: ReturnType<typeof makeStore>
  let engine: AdaptiveWorkspaceEngine

  beforeEach(() => {
    store = makeStore()
    engine = new AdaptiveWorkspaceEngine(store as never)
  })

  it('getMode returns stored mode or defaults to chat', async () => {
    expect(await engine.getMode('u1')).toBe('chat')
    store.getMode.mockResolvedValue('expert')
    expect(await engine.getMode('u1')).toBe('expert')
  })

  it('setMode delegates to store', async () => {
    await engine.setMode('u1', 'agent')
    expect(store.setMode).toHaveBeenCalledWith('u1', 'agent')
  })

  it('checkPromotion returns expert when chat thresholds met', async () => {
    store.getUserStats.mockResolvedValue({ messageCount: 25, capabilityCount: 5 })
    const result = await engine.checkPromotion('u1')
    expect(result).toBe('expert')
  })

  it('checkPromotion returns null when thresholds not met', async () => {
    store.getUserStats.mockResolvedValue({ messageCount: 5, capabilityCount: 1 })
    const result = await engine.checkPromotion('u1')
    expect(result).toBeNull()
  })

  it('checkPromotion returns agent when expert thresholds met', async () => {
    store.getMode.mockResolvedValue('expert')
    store.getUserStats.mockResolvedValue({ messageCount: 60, capabilityCount: 15 })
    const result = await engine.checkPromotion('u1')
    expect(result).toBe('agent')
  })

  it('getPanelConfig returns panels for each mode', async () => {
    const chat = await engine.getPanelConfig('chat')
    expect(chat.length).toBeGreaterThanOrEqual(2)
    const expert = await engine.getPanelConfig('expert')
    expect(expert.length).toBeGreaterThan(chat.length)
    const agent = await engine.getPanelConfig('agent')
    expect(agent.length).toBeGreaterThan(expert.length)
  })
})
