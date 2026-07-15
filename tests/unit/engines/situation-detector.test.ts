// tests/unit/engines/situation-detector.test.ts
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { SituationDetector } from '../../../src/engines/situation-detector.js'
import type { SituationStore } from '../../../src/storage/contracts/situation-store.js'

function makeMockStore(): SituationStore {
  return {
    createLog: mock(() => Promise.resolve()),
    getRecentForConversation: mock(() => Promise.resolve([])),
    createUserPreference: mock(() => Promise.resolve()),
    getUserPreferences: mock(() => Promise.resolve([])),
  }
}

function makeDetector(store?: SituationStore) {
  return new SituationDetector(store ?? makeMockStore())
}

// ── Atomic 17.1 required tests ──────────────────────────────────────────────

describe('SituationDetector', () => {
  let store: ReturnType<typeof makeMockStore>

  beforeEach(() => {
    store = makeMockStore()
  })

  it('detects debugging from error message', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage('How do I fix this TypeError?')
    expect(result.type).toBe('debugging')
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  it('detects writing from blog request', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage('Write a blog post about AI')
    expect(result.type).toBe('writing')
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  it('detects researching from comparison request', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage('Compare PostgreSQL vs MySQL')
    expect(result.type).toBe('researching')
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  it('detects coding from code-heavy input', async () => {
    const det = makeDetector(store)
    const result = await det.detect({
      message: '```typescript\nconst x = () => { return 1 }\n```\nWhy is this function failing?',
      recentMessages: [
        { role: 'user', content: 'I need to implement a new function in my TypeScript project' },
      ],
    })
    // Code block + code keywords should lean coding or debugging
    expect(['coding', 'debugging']).toContain(result.type)
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  it('returns general for ambiguous input', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage('hello')
    expect(result.type).toBe('general')
    expect(result.confidence).toBeLessThanOrEqual(0.5)
  })

  // ── Additional coverage ──────────────────────────────────────────────

  it('detects planning from strategy request', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage('Create a roadmap for the next quarter')
    expect(result.type).toBe('planning')
  })

  it('detects learning from tutorial request', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage('Explain what is a closure in JavaScript')
    expect(result.type).toBe('learning')
  })

  it('detects reviewing from code review request', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage(
      'Review this PR and give feedback on the code changes',
    )
    expect(result.type).toBe('reviewing')
  })

  it('detects designing from UI request', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage('Design a responsive layout for the dashboard')
    expect(result.type).toBe('designing')
  })

  it('detects data_analysis from SQL request', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage(
      'Analyze the data with a SQL query grouped by category',
    )
    expect(result.type).toBe('data_analysis')
  })

  it('applies history boost from recent messages', async () => {
    const det = makeDetector(store)
    const result = await det.detect({
      message: 'Fix the issue',
      recentMessages: [
        { role: 'user', content: 'I have a bug in my code' },
        { role: 'user', content: 'The error happens on line 42' },
      ],
    })
    // "Fix" + bug/error history should strongly lean debugging
    expect(result.type).toBe('debugging')
  })

  it('persists detection log to store', async () => {
    const det = makeDetector(store)
    await det.detect({ message: 'Fix the bug', conversationId: 'conv-1' })
    expect(store.createLog).toHaveBeenCalledTimes(1)
    const callArgs = (store.createLog as ReturnType<typeof mock>).mock.calls[0]
    const logArg = callArgs?.[0]!
    expect(logArg.detectedType).toBe('debugging')
    expect(logArg.conversationId).toBe('conv-1')
    expect(logArg.confidence).toBeGreaterThan(0)
  })

  it('learnFromCorrection stores user preference', async () => {
    const det = makeDetector(store)
    await det.learnFromCorrection('conv-1', 'writing', 'coding')
    expect(store.createUserPreference).toHaveBeenCalledTimes(1)
    const callArgs = (store.createUserPreference as ReturnType<typeof mock>).mock.calls[0]
    const prefArg = callArgs?.[0]!
    expect(prefArg.key).toBe('correction:writing')
    expect(prefArg.value).toBe('coding')
  })

  it('signals array has indicator details', async () => {
    const det = makeDetector(store)
    const result = await det.detectFromMessage('Write an article about AI')
    expect(result.signals.length).toBeGreaterThan(0)
    expect(result.signals[0]).toHaveProperty('indicator')
    expect(result.signals[0]).toHaveProperty('weight')
    expect(result.signals[0]).toHaveProperty('matched')
  })

  it('handles store failure in createLog gracefully', async () => {
    const failStore: SituationStore = {
      ...makeMockStore(),
      createLog: mock(() => Promise.reject(new Error('db down'))),
    }
    const det = makeDetector(failStore)
    // Should not throw
    const result = await det.detect({ message: 'Fix the bug', conversationId: 'conv-1' })
    expect(result.type).toBe('debugging')
  })
})
