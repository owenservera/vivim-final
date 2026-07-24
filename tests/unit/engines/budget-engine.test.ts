// tests/unit/engines/budget-engine.test.ts
// BudgetEngine — cost/usage budget enforcement tests.
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  BudgetEngine,
  type RunUsage,
  type UsageLimits,
} from '../../../src/engines/budget-engine.js'
import { BudgetExceededError } from '../../../src/errors.js'

function makeUsage(overrides?: Partial<RunUsage>): RunUsage {
  return {
    requests: 0,
    toolCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costCents: 0,
    ...overrides,
  }
}

function makeLimits(overrides?: Partial<UsageLimits>): UsageLimits {
  return {
    requestLimit: null,
    toolCallsLimit: null,
    inputTokensLimit: null,
    outputTokensLimit: null,
    totalTokensLimit: null,
    ...overrides,
  }
}

describe('BudgetEngine', () => {
  let store: { accrueCost: ReturnType<typeof mock>; checkBudget: ReturnType<typeof mock> }
  let engine: BudgetEngine

  beforeEach(() => {
    store = {
      accrueCost: mock(() => Promise.resolve()),
      checkBudget: mock(() => Promise.resolve()),
    }
    engine = new BudgetEngine(store as never)
  })

  describe('checkBeforeRequest', () => {
    it('throws BudgetExceededError when request limit exceeded', () => {
      const usage = makeUsage({ requests: 10 })
      const limits = makeLimits({ requestLimit: 10 })
      expect(() => engine.checkBeforeRequest('r1', usage, limits)).toThrow(BudgetExceededError)
    })

    it('passes when under request limit', () => {
      const usage = makeUsage({ requests: 5 })
      const limits = makeLimits({ requestLimit: 10 })
      expect(() => engine.checkBeforeRequest('r1', usage, limits)).not.toThrow()
    })

    it('throws when input tokens exceed limit', () => {
      const usage = makeUsage({ inputTokens: 5000 })
      const limits = makeLimits({ inputTokensLimit: 4000 })
      expect(() => engine.checkBeforeRequest('r1', usage, limits)).toThrow(BudgetExceededError)
    })

    it('throws when total tokens exceed limit', () => {
      const usage = makeUsage({ totalTokens: 10000 })
      const limits = makeLimits({ totalTokensLimit: 8000 })
      expect(() => engine.checkBeforeRequest('r1', usage, limits)).toThrow(BudgetExceededError)
    })

    it('passes with no limits set', () => {
      const usage = makeUsage({ requests: 999, totalTokens: 999999 })
      const limits = makeLimits()
      expect(() => engine.checkBeforeRequest('r1', usage, limits)).not.toThrow()
    })
  })

  describe('checkTokens', () => {
    it('throws when output tokens exceed limit', () => {
      const usage = makeUsage({ outputTokens: 3000 })
      const limits = makeLimits({ outputTokensLimit: 2000 })
      expect(() => engine.checkTokens(usage, limits)).toThrow(BudgetExceededError)
    })

    it('throws when total tokens exceed limit', () => {
      const usage = makeUsage({ totalTokens: 15000 })
      const limits = makeLimits({ totalTokensLimit: 10000 })
      expect(() => engine.checkTokens(usage, limits)).toThrow(BudgetExceededError)
    })

    it('passes when within limits', () => {
      const usage = makeUsage({ outputTokens: 1000, totalTokens: 5000 })
      const limits = makeLimits({ outputTokensLimit: 2000, totalTokensLimit: 10000 })
      expect(() => engine.checkTokens(usage, limits)).not.toThrow()
    })
  })

  describe('checkBeforeToolCall', () => {
    it('throws when tool calls exceed limit', () => {
      const usage = makeUsage({ toolCalls: 5 })
      const limits = makeLimits({ toolCallsLimit: 3 })
      expect(() => engine.checkBeforeToolCall(usage, limits)).toThrow(BudgetExceededError)
    })

    it('passes when under tool calls limit', () => {
      const usage = makeUsage({ toolCalls: 2 })
      const limits = makeLimits({ toolCallsLimit: 5 })
      expect(() => engine.checkBeforeToolCall(usage, limits)).not.toThrow()
    })
  })

  describe('accrue', () => {
    it('delegates to store.accrueCost', async () => {
      await engine.accrue('run-1', 50, 1000)
      expect(store.accrueCost).toHaveBeenCalledWith('run-1', 50, 1000)
    })

    it('accrues with default tokens=0', async () => {
      await engine.accrue('run-1', 10)
      expect(store.accrueCost).toHaveBeenCalledWith('run-1', 10, 0)
    })
  })

  describe('guard', () => {
    it('delegates to store.checkBudget', async () => {
      await engine.guard('run-1', 'cost', 100, 200)
      expect(store.checkBudget).toHaveBeenCalledWith('run-1', 'cost', 100, 200)
    })
  })
})
