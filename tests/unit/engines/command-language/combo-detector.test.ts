import { describe, expect, it } from 'bun:test'
import { detectCombo } from '../../../../src/engines/command-language/combo-detector.js'
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
  panelStatus: 'connected',
  activeTags: [],
  recentCommands: [],
  sessionState: {},
}

function cmd(overrides?: Partial<CommandIntent>): CommandIntent {
  return {
    commandId: '/health',
    confidence: 0.9,
    category: 'system',
    matchedPattern: 'health check',
    args: {},
    source: 'nlp',
    color: { category: 'system' } as any,
    interpretation: 'health check',
    ...overrides,
  }
}

describe('detectCombo', () => {
  it('returns single intent as-is', () => {
    const intents: CommandIntent[] = [cmd()]
    const combo = detectCombo(intents, mockCtx)
    expect(combo.steps).toHaveLength(1)
    expect(combo.steps[0]!.intent.commandId).toBe('/health')
    expect(combo.executionMode).toBe('sequential')
  })

  it('detects sequential combo with "then"', () => {
    const intents: CommandIntent[] = [
      cmd({ commandId: '/switch', category: 'provider', matchedPattern: 'switch to' }),
      cmd({ commandId: '/send', confidence: 0.85, category: 'conversation', matchedPattern: 'send message' }),
    ]
    const combo = detectCombo(intents, mockCtx)
    expect(combo.steps).toHaveLength(2)
    expect(combo.executionMode).toBe('sequential')
    expect(combo.steps[0]!.intent.commandId).toBe('/switch')
    expect(combo.steps[1]!.intent.commandId).toBe('/send')
  })

  it('detects parallel combo with "and"', () => {
    const intents: CommandIntent[] = [
      cmd(),
      cmd({ commandId: '/providers', confidence: 0.85, category: 'provider', matchedPattern: 'list providers' }),
    ]
    const combo = detectCombo(intents, mockCtx)
    expect(combo.steps).toHaveLength(2)
    expect(combo.executionMode).toBe('parallel')
  })

  it('handles empty intents', () => {
    const combo = detectCombo([], mockCtx)
    expect(combo.steps).toHaveLength(0)
    expect(combo.executionMode).toBe('sequential')
  })

  it('marks dependent steps', () => {
    const intents: CommandIntent[] = [
      cmd({ commandId: '/switch', category: 'provider', matchedPattern: 'switch to' }),
      cmd({ commandId: '/send', confidence: 0.85, category: 'conversation', matchedPattern: 'send message' }),
    ]
    const combo = detectCombo(intents, mockCtx)
    expect(combo.steps[1]!.dependsOn).toContain('step-0')
  })

  it('detects mixed sequential and parallel', () => {
    const intents: CommandIntent[] = [
      cmd({ commandId: '/switch', category: 'provider', matchedPattern: 'switch to' }),
      cmd(),
      cmd({ commandId: '/providers', confidence: 0.85, category: 'provider', matchedPattern: 'list providers' }),
    ]
    const combo = detectCombo(intents, mockCtx)
    expect(combo.steps.length).toBeGreaterThanOrEqual(2)
  })
})
