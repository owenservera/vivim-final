import { describe, expect, test } from 'bun:test'
import {
  ActionRouter,
  type HarnessAction,
  type HarnessProtocolConfig,
  PromptAugmenter,
  type PromptContext,
  ResponseExtractor,
} from '../../../src/engines/harness-protocol-engine.js'

const DEFAULT_CONFIG: HarnessProtocolConfig = {
  extractionTimeoutMs: 5000,
  llmRepairEnabled: false,
  autoApproveReadOps: true,
  autoApproveWriteOps: false,
  requireApprovalDestructive: true,
  maxFeedbackActions: 5,
}

describe('PromptAugmenter', () => {
  const augmenter = new PromptAugmenter()

  test('augments prompt with capabilities', () => {
    const ctx: PromptContext = {
      availableCapabilities: [{ slug: 'send', name: 'Send', description: 'Send message' }],
    }
    const result = augmenter.augmentPrompt('Base prompt', ctx)
    expect(result).toContain('Base prompt')
    expect(result).toContain('Available Capabilities')
    expect(result).toContain('send')
  })

  test('augments prompt with page state', () => {
    const ctx: PromptContext = { currentPageState: { url: 'https://x.com' } }
    const result = augmenter.augmentPrompt('Hello', ctx)
    expect(result).toContain('Current Page State')
    expect(result).toContain('x.com')
  })

  test('augments prompt with recent actions', () => {
    const actions: HarnessAction[] = [
      {
        type: 'capability_action',
        capabilitySlug: 'click',
        providerId: 'p1',
        input: {},
        confidence: 0.9,
      },
    ]
    const ctx: PromptContext = { recentActions: actions }
    const result = augmenter.augmentPrompt('Base', ctx)
    expect(result).toContain('Recent Actions')
  })

  test('augments with valid selectors', () => {
    const ctx: PromptContext = { validSelectors: ['#btn', 'textarea'] }
    const result = augmenter.augmentPrompt('Base', ctx)
    expect(result).toContain('Valid Selectors')
    expect(result).toContain('#btn')
  })
})

describe('ResponseExtractor', () => {
  const extractor = new ResponseExtractor()

  test('extract returns content blocks with plain text', async () => {
    const result = await extractor.extract('Hello world', DEFAULT_CONFIG)
    expect(result.contentBlocks).toHaveLength(1)
    expect(result.contentBlocks[0]?.content).toBe('Hello world')
  })

  test('extract handles empty string', async () => {
    const result = await extractor.extract('', DEFAULT_CONFIG)
    expect(result.contentBlocks).toHaveLength(1)
    expect(result.contentBlocks[0]?.content).toBe('')
  })
})

describe('ActionRouter', () => {
  const router = new ActionRouter()

  test('route returns observation target for observation_request', () => {
    const action: HarnessAction = {
      type: 'observation_request',
      what: ['dom', 'screenshot'],
      slaveId: 's1',
    }
    const target = router.route(action, DEFAULT_CONFIG)
    expect(target).not.toBeNull()
    expect(target?.type).toBe('observation')
  })

  test('route passes through capability_action with autoApproveWriteOps', () => {
    const action: HarnessAction = {
      type: 'capability_action',
      capabilitySlug: 'click',
      providerId: 'p1',
      input: {},
      confidence: 0.9,
    }
    const target = router.route(action, { ...DEFAULT_CONFIG, autoApproveWriteOps: true })
    expect(target).not.toBeNull()
    expect(target?.type).toBe('capability')
  })

  test('route denies write capability when autoApproveWriteOps is false', () => {
    const action: HarnessAction = {
      type: 'capability_action',
      capabilitySlug: 'click',
      providerId: 'p1',
      input: {},
      confidence: 0.9,
    }
    const target = router.route(action, { ...DEFAULT_CONFIG, autoApproveWriteOps: false })
    expect(target).toBeNull()
  })
})
