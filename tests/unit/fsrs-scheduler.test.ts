// tests/unit/fsrs-scheduler.test.ts
// Unit tests for FSRS-6 spaced repetition scheduler

import { describe, expect, it } from 'bun:test'
import { type Card, FsrsScheduler } from '../../src/engines/fsrs-scheduler.js'

describe('FsrsScheduler', () => {
  const scheduler = new FsrsScheduler()

  describe('new card scheduling', () => {
    it('should move new card to learning state on first review', () => {
      const card: Card = {
        id: 'test-1',
        state: 'new',
        due: Date.now(),
        interval: 0,
        difficulty: 5,
        stability: 0,
        reps: 0,
        lapses: 0,
      }

      const result = scheduler.calculate(card, 3)
      expect(result.state).toBe('learning')
      expect(result.reps).toBe(1)
    })

    it('should calculate initial stability based on rating', () => {
      const card: Card = {
        id: 'test-1',
        state: 'new',
        due: Date.now(),
        interval: 0,
        difficulty: 5,
        stability: 0,
        reps: 0,
        lapses: 0,
      }

      const easyResult = scheduler.calculate(card, 4)
      const hardResult = scheduler.calculate({ ...card, id: 'test-2' }, 1)

      expect(easyResult.stability).toBeGreaterThan(hardResult.stability)
    })
  })

  describe('learning card scheduling', () => {
    it('should move to review state on successful review', () => {
      const card: Card = {
        id: 'test-1',
        state: 'learning',
        due: Date.now(),
        interval: 0,
        difficulty: 5,
        stability: 1,
        reps: 1,
        lapses: 0,
      }

      const result = scheduler.calculate(card, 3)
      expect(result.state).toBe('review')
      expect(result.interval).toBeGreaterThan(0)
    })

    it('should stay in learning on failed review', () => {
      const card: Card = {
        id: 'test-1',
        state: 'learning',
        due: Date.now(),
        interval: 0,
        difficulty: 5,
        stability: 1,
        reps: 1,
        lapses: 0,
      }

      const result = scheduler.calculate(card, 1)
      expect(result.state).toBe('learning')
      expect(result.interval).toBe(0)
      expect(result.lapses).toBe(1)
    })
  })

  describe('review card scheduling', () => {
    it('should calculate interval based on stability', () => {
      const card: Card = {
        id: 'test-1',
        state: 'review',
        due: Date.now(),
        interval: 1,
        difficulty: 5,
        stability: 5,
        reps: 1,
        lapses: 0,
      }

      const result = scheduler.calculate(card, 3)
      expect(result.state).toBe('review')
      expect(result.interval).toBeGreaterThan(0)
    })

    it('should move to relearning on failed review', () => {
      const card: Card = {
        id: 'test-1',
        state: 'review',
        due: Date.now(),
        interval: 10,
        difficulty: 5,
        stability: 5,
        reps: 5,
        lapses: 0,
      }

      const result = scheduler.calculate(card, 1)
      expect(result.state).toBe('relearning')
      expect(result.interval).toBe(0)
      expect(result.lapses).toBe(1)
    })
  })

  describe('due card detection', () => {
    it('should identify cards that are due', () => {
      const now = Date.now()
      const cards: Card[] = [
        {
          id: 'test-1',
          state: 'review',
          due: now - 1000,
          interval: 1,
          difficulty: 5,
          stability: 5,
          reps: 1,
          lapses: 0,
        },
        {
          id: 'test-2',
          state: 'review',
          due: now + 1000000,
          interval: 10,
          difficulty: 5,
          stability: 5,
          reps: 1,
          lapses: 0,
        },
      ]

      const dueCards = scheduler.getDueCards(cards)
      expect(dueCards).toHaveLength(1)
      expect(dueCards[0]!.id).toBe('test-1')
    })

    it('should return empty array when no cards are due', () => {
      const now = Date.now()
      const cards: Card[] = [
        {
          id: 'test-1',
          state: 'review',
          due: now + 1000000,
          interval: 10,
          difficulty: 5,
          stability: 5,
          reps: 1,
          lapses: 0,
        },
      ]

      const dueCards = scheduler.getDueCards(cards)
      expect(dueCards).toHaveLength(0)
    })
  })

  describe('difficulty adjustment', () => {
    it('should increase difficulty on poor ratings', () => {
      const card: Card = {
        id: 'test-1',
        state: 'review',
        due: Date.now(),
        interval: 5,
        difficulty: 5,
        stability: 5,
        reps: 1,
        lapses: 0,
      }

      const result = scheduler.calculate(card, 1)
      expect(result.difficulty).toBeGreaterThan(card.difficulty)
    })

    it('should decrease difficulty on excellent ratings', () => {
      const card: Card = {
        id: 'test-1',
        state: 'review',
        due: Date.now(),
        interval: 5,
        difficulty: 5,
        stability: 5,
        reps: 1,
        lapses: 0,
      }

      const result = scheduler.calculate(card, 5)
      expect(result.difficulty).toBeLessThan(card.difficulty)
    })

    it('should cap difficulty at 10', () => {
      const card: Card = {
        id: 'test-1',
        state: 'review',
        due: Date.now(),
        interval: 5,
        difficulty: 10,
        stability: 5,
        reps: 1,
        lapses: 0,
      }

      const result = scheduler.calculate(card, 0)
      expect(result.difficulty!).toBeLessThanOrEqual(10)
    })

    it('should floor difficulty at 1', () => {
      const card: Card = {
        id: 'test-1',
        state: 'review',
        due: Date.now(),
        interval: 5,
        difficulty: 1,
        stability: 5,
        reps: 1,
        lapses: 0,
      }

      const result = scheduler.calculate(card, 5)
      expect(result.difficulty!).toBeGreaterThanOrEqual(1)
    })
  })
})
