import { describe, expect, it } from 'bun:test'
import { InterpretationEngine } from '../../../../src/engines/command-language/interpretation.js'
import type {
  CommandContext,
  CommandIntent,
} from '../../../../src/engines/command-language/types.js'

const mockCtx: CommandContext = {
  activeProvider: 'claude',
  activeConvId: 'conv-1',
  activeAccountId: 'acc-1',
  lastAssistantText: null,
  lastAssistantAt: null,
  lastUserPrompt: null,
  gmailAccounts: [],
  dueMemoryCount: 0,
  panelStatus: 'disconnected',
  activeTags: [],
  recentCommands: [],
  sessionState: {},
}

const healthIntent: CommandIntent = {
  commandId: '/health',
  confidence: 0.9,
  category: 'system',
  matchedPattern: 'health check',
  args: {},
  source: 'nlcl',
  color: { category: 'system' },
  interpretation: '/health',
}

const switchIntent: CommandIntent = {
  commandId: '/switch',
  confidence: 0.85,
  category: 'provider',
  matchedPattern: 'switch to claude',
  args: {},
  source: 'nlcl',
  color: { category: 'provider' },
  interpretation: '/switch',
}

describe('InterpretationEngine', () => {
  it('renders L0 (none) as empty', () => {
    const engine = new InterpretationEngine()
    const state = engine.render(healthIntent, 'L0', mockCtx)
    expect(state.level).toBe('L0')
    expect(state.label).toBe('')
    expect(state.preview).toBeUndefined()
    expect(state.details).toBeUndefined()
  })

  it('renders L1 (intent label)', () => {
    const engine = new InterpretationEngine()
    const state = engine.render(healthIntent, 'L1', mockCtx)
    expect(state.level).toBe('L1')
    expect(state.label!.toLowerCase()).toContain('health')
    expect(state.preview).toBeUndefined()
    expect(state.details).toBeUndefined()
  })

  it('renders L2 (preview)', () => {
    const engine = new InterpretationEngine()
    const state = engine.render(healthIntent, 'L2', mockCtx)
    expect(state.level).toBe('L2')
    expect(state.label!.toLowerCase()).toContain('health')
    expect(state.preview).toBeDefined()
    expect(state.details).toBeUndefined()
  })

  it('renders L3 (full)', () => {
    const engine = new InterpretationEngine()
    const state = engine.render(healthIntent, 'L3', mockCtx)
    expect(state.level).toBe('L3')
    expect(state.label!.toLowerCase()).toContain('health')
    expect(state.preview).toBeDefined()
    expect(state.details).toBeDefined()
  })

  it('includes color in state', () => {
    const engine = new InterpretationEngine()
    const state = engine.render(healthIntent, 'L1', mockCtx)
    expect(state.color).toBeDefined()
    expect(state.color!.h).toBeGreaterThanOrEqual(0)
  })

  it('handles provider intent', () => {
    const engine = new InterpretationEngine()
    const state = engine.render(switchIntent, 'L2', mockCtx)
    expect(state.label!.toLowerCase()).toContain('switch')
    expect(state.preview).toBeDefined()
  })

  it('dismisses interpretation', () => {
    const engine = new InterpretationEngine()
    const state = engine.render(healthIntent, 'L2', mockCtx)
    expect(state.dismissed).toBe(false)
    engine.dismiss()
    const newState = engine.render(healthIntent, 'L2', mockCtx)
    expect(newState.dismissed).toBe(true)
  })

  it('expands from L1 to L2', () => {
    const engine = new InterpretationEngine()
    const l1 = engine.render(healthIntent, 'L1', mockCtx)
    const l2 = engine.expand(l1)
    expect(l2.level).toBe('L2')
  })
})
