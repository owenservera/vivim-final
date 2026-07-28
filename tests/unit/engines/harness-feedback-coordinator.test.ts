// tests/unit/engines/harness-feedback-coordinator.test.ts
// HarnessFeedbackCoordinator — multi-round LLM refinement with backoff + diff.
import { describe, expect, it, mock } from 'bun:test'
import { HarnessFeedbackCoordinator } from '../../../src/engines/harness-feedback-coordinator.js'

describe('HarnessFeedbackCoordinator', () => {
  describe('buildRoundPrompt', () => {
    it('returns base prompt on round 1 with initial strategy', () => {
      const coord = new HarnessFeedbackCoordinator()
      const { prompt, strategy } = coord.buildRoundPrompt(1, 'Write a function')
      expect(prompt).toBe('Write a function')
      expect(strategy).toBe('initial')
    })

    it('returns repair prompt on round 2 with prior output', () => {
      const coord = new HarnessFeedbackCoordinator()
      const { prompt, strategy } = coord.buildRoundPrompt(2, 'base', 'bad output', 'missing return')
      expect(strategy).toBe('repair')
      expect(prompt).toContain('Round 2')
      expect(prompt).toContain('Prior output:')
      expect(prompt).toContain('bad output')
      expect(prompt).toContain('missing return')
      expect(prompt).toContain('Repair')
    })

    it('returns elaborate prompt on round 3', () => {
      const coord = new HarnessFeedbackCoordinator()
      const { prompt, strategy } = coord.buildRoundPrompt(3, 'base', 'incomplete')
      expect(strategy).toBe('elaborate')
      expect(prompt).toContain('Elaborate')
    })

    it('returns decompose prompt on round 4+', () => {
      const coord = new HarnessFeedbackCoordinator({ maxRounds: 5 })
      const { prompt, strategy } = coord.buildRoundPrompt(4, 'base', 'too big')
      expect(strategy).toBe('decompose')
      expect(prompt).toContain('Decompose')
    })
  })

  describe('run', () => {
    it('accepts on first round and returns ok', async () => {
      const coord = new HarnessFeedbackCoordinator()
      const produce = mock(() => Promise.resolve('good output'))
      const accept = mock(() => true)

      const result = await coord.run('Do something', produce, accept)
      expect(result.ok).toBe(true)
      expect(result.rounds).toBe(1)
      expect(result.turns).toHaveLength(1)
      expect(result.turns[0]!.accepted).toBe(true)
      expect(result.finalContent).toBe('good output')
    })

    it('retries until accepted or max rounds', async () => {
      const coord = new HarnessFeedbackCoordinator({ maxRounds: 3 })
      let callCount = 0
      const produce = mock(() => {
        callCount++
        return Promise.resolve(`attempt ${callCount}`)
      })
      const accept = mock((content: string) => content === 'attempt 3')

      const result = await coord.run('Do something', produce, accept)
      expect(result.ok).toBe(true)
      expect(result.rounds).toBe(3)
      expect(result.finalContent).toBe('attempt 3')
    })

    it('returns not-ok when never accepted within max rounds', async () => {
      const coord = new HarnessFeedbackCoordinator({ maxRounds: 2 })
      const produce = mock(() => Promise.resolve('bad'))
      const accept = mock(() => false)

      const result = await coord.run('Do something', produce, accept)
      expect(result.ok).toBe(false)
      expect(result.rounds).toBe(2)
      expect(result.finalContent).toBeUndefined()
      expect(result.acceptedIndex).toBe(-1)
    })

    it('uses different strategies per round', async () => {
      const coord = new HarnessFeedbackCoordinator({ maxRounds: 3 })
      const strategies: string[] = []
      const produce = mock((_prompt: string, strategy: string) => {
        strategies.push(strategy)
        return Promise.resolve('output')
      })
      const accept = mock(() => false)

      await coord.run('base', produce, accept)
      expect(strategies).toEqual(['initial', 'repair', 'elaborate'])
    })

    it('passes round number to produce callback', async () => {
      const coord = new HarnessFeedbackCoordinator({ maxRounds: 2 })
      const rounds: number[] = []
      const produce = mock((_prompt: string, _strategy: string, round: number) => {
        rounds.push(round)
        return Promise.resolve('output')
      })
      const accept = mock(() => true)

      await coord.run('base', produce, accept)
      expect(rounds).toEqual([1])
    })

    it('stops immediately when accepted', async () => {
      const coord = new HarnessFeedbackCoordinator({ maxRounds: 5 })
      const produce = mock(() => Promise.resolve('ok'))
      const accept = mock(() => true)

      const result = await coord.run('base', produce, accept)
      expect(result.rounds).toBe(1)
      expect(produce).toHaveBeenCalledTimes(1)
    })
  })

  describe('diff heuristic', () => {
    it('returns empty output message for blank content', async () => {
      const coord = new HarnessFeedbackCoordinator({ maxRounds: 2 })
      const produce = mock(() => Promise.resolve(''))
      const accept = mock(() => false)

      const result = await coord.run('base', produce, accept)
      expect(result.turns[1]!.prompt).toContain('Output was empty')
    })
  })
})
